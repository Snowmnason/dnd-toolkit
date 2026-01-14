# Lazy Loading & Bundle Optimization

## Overview

The app uses dynamic imports and background loading to reduce startup time and bundle size. Heavy modules (Sentry, themes, fonts) load only when needed or in the background, keeping the initial bootstrap fast.

## Architecture

### Core Utilities

All lazy-loading operations use `lib/utils/lazy-imports.ts`:

```typescript
// Load module on-demand with error handling
export async function lazyLoad<T>(
  importFn: () => Promise<T>,
  moduleName: string
): Promise<T>

// Load in background without blocking
export function lazyLoadInBackground<T>(
  importFn: () => Promise<T>,
  moduleName: string
): Promise<T>

// Create lazy React component
export function createLazyComponent(
  importFn: () => Promise<any>,
  componentName: string
)
```

### Bootstrap Flow

```
App Start (index.tsx)
  ↓
Bootstrap (hooks/use-app-bootstrap.tsx)
  ├─ Load Fonts (~8ms)
  ├─ Load Platform (~0ms)
  └─ Themes start loading in background
  ↓
App Ready (~14ms) ← User sees UI
  ↓
Background Loading (non-blocking)
  ├─ Themes complete (~365ms)
  └─ Sentry initializes (if enabled)
```

### What Loads When

| Module | When | Blocking | Location |
|--------|------|----------|----------|
| Fonts | Bootstrap | No* | `use-app-bootstrap.tsx` |
| Platform | Bootstrap | Yes | `use-app-bootstrap.tsx` |
| Themes | Background | No | `use-app-bootstrap.tsx` |
| Sentry | Background (if enabled) | No | `app/_layout.tsx` |
| Route screens | On navigation | N/A | Expo Router |

*Font loading itself doesn't block, but web font injection is synchronous

## Usage Patterns

### Pattern 1: Load on Demand

Use this for modules that aren't needed until a specific action:

```typescript
import { lazyLoad } from '@/lib/utils/lazy-imports';

async function doSomething() {
  try {
    const Module = await lazyLoad(
      () => import('./HeavyModule'),
      'HeavyModule'
    );
    
    // Use the module
    Module.doWork();
  } catch (error) {
    console.error('Failed to load module');
  }
}
```

**When to use:**
- Modal components that aren't always shown
- Admin-only features
- Style showcases (StyleDesktop)
- Uncommon features

**Logs output:**
```
[lazy-load] ✅ HeavyModule loaded (234ms)
```

### Pattern 2: Load in Background

Use this for modules that should eventually load but don't block startup:

```typescript
import { lazyLoadInBackground } from '@/lib/utils/lazy-imports';

// In app initialization
lazyLoadInBackground(
  () => import('@sentry/react-native'),
  'Sentry'
).catch(() => {
  console.warn('Sentry failed to load');
});
```

**When to use:**
- Monitoring/analytics (Sentry)
- Non-critical themes
- Optional feature detection
- Secondary fonts

**Logs output:**
```
[lazy-load] ✅ Sentry loaded (150ms)
```

### Pattern 3: Lazy React Component

Use this for route screens or heavy components:

```typescript
import { createLazyComponent } from '@/lib/utils/lazy-imports';

const LazyStyleDesktop = createLazyComponent(
  () => import('./StyleDesktop'),
  'StyleDesktop'
);

export default LazyStyleDesktop;
```

**When to use:**
- Route screens (handled by Expo Router automatically)
- Modals opened on specific actions
- Heavy debug screens
- Feature showcases

## Real-World Examples

### Example 1: Sentry (Background Loading)

**Location:** `app/_layout.tsx`

```typescript
import { lazyLoadInBackground } from '@/lib/utils/lazy-imports';

const config = getAppConfig();
const isSentryEnabled = config.features?.sentryEnabled ?? false;

if (isSentryEnabled && sentryDsn) {
  lazyLoadInBackground(
    async () => {
      const Sentry = await import('@sentry/react-native');
      Sentry.init({
        dsn: sentryDsn,
        // ... config
      });
      return Sentry;
    },
    'Sentry'
  ).catch((error) => {
    logger.warn('[Sentry] Failed to initialize:', error);
  });
}
```

**Why this works:**
- Sentry loads after bootstrap (doesn't block startup)
- When disabled, completely absent from bundle
- Non-critical, so failures are logged but ignored

### Example 2: Themes (Background Loading)

**Location:** `hooks/use-app-bootstrap.tsx`

```typescript
// Load themes in background (non-blocking)
preloadThemes().then(() => {
  blog.debug("bootstrap", `✅ Themes preloaded in background`);
}).catch((err) => {
  blog.warn("bootstrap", "Background theme preload failed:", err);
});
```

**Why this works:**
- Happens after `App Ready` message
- User sees UI while themes load
- Themes available by time user navigates

### Example 3: Fonts (Critical Path)

**Location:** `hooks/use-app-bootstrap.tsx`

```typescript
async function loadFonts() {
  // On web, inject fonts.css (synchronous, very fast)
  if (Platform.OS === "web") {
    await injectWebFonts();
    return;
  }
  
  // On native, load via expo-font
  await Font.loadAsync(criticalFonts);
}
```

**Why this works:**
- Fonts are critical for layout, so loaded early
- Web injection is instant (~1ms)
- Native loading is fast and non-blocking with timeout

## Performance Metrics

### Bootstrap Timeline

Measure with browser DevTools or logs:

**Web (Chrome DevTools):**
1. Open Network tab, filter by XHR
2. Look for timing of font injection (should be <10ms)
3. Check Console for bootstrap logs

**Logs to watch:**
```
[BOOTSTRAP] 🚀 Starting app bootstrap...
[BOOTSTRAP] 🌐 Web fonts stylesheet injected
[PERFORMANCE] Bootstrap completed {totalTime: 14, ...}
[OTHER] All themes preloaded successfully
```

### What's Expected

| Step | Time | Notes |
|------|------|-------|
| Fonts | 5-10ms | Web injection or native loading |
| Platform | <1ms | Minimal work |
| App Ready | ~14ms | User sees UI |
| Themes (background) | 300-400ms | Completes while user reads welcome |

### Monitoring

Enable timing logs by setting:

```typescript
const BOOTSTRAP_LOGS = true; // In use-app-bootstrap.tsx
```

Check performance category:

```
[PERFORMANCE] Bootstrap completed {
  totalTime: 14,
  breakdown: { fonts: 8, themes: 0, platform: 0 },
  platform: 'web'
}
```

## Best Practices

### When to Use Lazy Loading

✅ **Use lazy loading for:**
- Modules that are always optional (Sentry with feature flag)
- Non-critical features (theme variants)
- Heavy components shown on specific routes
- Debug/admin screens
- Analytics/monitoring libraries

❌ **Don't use for:**
- Critical UI bootstrap (themes, fonts structure)
- Core navigation components
- Authentication logic
- State management

### Error Handling

Always handle failures gracefully:

```typescript
lazyLoadInBackground(
  () => import('./Module'),
  'Module'
).catch((error) => {
  logger.warn('Module failed to load:', error);
  // App continues working without it
});
```

### Testing

Test that lazy-loaded modules:
- Don't block initial render
- Load successfully when accessed
- Fail gracefully if import fails
- Don't appear in bundle when conditionally disabled

```typescript
// Check bundle size with Sentry disabled
npm run predeploy  // Builds for web
# Check dist/ folder size
```

### Naming Convention

Use clear names for lazy-loaded modules:

```typescript
// Good
await lazyLoad(
  () => import('./StyleDesktop'),
  'StyleDesktop'  // ← Clear, matches component name
)

// Avoid
await lazyLoad(
  () => import('./components/desk'),
  'Thing'  // ← Unclear name
)
```

## Troubleshooting

### Module Still in Bundle When Should Be Lazy

**Problem:** Sentry is still in the bundle even with feature flag disabled  
**Solution:** Check that you're using dynamic `import()`, not static imports:

```typescript
// Wrong - static import, always bundled
import * as Sentry from '@sentry/react-native';

// Right - dynamic import, lazy
await import('@sentry/react-native');
```

### Lazy-Loaded Module Causes Error

**Problem:** "Cannot find module" error when lazy loading  
**Solution:** Verify the import path is correct:

```typescript
// Correct
() => import('@sentry/react-native')

// Incorrect
() => import('sentry')  // Missing namespace
```

### Bootstrap Still Slow

**Problem:** App still takes >100ms to show UI  
**Solution:** Check that non-critical work is happening in background:

1. Verify themes are NOT awaited in bootstrap
2. Verify Sentry is using `lazyLoadInBackground`
3. Check no other heavy imports in bootstrap path
4. Use DevTools to profile: DevTools → Performance → Record → Load page

### Module Loads Twice

**Problem:** "Module loaded (234ms)" appears twice in logs  
**Solution:** Check that `lazyLoadInBackground` isn't called multiple times:

```typescript
// Wrong - called on every render
<Component>
  {lazyLoadInBackground(...))}
</Component>

// Right - called once at app init
app/_layout.tsx top-level  // Runs once
```

## Advanced: Custom Lazy Loading

For complex scenarios, create custom wrappers:

```typescript
// Lazy load with retry
export async function lazyLoadWithRetry(
  importFn,
  moduleName,
  maxRetries = 3
) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await lazyLoad(importFn, moduleName);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}
```

## Related

- [Themes & Fonts Guide](../103%20-%20Themes%20%26%20Fonts/THEMES_AND_FONTS.md) — Font loading details
- `lib/utils/lazy-imports.ts` — Implementation
- `hooks/use-app-bootstrap.tsx` — Bootstrap sequence
- `app/_layout.tsx` — Sentry lazy-loading example
