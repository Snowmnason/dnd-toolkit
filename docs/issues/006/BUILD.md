# Build & Distribution Guide

Complete guide for building and submitting DnD Toolkit to iOS App Store and Google Play Store.

---

## Quick Start

### Prerequisites
- Node.js 18+
- EAS CLI: `npm install -g eas-cli`
- Expo account: `npx expo signup` or `npx expo login`

### One-time Setup (Do Once)
```bash
# Initialize EAS for this project
eas init

# Login to EAS/Expo
eas login
```

### Build Mobile Apps
```bash
# iOS only
npm run build:ios

# Android only  
npm run build:android

# Both iOS and Android
npm run build:mobile
```

### Submit to App Stores
```bash
# iOS only
npm run submit:ios

# Android only
npm run submit:android

# Both stores
npm run submit:mobile
```

---

## Detailed Setup Guide

### 1. iOS App Store Setup

#### Step 1: Create Apple Developer Account
1. Go to https://developer.apple.com/programs/
2. Pay $99/year
3. Complete identity verification (1-3 days)
4. Note your **Apple Team ID** (format: ABC123XYZ)

#### Step 2: Create App in App Store Connect
1. Go to https://appstoreconnect.apple.com/
2. Click "Apps" → "New App"
3. Configure:
   - **Platform:** iOS
   - **Name:** D&D Toolkit
   - **Bundle ID:** `com.thesnowpost.dndtoolkit` (matches `app.json`)
   - **SKU:** Use anything unique (e.g., `dndtoolkit-001`)
4. Fill in app details (description, screenshots, etc.)
5. Note your **App ID** (ASC App ID)

#### Step 3: Generate Apple Signing Certificate
EAS can do this automatically or you can do it manually:

**Option A: Let EAS handle it (Recommended)**
```bash
eas credentials
# Follow prompts to generate iOS certificate
```

**Option B: Generate manually** (if needed)
1. In Xcode: Preferences → Accounts → Manage Certificates
2. Or use https://developer.apple.com/account/resources/certificates/

#### Step 4: Create App-Specific Password
1. Go to https://appleid.apple.com/account/security
2. Scroll to "App-specific passwords"
3. Generate a new password for "EAS CLI"
4. Copy the password

#### Step 5: Fill in `.env.build`
```bash
APPLE_ID="your-apple-id@example.com"
APPLE_PASSWORD="xxxx-xxxx-xxxx-xxxx"  # App-specific password
APPLE_TEAM_ID="ABC123XYZ"
ASC_APP_ID="1234567890"  # Numeric ID from App Store Connect
```

#### Step 6: Update `eas.json` iOS Submit Config
```json
"submit": {
  "production": {
    "ios": {
      "appleId": "your-apple-id@example.com",
      "ascAppId": "1234567890",
      "appleTeamId": "ABC123XYZ"
    }
  }
}
```

#### Step 7: Build & Submit iOS
```bash
npm run build:ios
# Wait for build to complete (~15-30 min)
npm run submit:ios
```

---

### 2. Google Play Store Setup

#### Step 1: Create Google Play Developer Account
1. Go to https://play.google.com/console/
2. Pay $25 one-time fee
3. Complete store setup

#### Step 2: Create App in Google Play Console
1. Click "Create app"
2. Configure:
   - **Name:** D&D Toolkit
   - **Default language:** English
   - **App type:** Apps
   - **Category:** Games
3. Set up store listing (description, screenshots, etc.)

#### Step 3: Generate Android Signing Key
EAS handles this with:
```bash
eas credentials
# Follow prompts to generate Android keystore
```

This generates a `.jks` file (Java KeyStore) that EAS stores securely.

#### Step 4: Create Service Account (for submission)
1. Go to Google Play Console → Setup → API Access
2. Click "Create Service Account"
3. Follow Google's guide to create a service account
4. Download JSON key file
5. Save it securely: `keys/google-play-service-account.json`

#### Step 5: Fill in `.env.build`
```bash
ANDROID_KEYSTORE_PASSWORD="your-keystore-password"
ANDROID_KEY_PASSWORD="your-key-password"
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON="keys/google-play-service-account.json"
```

#### Step 6: Update `eas.json` Android Submit Config
```json
"submit": {
  "production": {
    "android": {
      "serviceAccount": "keys/google-play-service-account.json",
      "track": "internal"  # internal → alpha → beta → production
    }
  }
}
```

#### Step 7: Build & Submit Android
```bash
npm run build:android
# Wait for build to complete (~15-30 min)
npm run submit:android
```

---

## Build Configuration Files

### `eas.json` - EAS Build Configuration
- **Profiles:** development, preview, production
- **iOS settings:** Resource class (m1 for faster builds)
- **Android settings:** Build type (apk for preview, aab for production)
- **Submit config:** App Store Connect and Google Play Console details

### `.env.build` - Sensitive Credentials
- **Never commit this file** - it contains passwords/keys
- Add to `.gitignore`: `echo ".env.build" >> .gitignore`
- Use environment variables in CI/CD pipelines instead

### `app.json` - App Metadata
- **Bundle ID (iOS):** `com.thesnowpost.dndtoolkit`
- **Package name (Android):** `com.thesnowpost.dndtoolkit`
- **Version:** `1.0.0` (increment for each release)
- **Description & privacy policy required** for app stores

---

## Version Management

### When to Update Versions

**iOS: `buildNumber`** (in `app.json`)
```json
"ios": {
  "buildNumber": "1"  // Increment for TestFlight builds
}
```

**Android: `versionCode`** (in `app.json`)
```json
"android": {
  "versionCode": 1  // Increment for each build submitted
}
```

**App: `version`** (in `app.json`)
```json
"version": "1.0.0"  // Semantic versioning for users
```

### Release Process
1. Update `version` in `app.json`
2. Increment `buildNumber` (iOS) and `versionCode` (Android)
3. Commit to git
4. Build: `npm run build:mobile`
5. Submit: `npm run submit:mobile`
6. App Store & Play Store review (1-3 days)
7. Release to production

---

## Testing Before Submit

### Internal Testing

**iOS TestFlight:**
```bash
npm run build:ios
# After build, submit to TestFlight for internal testing
npm run submit:ios
```

**Android Internal Testing:**
Update `eas.json`:
```json
"android": {
  "track": "internal"  // Start with internal track
}
```

Then:
```bash
npm run build:android
npm run submit:android
```

### Local Testing
```bash
# Preview build
npm run build:mobile
# Scan QR code with Expo Go app to test
```

---

## Troubleshooting

### Build Fails
- Check `.env.build` - make sure all required values are filled
- Verify bundle IDs/package names match `app.json`
- Check EAS logs: `eas build --status` or on https://expo.dev/builds

### Submission Fails
- Verify credentials in `eas.json`
- Ensure app details are filled in on App Store Connect / Play Console
- Check app privacy policy link is valid
- Ensure app screenshots meet store requirements

### Certificate Expired
```bash
eas credentials
# Regenerate certificates
```

---

## Environment Variables in CI/CD

For GitHub Actions, set secrets and use in workflow:
```yaml
env:
  APPLE_ID: ${{ secrets.APPLE_ID }}
  APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
  APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
  ANDROID_KEYSTORE_PASSWORD: ${{ secrets.ANDROID_KEYSTORE_PASSWORD }}
```

---

## 3. Desktop App (Electron) Setup

The desktop app uses Electron to wrap the web export, providing native Windows, macOS, and Linux apps.

### Prerequisites
- Node.js 18+
- The web export must be built first (`npm run predeploy`)

### Quick Start

```bash
# 1. Build the web export
npm run predeploy

# 2. Install desktop dependencies (one-time)
npm run desktop:install

# 3. Run in development mode
npm run desktop:dev

# 4. Build for distribution
npm run desktop:dist:win     # Windows
npm run desktop:dist:mac     # macOS
npm run desktop:dist:linux   # Linux
npm run desktop:dist:all     # All platforms
```

### Build Outputs

Built apps are placed in `dist-desktop/` at the project root:

| Platform | Files | Notes |
|----------|-------|-------|
| Windows | `.exe` installer, `.portable.exe` | NSIS installer |
| macOS | `.dmg`, `.zip` | Universal (Intel + Apple Silicon) |
| Linux | `.AppImage`, `.deb` | x64 architecture |

### Code Signing (Production)

For production releases that don't show security warnings:

#### Windows Code Signing
1. Purchase a code signing certificate from DigiCert, Sectigo, etc.
2. Set environment variables:
   ```bash
   CSC_LINK="path/to/your/certificate.pfx"
   CSC_KEY_PASSWORD="your-certificate-password"
   ```

#### macOS Code Signing
1. Enroll in Apple Developer Program ($99/year)
2. Create a "Developer ID Application" certificate
3. Set environment variables:
   ```bash
   CSC_LINK="path/to/your/certificate.p12"
   CSC_KEY_PASSWORD="your-certificate-password"
   APPLE_ID="your-apple-id@example.com"
   APPLE_ID_PASSWORD="app-specific-password"
   APPLE_TEAM_ID="ABC123XYZ"
   ```

### Distribution Options

#### GitHub Releases (Recommended)
The desktop app is configured to publish to GitHub releases. To use:

1. Create a GitHub personal access token with `repo` scope
2. Set environment variable: `GH_TOKEN=your-token`
3. Run: `npm run desktop:dist`
4. Electron-builder will create a GitHub release with assets

#### Manual Distribution
1. Build the app: `npm run desktop:dist:all`
2. Upload files from `dist-desktop/` to your website
3. Link to downloads from the `/web/download` page

### Auto-Updates
The app checks GitHub releases for updates automatically. When you create a new release, users will be prompted to update.

---

## References

- [Expo EAS Build Docs](https://docs.expo.dev/build/introduction/)
- [EAS Submit Docs](https://docs.expo.dev/submit/introduction/)
- [Apple App Store Guidelines](https://developer.apple.com/app-store/guidelines/)
- [Google Play Console Guide](https://support.google.com/googleplay/android-developer/)
