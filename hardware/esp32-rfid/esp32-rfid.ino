/*
 * Daredevil's Eye — ESP32 + RC522 Medicine RFID reader
 * Stage-gated diagnostics. Uses certificate-verified HTTPS.
 *
 * Libraries: MFRC522 (Miguel Balboa), Arduino ESP32 core.
 * Board: ESP32 Dev Module / compatible ESP32.
 */
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <MFRC522.h>
#include <Preferences.h>

#define RFID_SS_PIN 5
#define RFID_RST_PIN 22
#define RFID_SCK_PIN 18
#define RFID_MOSI_PIN 23
#define RFID_MISO_PIN 19

static const char *WIFI_SSID = "YOUR_WIFI_NAME";
static const char *WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
static const char *SERVER_BASE = "https://daredevils-eye.karanjoykundu.workers.dev";

// Paste the current trusted root CA PEM for the workers.dev TLS certificate here.
// Leave empty until configured: firmware deliberately refuses to send credentials without TLS verification.
static const char *ROOT_CA_CERT = "";

MFRC522 rfid(RFID_SS_PIN, RFID_RST_PIN);
Preferences preferences;
String deviceToken;
String deviceId;
bool rfidReady = false;
bool deviceReady = false;
unsigned long lastScanAt = 0;
unsigned long lastQueueRetryAt = 0;
const unsigned long SCAN_COOLDOWN_MS = 1800;
const unsigned long QUEUE_RETRY_MS = 5000;
const uint8_t MAX_PENDING_EVENTS = 5;

struct MedicineCard { const char *uid; const char *name; };
const MedicineCard MEDICINES[] = {
  {"A1618C04", "Napa One"},
  {"1474D505", "Monus 10"}
};

String stageError(const char *code, const String &detail) {
  Serial.printf("[FAIL] %s: %s\n", code, detail.c_str());
  return String(code);
}

String readJsonString(const String &json, const String &key) {
  const String marker = "\"" + key + "\":\"";
  int start = json.indexOf(marker);
  if (start < 0) return "";
  start += marker.length();
  int end = json.indexOf('"', start);
  if (end < 0) return "";
  return json.substring(start, end);
}

String randomEventId() {
  char id[33];
  for (int i = 0; i < 16; i++) sprintf(id + i * 2, "%02x", (uint8_t)esp_random());
  id[32] = '\0';
  return String(id);
}

bool tlsReady() {
  if (!ROOT_CA_CERT || strlen(ROOT_CA_CERT) < 100) {
    stageError("TLS_CA_NOT_CONFIGURED", "Add the verified root CA certificate in ROOT_CA_CERT before connecting.");
    return false;
  }
  return true;
}

bool connectWiFi() {
  Serial.println("[2/7] WIFI CONNECTION");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  const unsigned long started = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - started < 20000) {
    delay(400); Serial.print(".");
  }
  Serial.println();
  if (WiFi.status() != WL_CONNECTED) {
    stageError("WIFI_CONNECT_FAILED", "Check SSID/password and 2.4 GHz Wi-Fi availability.");
    return false;
  }
  Serial.printf("[PASS] WIFI CONNECTED · IP %s\n", WiFi.localIP().toString().c_str());
  return true;
}

int request(const String &path, const String &body, String &response, const String &bearer = "") {
  if (WiFi.status() != WL_CONNECTED) {
    stageError("WIFI_DISCONNECTED", "Reconnect before sending the request.");
    return -1;
  }
  if (!tlsReady()) return -2;
  WiFiClientSecure client;
  client.setCACert(ROOT_CA_CERT);
  HTTPClient http;
  const String url = String(SERVER_BASE) + path;
  if (!http.begin(client, url)) {
    stageError("TLS_FAILED", "Could not initialize verified HTTPS connection.");
    return -2;
  }
  http.setTimeout(10000);
  http.addHeader("Content-Type", "application/json");
  if (bearer.length()) http.addHeader("Authorization", "Bearer " + bearer);
  int code = body.length() ? http.POST(body) : http.GET();
  response = http.getString();
  http.end();
  return code;
}

bool checkServer() {
  Serial.println("[3/7] HTTPS SERVER CHECK");
  String response;
  const int code = request("/api/health", "", response);
  if (code != 200 || response.indexOf("\"ok\":true") < 0) {
    stageError(code == -2 ? "TLS_FAILED" : "SERVER_HEALTH_FAILED", "HTTP " + String(code) + " · " + response.substring(0, 160));
    return false;
  }
  Serial.println("[PASS] HTTPS SERVER REACHABLE");
  return true;
}

bool pairDevice() {
  if (deviceToken.length()) {
    Serial.println("[4/7] DEVICE TOKEN FOUND IN ESP32 NVS");
    return true;
  }
  Serial.println("[4/7] DEVICE PAIRING");
  Serial.println("Open /medicine/ in Daredevil's Eye, generate a code, then type the six digits here:");
  String code;
  const unsigned long started = millis();
  while (millis() - started < 180000) {
    while (Serial.available()) {
      char ch = (char)Serial.read();
      if (ch >= '0' && ch <= '9' && code.length() < 6) code += ch;
      if (code.length() == 6) break;
    }
    if (code.length() == 6) break;
    delay(20);
  }
  if (code.length() != 6) {
    stageError("PAIR_CODE_TIMEOUT", "No six-digit code received within three minutes.");
    return false;
  }
  String response;
  const int httpCode = request("/api/rfid/pair/claim", "{\"code\":\"" + code + "\"}", response);
  String token = readJsonString(response, "deviceToken");
  String id = readJsonString(response, "deviceId");
  if (httpCode != 200 || token.length() != 64 || id.length() != 32) {
    stageError("DEVICE_PAIR_FAILED", "HTTP " + String(httpCode) + " · " + response.substring(0, 160));
    return false;
  }
  preferences.begin("de-rfid", false);
  preferences.putString("token", token);
  preferences.putString("deviceId", id);
  preferences.end();
  deviceToken = token; deviceId = id;
  Serial.println("[PASS] DEVICE PAIRED · TOKEN SAVED IN NVS");
  return true;
}

String loadPendingQueue() {
  preferences.begin("de-rfid", true);
  String queue = preferences.getString("pending", "");
  preferences.end();
  return queue;
}

void savePendingQueue(const String &queue) {
  preferences.begin("de-rfid", false);
  preferences.putString("pending", queue);
  preferences.end();
}

bool enqueuePendingEvent(const String &body) {
  String queue = loadPendingQueue();
  uint8_t count = queue.length() ? 1 : 0;
  for (unsigned int i = 0; i < queue.length(); i++) if (queue[i] == '\n') count++;
  if (count >= MAX_PENDING_EVENTS || queue.length() + body.length() + 1 > 3000) {
    stageError("OFFLINE_QUEUE_FULL", "Five unsent medicine events are already stored. Keep the device online before scanning more cards.");
    return false;
  }
  if (queue.length()) queue += '\n';
  queue += body;
  savePendingQueue(queue);
  Serial.printf("[QUEUED] EVENT SAVED OFFLINE · %u/%u\n", count + 1, MAX_PENDING_EVENTS);
  return true;
}

bool transmitPayload(const String &body) {
  String response;
  const int code = request("/api/rfid/events", body, response, deviceToken);
  if (code != 200 || response.indexOf("\"accepted\":true") < 0) {
    stageError(code == 401 ? "DEVICE_AUTH_FAILED" : "EVENT_TRANSMISSION_FAILED", "HTTP " + String(code) + " · " + response.substring(0, 160));
    if (code == 401) {
      preferences.begin("de-rfid", false);
      preferences.remove("token"); preferences.remove("deviceId");
      preferences.end();
      deviceToken = ""; deviceId = ""; deviceReady = false;
      Serial.println("[ACTION] Device token revoked. Generate a new pairing code in the app.");
    }
    return false;
  }
  return true;
}

bool flushPendingEvent() {
  String queue = loadPendingQueue();
  if (!queue.length()) return true;
  int separator = queue.indexOf('\n');
  String first = separator < 0 ? queue : queue.substring(0, separator);
  if (!transmitPayload(first)) return false;
  String remaining = separator < 0 ? "" : queue.substring(separator + 1);
  savePendingQueue(remaining);
  Serial.println("[PASS] STORED OFFLINE EVENT DELIVERED");
  return true;
}

bool sendMedicine(const String &uid, const String &medicine) {
  const String body = "{\"uid\":\"" + uid + "\",\"medicine\":\"" + medicine + "\",\"eventId\":\"" + randomEventId() + "\"}";
  if (!flushPendingEvent() || loadPendingQueue().length()) {
    enqueuePendingEvent(body);
    lastQueueRetryAt = millis();
    return false;
  }
  if (!transmitPayload(body)) {
    enqueuePendingEvent(body);
    lastQueueRetryAt = millis();
    return false;
  }
  Serial.printf("[PASS] EVENT ACCEPTED · %s · UID %s\n", medicine.c_str(), uid.c_str());
  return true;
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n========== DAREDEVIL'S EYE RFID ==========");
  Serial.println("[1/7] RFID INITIALIZATION");
  SPI.begin(RFID_SCK_PIN, RFID_MISO_PIN, RFID_MOSI_PIN, RFID_SS_PIN);
  rfid.PCD_Init();
  delay(50);
  byte version = rfid.PCD_ReadRegister(MFRC522::VersionReg);
  if (version == 0x00 || version == 0xFF) {
    stageError("RFID_INIT_FAILED", "RC522 VersionReg is 0x" + String(version, HEX) + ". Check 3.3V, GND and SPI wiring.");
    return;
  }
  Serial.printf("[PASS] RC522 VERSION 0x%02X\n", version);
  rfidReady = true;
  preferences.begin("de-rfid", true);
  deviceToken = preferences.getString("token", "");
  deviceId = preferences.getString("deviceId", "");
  preferences.end();
  if (!connectWiFi()) return;
  if (!checkServer()) return;
  if (!pairDevice()) return;
  deviceReady = true;
  Serial.println("[5/7] RFID SCAN READY");
  Serial.println("[PASS] SCAN A REGISTERED MEDICINE CARD");
  Serial.println("==========================================");
}

void loop() {
  if (!rfidReady) { delay(1000); return; }
  if (!deviceReady) {
    if (WiFi.status() != WL_CONNECTED && !connectWiFi()) { delay(3000); return; }
    if (!checkServer()) { delay(5000); return; }
    if (!pairDevice()) { delay(3000); return; }
    deviceReady = true;
  }
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WARN] WIFI DISCONNECTED · reconnecting");
    if (!connectWiFi()) { delay(3000); return; }
    if (!checkServer()) { delay(3000); return; }
  }
  if (millis() - lastQueueRetryAt >= QUEUE_RETRY_MS) {
    lastQueueRetryAt = millis();
    flushPendingEvent();
    if (!deviceReady) return;
  }
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) { delay(20); return; }
  if (millis() - lastScanAt < SCAN_COOLDOWN_MS) {
    rfid.PICC_HaltA(); rfid.PCD_StopCrypto1(); return;
  }
  lastScanAt = millis();
  String uid;
  for (byte i = 0; i < rfid.uid.size; i++) {
    char part[3]; sprintf(part, "%02X", rfid.uid.uidByte[i]); uid += part;
  }
  Serial.println("[2/7] CARD UID READ · " + uid);
  String medicine;
  for (const auto &card : MEDICINES) if (uid.equalsIgnoreCase(card.uid)) medicine = card.name;
  if (!medicine.length()) {
    stageError("UNKNOWN_CARD", "UID " + uid + " is not registered in the firmware.");
  } else {
    Serial.println("[3/7] MEDICINE MAPPING · " + medicine);
    Serial.println("[6/7] AUTHENTICATED EVENT TRANSMISSION");
    sendMedicine(uid, medicine);
  }
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
}
