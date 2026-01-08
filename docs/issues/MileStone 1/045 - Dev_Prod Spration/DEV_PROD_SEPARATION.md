# Dev/Prod Environment Separation

## Overview

The dnd-toolkit uses a build-time environment separation system to control which features are available in development vs. production. This ensures dev-only code is completely removed from production builds and cannot be accidentally exposed to users.

## Configuration Files

### `config/appsettings.dev.json`
Development-only settings. Controls:
- **features**: Core dev/test functionality (debug logs, console logging, dev bypass, mock data)
- **overrides**: Override flags for specific behaviors
- **devTools**: Runtime toggles for loggers (console, network, performance, Redux, React DevTools)

All settings default to **enabled** to maximize developer visibility during local testing.

### `config/appsettings.json`
Production settings. All dev features are **disabled** for safety and performance. Beta flags enabled in production will log a warning at startup.

Never modify these by hand in production. They are controlled by the build system.

## Loading Configuration

### How It Works

The `lib/config/loader.ts` module provides:

```typescript
import { getAppConfig, isDevelopment, isProduction } from '@/lib/config/loader';

const config = getAppConfig(); // Cached after first call
const isDev = isDevelopment();  // Checks EXPO_PUBLIC_ENVIRONMENT
const isProd = isProduction();  // Safe fallback
```

**At build time**, the environment is determined by `process.env.EXPO_PUBLIC_ENVIRONMENT`:
- **Not set or `production`**: Loads `appsettings.json`
- **`development`**: Loads `appsettings.dev.json`

This selection happens at bundle time, so the unused appsettings file and all dev code are tree-shaken from production builds.

## Using Dev-Only Features

### Dev Console Logging

```typescript
import { useDevConsole } from '@/lib/config/dev-only';

const devLog = useDevConsole('MyComponent');
devLog.log('This only appears in dev'); // Controlled by config.devTools.enableConsoleLogger
```

In production, `useDevConsole()` returns a no-op logger that's completely optimized away.

### Dev Bypass (Testing)

```typescript
import { canBypassFeature } from '@/lib/config/dev-only';

if (canBypassFeature('devBypass')) {
   // Dev-only bypass example (use a guarded feature key)
}
// In production, this always returns false
```

### Dev Assertions

```typescript
import { devAssert } from '@/lib/config/dev-only';

devAssert(user !== null, 'User should be loaded');
// Throws only in dev with verbose error; no-op in production
```

### Performance Monitoring

```typescript
import { createDevTimer } from '@/lib/config/dev-only';

const timer = createDevTimer('DataFetch');
// ... do work
timer.end(); // Logs timing in dev if enabled, no-op in prod
```

## Feature Flags Integration

Feature flags now live inside `config/appsettings.*.json` under `featureFlags` and are read via `lib/feature-flags.ts`. A helper exists to toggle all flags by `kind` (free/premium/beta), and production builds will warn if any beta flags are enabled:

```typescript
import { getAppConfig } from '@/lib/config/loader';
import featureFlagsManager from '@/lib/feature-flags';

const config = getAppConfig();

// In dev, override specific feature flags for testing
if (config.features.mockData) {
  // Enable mock mode
}
```

## Build-Time Environment Setup

### Setting the Environment

**Local Development (Expo CLI)**
```bash
# Set environment before running
export EXPO_PUBLIC_ENVIRONMENT=development
npm run web
```

**Production Build (GitHub Pages)**
The deployment workflow (`pages.yml`) does NOT set `EXPO_PUBLIC_ENVIRONMENT`, so it defaults to `production`.

**Desktop Releases**
Update `eas.json` or build scripts to ensure `EXPO_PUBLIC_ENVIRONMENT` is NOT set for desktop releases (defaults to production).

### Verification

After building, verify the environment:
1. **Dev Build**: Check `__DEV__` in browser console (should be `true`)
2. **Prod Build**: Check for stripped dev code (use bundle analyzer)

```bash
npm run predeploy -- --report  # Generates bundle report
```

## Important Constraints

⚠️ **These rules must be followed to maintain security:**

1. **Never export dev-only features from production builds**
   - All dev imports use `isDevelopment()` guards
   - Tree-shaking removes dead code

2. **Never use dev settings at runtime in production**
   - Configuration is loaded at build time
   - Runtime checks are redundant but safe

3. **Always import from `lib/config/dev-only` for dev code**
   - Don't import directly from `appsettings.dev.json`
   - Use the helper functions instead

4. **Document when you use dev-only features**
   - Add comments explaining why the bypass is needed
   - Example: `// Dev bypass for faster testing during local feature development`

5. **Review PRs that use dev-only code**
   - Ensure dev code is properly guarded
   - Verify it cannot run in production

## Troubleshooting

**Q: My dev settings aren't being used**
- Check `EXPO_PUBLIC_ENVIRONMENT=development` is set before build
- Verify `config/appsettings.dev.json` exists and is valid JSON
- Clear cache: `npm run reset-project`

**Q: Dev features are in my production build**
- Ensure `EXPO_PUBLIC_ENVIRONMENT` is NOT set during production builds
- Use bundle analyzer to verify dead code removal
- Check that guards use `isDevelopment()` correctly

**Q: I need a new dev-only feature**
- Add to `appsettings.dev.json` (all enabled)
- Add to `appsettings.json` (all disabled)
- Update `AppSettings` interface in `lib/config/loader.ts`
- Create helper function in `lib/config/dev-only.ts`
- Document usage above

## Files Reference

- **Config Files**: `config/appsettings.{dev,json}` (dev file stripped from prod builds)
- **Config Loader**: `lib/config/loader.ts` (environment detection)
- **Dev Helpers**: `lib/config/dev-only.ts` (guarded dev functions)
- **Feature Flags**: `lib/feature-flags.ts` (can be enhanced with dev overrides)
- **Build Settings**: `eas.json`, `app.json` (ensure `EXPO_PUBLIC_ENVIRONMENT` behavior is documented); production/desktop predeploy runs `scripts/strip-dev-appsettings.js` to remove `appsettings.dev.json` from exported bundles

