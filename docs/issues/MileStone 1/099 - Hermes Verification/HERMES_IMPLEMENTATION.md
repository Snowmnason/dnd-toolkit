# Hermes Engine Configuration & Release Process

## Overview

This document outlines how Hermes is configured, validated, and maintained across the native build pipeline.

## Configuration Details

**Location:** [app.json](../../../../app.json)

```json
{
  "expo": {
    "ios": {
      "hermes": true
    },
    "android": {
      "hermes": true
    }
  }
}
```

When enabled:
- iOS: Hermes bytecode compiler runs during the build; artifacts are included in the app binary
- Android: Hermes is linked through the Android build system (Gradle) and React Native's native modules, compiled at build time for the target architecture (arm64-v8a, armeabi-v7a, etc.)
- Web: Not applicable (uses browser JS engine)
- Desktop: Not applicable (uses Chromium/V8)

## Build Pipeline

1. **EAS Build** (iOS/Android)
   - `eas build --platform android --profile production` reads `app.json` and `eas.json`
   - Hermes is enabled by default if `app.json` has `hermes: true`
   - No special flags or environment variables needed

2. **Local Build** (iOS/Android)
   - `npm run android` → uses `eas.json` preview config or local Gradle
   - `npm run ios` → uses `eas.json` preview config or local Xcode
   - Hermes is enabled if `app.json` has `hermes: true`

3. **Bytecode Compilation**
   - Happens at build time, not runtime
   - Reduces startup time and memory footprint
   - Cannot be toggled post-build

## Release Checklist

Before submitting a new build to app stores:

- [ ] **Pre-flight**: `app.json` contains `hermes: true` for iOS and Android
- [ ] **Post-build iOS**: Open Xcode build logs, search for `Hermes` or `HERMES_ENABLED=YES`
- [ ] **Post-build Android**: `adb logcat | grep -i hermes` shows engine version on first launch
- [ ] **Startup test**: Measure with `nativeStartTime()` from [lib/utils/startup-time.ts](../../../../lib/utils/startup-time.ts) (cold startup expected ~50–200ms faster than V8)
- [ ] **Smoke test**: App launches without crashes; no Sentry errors related to "Hermes"
- [ ] **Document**: Add startup time to release notes if measured

## Verification Commands

### Verify iOS Build
```bash
# After building with eas build --platform ios --profile production
grep -i "HERMES_ENABLED" build.log
# or open Xcode: Build Settings → search "HERMES_ENABLED"
```

### Verify Android Build
```bash
# After building with eas build --platform android --profile production
# Install APK and check Logcat
adb logcat | grep -i hermes

# Expected output:
# com.thesnowpost.dndtoolkit I/ReactNative: Hermes Engine version X.Y.Z
# com.thesnowpost.dndtoolkit I/ReactNative: Using Hermes engine
```

### Measure Startup Time
```ts
import { nativeStartTime } from '@/lib/utils/startup-time'

function logStartupMetrics() {
  const startupMs = nativeStartTime()
  if (startupMs > 0) {
    console.log(`[PERF] App startup time: ${startupMs}ms`)
  }
}
```

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Logcat shows "Using V8" | `hermes: false` or missing in `app.json` | Add `"hermes": true` to ios/android; rebuild |
| Build fails: "Hermes not found" | iOS deployment target < 14.0 or Android minSdkVersion < 24 | Check `app.json`; currently set to 14.0 and 24 |
| No startup improvement | Hermes enabled but cold startup cache warm | Uninstall app, clear cache, measure cold startup only |
| App crashes with Hermes | Rare; usually related to native module incompatibility | File issue with stack trace to Sentry; consider disabling temporarily |

## Disabled Hermes (if needed)

Set `"hermes": false` in `app.json` iOS/Android configs, commit, rebuild, and monitor.

## Maintenance

- Review Hermes version in new Expo SDK updates
- Monitor crash reports (Sentry) post-release
- Re-measure startup time after major dependency updates
- Update this doc if Hermes config or EAS workflow changes
