# Android APK release signing setup

The debug APK workflow is for early installation/testing. A public, updateable release APK must be signed with a private keystore that remains under the project owner's control.

## 1. Create the release keystore on Windows

Open PowerShell on the owner's PC. Make sure Java's keytool is available (Android Studio's bundled JBR includes it; otherwise install a JDK).

~~~powershell
$KeystorePath = Join-Path $env:USERPROFILE "Documents\daredevils-eye-release.jks"
$Alias = "daredevils-eye"

keytool -genkeypair -v -keystore $KeystorePath -alias $Alias -keyalg RSA -keysize 4096 -validity 10000

if (-not (Test-Path $KeystorePath)) { throw "Keystore was not created." }

$Base64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($KeystorePath))
Set-Clipboard -Value $Base64
Write-Host "Keystore created at $KeystorePath"
Write-Host "Base64 keystore copied to clipboard. Paste it directly into the GitHub secret; do not paste it into chat."
~~~

Choose strong, unique store and key passwords. Keep at least one encrypted offline backup of the JKS file and store its passwords in a password manager. If the keystore is lost, future APK updates cannot be signed with the same identity.

## 2. Add GitHub Actions secrets

Open the repository:

**Settings → Secrets and variables → Actions → New repository secret**

Create these four secrets exactly:

| Secret name | Value |
|---|---|
| ANDROID_KEYSTORE_BASE64 | Clipboard contents from the PowerShell command |
| ANDROID_KEYSTORE_PASSWORD | Keystore password |
| ANDROID_KEY_ALIAS | daredevils-eye |
| ANDROID_KEY_PASSWORD | Key password |

Never commit the keystore, passwords or Base64 value. Do not send them in a chat or issue.

## 3. Publish a signed APK

After the native Android PR has been reviewed and merged:

1. Open **Actions → Sign and publish Daredevil's Eye Android APK**.
2. Select **Run workflow**.
3. Set ref to **main**.
4. Set tag_name to a new version, e.g. **android-v1.0.0**.
5. Run the workflow and wait for success.
6. Open **Releases** and download **DaredevilsEye-Android.apk** and **SHA256SUMS.txt**.

The release workflow signs the APK with the protected keystore, computes a SHA-256 checksum and attaches both files to a GitHub Release. Play Store publication is a later, separate step.

## 4. Debug artifact vs signed release

- **Debug APK:** installable for early testing; signed with the temporary CI debug key. Do not use it as the long-term public release.
- **Signed release APK:** signed with the owner's persistent private keystore; suitable for updates distributed from GitHub Releases.
- Never change or regenerate the release keystore after the first public release.
