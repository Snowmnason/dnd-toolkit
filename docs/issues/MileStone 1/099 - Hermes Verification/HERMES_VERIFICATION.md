# Hermes Engine Verification & Configuration

Hermes is React Native's JavaScript engine, optimized for mobile performance (startup time, memory, runtime responsiveness). This guide explains how it's configured and how to verify it's active in release builds.

## Configuration

Hermes is enabled in [app.json](../../../../app.json) for both platforms:

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

No additional EAS build configuration is required—Hermes is compiled into the native builds automatically.

## Verification Checklist

### Before Building (Pre-flight)
- [ ] Confirm `app.json` contains `"hermes": true` in both `ios` and `android` configs
- [ ] Confirm no `eas.json` overrides disable Hermes (check `build.production` sections)

### After Building (Post-build)

#### iOS (via Xcode)
1. Build the app via EAS or local Xcode
2. Open `Build Settings` → search for `HERMES_ENABLED`
3. Verify it's set to `YES` (or `1`)
4. Check console logs during build for `Linking with Hermes`

#### Android (via Logcat)
1. Build and install the APK/AAB via EAS or `npm run android`
2. Open Logcat: `adb logcat | grep -i hermes`
3. Look for messages like:
   - `Hermes Engine version X.Y.Z`
   - `Using Hermes engine` (not "Using V8" or "Using JSC")
4. App should start noticeably faster than V8 builds

#### Web (N/A)
Web builds do not use Hermes—they use the browser's native JS engine.

#### Desktop (N/A)
Desktop builds use Electron/Chromium with V8, not Hermes.

## Startup Time Measurement

Use `nativeStartTime()` from [lib/utils/startup-time.ts](../../../../lib/utils/startup-time.ts) to measure app startup before/after Hermes verification:

```ts
import { nativeStartTime } from '@/lib/utils/startup-time'

const startupMs = nativeStartTime()
console.log(`App started in ${startupMs}ms`)
```

On native builds, this returns the time from app launch to bridge initialization. On web/desktop, it returns `0` (not applicable).

## Troubleshooting

**Hermes not detected in Logcat:**
- Confirm `hermes: true` in `app.json`
- Clear build cache: `npm run reset-project`
- Rebuild with `npm run android` or `eas build --platform android --profile production`

**Build fails with Hermes error:**
- Check iOS deployment target is ≥ 14.0 (currently set in `app.json`)
- Ensure Android minSdkVersion is ≥ 24 (currently set)

**Performance not improving:**
- Hermes bytecode is compiled at build time; effects are most visible on cold startup
- Memory savings are gradual; profile app memory usage with Android Studio or Xcode

## CI/Release Notes

When releasing a new version:
1. Run the checklist above before submitting to stores
2. Document startup time in release notes if measured
3. Monitor crash reports post-release (Sentry) for any Hermes-specific issues
4. If major perf regression appears, file issue and consider disabling Hermes temporarily (set `hermes: false` in `app.json`)
