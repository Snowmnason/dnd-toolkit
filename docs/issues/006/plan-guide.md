# DnD Toolkit: Desktop & Mobile Download Support Plan

## Overview
Make DnD Toolkit downloadable on iOS, Android, macOS, Windows, and Linux - similar to Discord's multi-platform distribution model.

---

## Architecture Strategy

### Current State
- **React Native + Expo Router** - Cross-platform foundation
- **Web**: Hosted on `dnd-tool.thesnowpost.com`
- **Mobile**: Can build via Expo
- **Desktop**: Not yet available

### Target State (Discord Model)
```
dnd-tool.thesnowpost.com
├── Web (Browser)
├── Download page
│   ├── Desktop (Windows, macOS, Linux)
│   │   └── Electron wrapper OR native builds
│   ├── Mobile (iOS via App Store, Android via Google Play)
│   └── Direct download links
└── Account sync across platforms
```

---

## Platform-by-Platform Approach

### 1. MOBILE (iOS & Android)

#### Option A: Expo Build (Recommended) ✅
**Pros:**
- Already using Expo - minimal new infrastructure
- One codebase for both iOS/Android
- OTA updates without app store resubmission
- Faster iteration

**Cons:**
- Requires Apple Developer ($99/yr) + Google Play ($25 one-time)
- App Store review process (1-3 days for iOS)
- Google Play less strict

**Steps:**
1. Create App Store Connect account (Apple)
2. Create Google Play Developer account
3. Generate app signing certificates/keys
4. Use `expo build` or `eas build` (EAS = Expo's managed build service)
5. Submit to App Store and Google Play
6. Implement in-app updates with `expo-updates`

**Cost:** ~$125 setup + ongoing

---

### 2. DESKTOP (Windows, macOS, Linux)

#### Option A: Electron (Recommended) ✅
**Use your React codebase in Electron**

**Pros:**
- Reuse 80% of your React code (theme, UI components, hooks)
- Web builds already work - minimal changes
- Single repo for desktop + web
- Easy distribution (installers, auto-updates)

**Cons:**
- Larger app size (~150-200MB)
- Performance slightly slower than native

**Tech Stack:**
- Electron for window management
- Vite/webpack for bundling React web build
- electron-builder for installers
- electron-updater for auto-updates

**File Structure:**
```
dnd-toolkit/
├── packages/
│   ├── desktop/
│   │   ├── src/
│   │   │   ├── main.ts (Electron main process)
│   │   │   ├── preload.ts (IPC bridge)
│   │   │   └── ...
│   │   ├── electron-builder.json (config)
│   │   └── package.json
│   └── web/
│       └── (your current web build)
└── ...
```

**Steps:**
1. Create `packages/desktop` folder with Electron setup
2. Build web app to static HTML/CSS/JS
3. Electron serves local build
4. Use electron-builder for Windows/macOS/Linux installers
5. Implement auto-updates with electron-updater
6. Sign binaries for distribution

**Cost:** Free (open source)

#### Option B: Tauri
**Alternative to Electron**

**Pros:**
- Smaller bundle size (~50-100MB)
- Better performance
- Simpler IPC model

**Cons:**
- Smaller ecosystem
- Rust backend required
- Less mature than Electron

---

### 3. WEB
**Keep as-is** - already hosted and working
- Continue deployment to `dnd-tool.thesnowpost.com`
- Progressive Web App (PWA) support for "install to home screen"

---

## Implementation Roadmap

### Phase 0: Infrastructure Prep (Current) ✨
**Goal:** Set up configuration files and placeholders - ready to go when we need it

This phase prepares the project structure WITHOUT implementing the actual builds yet. We add config files with blank/placeholder keys so the foundation is ready.

#### Mobile (iOS & Android) Prep
1. **Update `app.json`** with:
   - Full app metadata (description, privacy policy, etc.)
   - iOS bundle identifier: `com.thesnowpost.dndtoolkit`
   - Android package name: `com.thesnowpost.dndtoolkit`
   - Version numbers and deployment targets
   - EAS project ID placeholder

2. **Create `eas.json`** with:
   - Build profiles (dev, preview, production) - all configured but empty
   - Submit profiles (TestFlight, Play Store) - ready with placeholders
   - Credentials placeholders for signing keys (blank for now)

3. **Create `.env.build`** with placeholders:
   ```
   # iOS Signing (fill in when ready)
   APPLE_ID=""
   APPLE_PASSWORD=""
   APPLE_TEAM_ID=""
   
   # Android Signing (fill in when ready)
   ANDROID_KEYSTORE_PASSWORD=""
   ANDROID_KEY_PASSWORD=""
   ```

4. **Update `package.json`** with build scripts:
   ```json
   "build:ios": "eas build --platform ios",
   "build:android": "eas build --platform android",
   "build:mobile": "eas build --platform all"
   ```

#### Desktop (Electron) Prep
1. **Create `electron-builder.json`** with:
   - Output configuration for Windows (.exe), macOS (.dmg), Linux (.AppImage)
   - Auto-update settings (GitHub releases)
   - Code signing placeholders (empty for now)
   - App icon paths

2. **Create `packages/desktop/` folder structure**:
   ```
   packages/desktop/
   ├── src/
   │   ├── main.ts (Electron main process - skeleton)
   │   ├── preload.ts (IPC bridge - skeleton)
   │   └── index.html
   ├── electron-builder.json
   └── package.json
   ```

3. **Create `.env.desktop`** with placeholders:
   ```
   # Code Signing (fill in when ready)
   CSC_LINK=""
   CSC_KEY_PASSWORD=""
   APPLE_ID=""
   APPLE_PASSWORD=""
   ```

4. **Update `package.json`** with build scripts:
   ```json
   "build:desktop": "electron-builder",
   "build:desktop:win": "electron-builder --win",
   "build:desktop:mac": "electron-builder --mac",
   "build:desktop:linux": "electron-builder --linux"
   ```

#### CI/CD Prep
1. **Create `.github/workflows/build.yml`** with:
   - Automated build triggers on main branch
   - Conditional builds (mobile, desktop, web)
   - Environment variable placeholders
   - All steps outlined but no actual credentials

#### Documentation
1. **Create `docs/BUILD.md`** with:
   - Step-by-step guide to fill in credentials
   - Which keys go where
   - How to generate certificates/keys
   - Testing before submission

**Status:** All files created with empty/placeholder values. Nothing built yet.
**Time to implement:** ~4 hours
**Dependencies:** None - just config files

---

### Phase 1: Mobile Apps (Months 1-2)
**Goal:** iOS & Android on app stores

1. **Set up developer accounts**
   - Apple Developer: `developer.apple.com`
   - Google Play: `play.google.com/console`

2. **Prepare Expo for build**
   ```bash
   eas init  # Initialize EAS Build
   eas build --platform ios
   eas build --platform android
   ```

3. **Configure app metadata**
   - App icons (all sizes)
   - Screenshots for app stores
   - Description, keywords, pricing
   - Privacy policy & terms

4. **Testing**
   - TestFlight (iOS beta testing)
   - Google Play internal testing track

5. **Submit to stores**
   - App Store review (1-3 days)
   - Google Play review (2-24 hours)

**Deliverables:**
- iOS app on App Store
- Android app on Google Play
- Automatic OTA update pipeline

---

### Phase 2: Desktop App (Months 2-3)
**Goal:** Windows, macOS, Linux installers

1. **Set up Electron project**
   ```bash
   npm create electron-app dnd-desktop
   # OR manually add electron + electron-builder
   ```

2. **Configure builds**
   - Windows installer (.exe)
   - macOS installer (.dmg)
   - Linux AppImage (.AppImage)

3. **Code signing** (security)
   - Windows: Code signing certificate
   - macOS: Developer certificate + notarization
   - Linux: Optional GPG signing

4. **Testing**
   - Test on all platforms (or use CI/CD)
   - Test auto-update mechanism

5. **Distribution**
   - GitHub Releases for direct downloads
   - Website download page
   - Automatic update checks on launch

**Deliverables:**
- Electron desktop app
- Installers for all platforms
- Auto-update system
- Download page on website

---

### Phase 3: Download Page & Account Sync (Month 3)
**Goal:** Unified download experience + cross-platform sync

1. **Create download landing page**
   - Detect platform (Windows/macOS/Linux/iOS/Android)
   - Show appropriate download button
   - Version info, changelog, release notes

2. **Cross-platform account sync**
   - Supabase already handles auth
   - Implement sync for:
     - User preferences
     - Theme settings
     - World/campaign data
     - Last session state

3. **Analytics**
   - Track downloads per platform
   - Monitor update adoption

**Deliverables:**
- Download page at `dnd-tool.thesnowpost.com/download`
- Seamless sync across devices

---

## Technical Decisions

### Data Sync Strategy
```
Mobile/Desktop ←→ Supabase ←→ Web
All platforms sync through your existing Supabase backend
No need to duplicate data
```

### Update Strategy
- **Mobile:** Use `expo-updates` for quick patches, app store for major updates
- **Desktop:** electron-updater for all updates (staging + production channels)
- **Web:** Standard deployment

### Storage
- **Mobile:** Async Storage (already using)
- **Desktop:** Electron userData folder (`~/.config/dnd-toolkit/`)
- **Web:** localStorage

---

## CI/CD Pipeline

### Automated Builds
```
Branch: main
↓
CI/CD triggers:
├── Web: Deploy to GitHub Pages → dnd-tool.thesnowpost.com
├── Mobile: Build with EAS → TestFlight & Play Store beta
└── Desktop: Build with electron-builder → GitHub Releases
↓
QA Testing
↓
Release to production
```

**Tools:**
- GitHub Actions for automation
- EAS for mobile builds
- electron-builder for desktop builds

---

## Cost Breakdown

### One-time Costs
- Apple Developer Account: $99
- Google Play Developer: $25
- Code signing certificate (macOS): ~$0 (free Apple cert) or $299 (3rd party)
- Code signing certificate (Windows): ~$250/year
- **Total:** ~$374-600

### Recurring Costs
- Apple Developer: $99/year
- Code signing (if 3rd party): ~$300/year
- Supabase (already using for web): Variable based on usage
- EAS Build (Expo): Free tier or $99/month for advanced features
- **Total:** ~$100-400/year

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| App Store rejection | Early testing, clear compliance with guidelines |
| Breaking changes across platforms | Comprehensive testing matrix before release |
| Large app size for desktop | Code splitting, lazy loading |
| Complexity of maintaining 3+ platforms | Shared codebase, automated testing |
| Performance issues on older devices | Profiling, optimization, minimum device requirements |

---

## Recommended Timeline

```
Week 1-2:   Plan & setup (developer accounts, project structure)
Week 3-6:   Mobile builds (iOS & Android)
Week 7-10:  Desktop app (Electron setup, installers)
Week 11-12: Testing across all platforms
Week 13:    Launch mobile + desktop
Week 14+:   Monitor, iterate, release updates
```

**Total: ~3-4 months for full launch**

---

## Next Steps

### Immediate (Infrastructure Prep - Phase 0)
**Status: READY TO START**

1. **Add iOS/Android metadata to `app.json`**
   - Bundle IDs, version info, deployment targets

2. **Create `eas.json`** with build profiles (empty credentials)

3. **Create `electron-builder.json`** for desktop (empty signing)

4. **Create `.env.build` and `.env.desktop`** with blank placeholders

5. **Add build scripts to `package.json`**

6. **Create `docs/BUILD.md`** - credential filling guide

### Later (When Ready)
1. **Register Apple Developer account** → Fill in APPLE_ID, APPLE_TEAM_ID
2. **Register Google Play account** → Get signing keys
3. **Generate code signing certificates** → Fill in CSC_LINK, CSC_KEY_PASSWORD
4. **Run Phase 1:** `npm run build:mobile`
5. **Run Phase 2:** `npm run build:desktop`

---

## Reference Links

- [Expo EAS Build](https://docs.expo.dev/build/introduction/)
- [Electron Documentation](https://www.electronjs.org/docs)
- [electron-builder](https://www.electron.build/)
- [Apple Developer Program](https://developer.apple.com/programs/)
- [Google Play Console](https://play.google.com/console/)
