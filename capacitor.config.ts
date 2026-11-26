import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.karankundu.daredevilseye',
  appName: "Daredevil's Eye",
  webDir: 'web',
  server: {
    // The current app uses same-origin Worker APIs and HttpOnly session cookies.
    // A remote HTTPS origin preserves that contract in the first native wrapper.
    // This is an online-first shell, not an offline AI client.
    url: 'https://daredevils-eye.karanjoykundu.workers.dev/blind/',
    cleartext: false,
    androidScheme: 'https'
  },
  android: {
    allowMixedContent: false,
    captureInput: true
  }
};

export default config;
