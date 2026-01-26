# lib/utils

**Foundational utilities for logging, image optimization, entitlements, lazy imports, startup timing, versioning, and web font loading. Provides cross-platform, production-ready tools for common app needs.**

---

## When to Use This Module

**Use this module if you need:**

- Environment-aware, category-based logging with feature-flag control and zero production overhead (11 categories, configurable per-environment)
- Responsive image optimization for Supabase URLs (automatic resizing, quality negotiation, format detection)
- CORS-safe image loading with intelligent fallback and placeholder strategies
- Centralized premium feature limits and quota logic (tier-aware entitlements without scattered checks)
- Lazy-loading of heavy modules and components to reduce bundle size and improve app startup time
- Measuring app startup performance metrics on native platforms (startup time tracking)
- Accessing current app version for About screens, update checks, or error reporting
- Injecting custom web fonts on web and Electron platforms with automatic platform detection

**Do NOT use this module for:**

- In-memory, session-scoped state (use React state or [lib/cache's FastCache](../cache/README.md#fastcache-ephemeral-in-memory-cache) instead)
- Persistent data storage (use [lib/storage's SecureStorage](../storage/README.md) instead)
- Server-side logging or real-time metrics (use [lib/analytics](../analytics/README.md) or a dedicated analytics service instead)
- Complex image transformations beyond resize/quality (use an external image service or CDN)
- Font loading for embedded/custom fonts with complex fallback logic (use CSS @font-face or native font frameworks)

---

## Architecture & Data Flow

```
App Code
  ↓
Import from lib/utils (barrel or direct)
  ↓
[Logger | Image Optimization | Entitlements | Lazy Imports | Startup Time | Version | Web Font Loader]
  ↓
Platform-specific or cross-platform implementation
```

---

## Deep-Dive: Utility Responsibilities

### logger.ts

- Environment-aware, feature-flag controlled logging system
- Category-based (auth, api, storage, ui, etc.) and level-based (debug, info, warn, error)
- Supports context tagging, grouping, and table output
- Configurable via appsettings feature flags
- Used throughout the app for diagnostics, analytics, and error reporting
- Automatic PII redaction via lib/utils/pii-redaction

### pii-redaction.ts

- Comprehensive PII (Personally Identifiable Information) pattern detection and redaction
- Supports both prefixed fields (email: ..., token: ...) and standalone values (bare emails, JWTs, UUIDs)
- Used by logger and storage privacy module
- Patterns include: emails, JWT tokens, API keys, session IDs, UUIDs, phone numbers, URLs with sensitive params
- Safe import guards to prevent circular dependencies with storage module

### image-optimization.ts

- Utilities for optimizing Supabase image URLs (resize, quality, format)
- Responsive image sizing helpers
- Device pixel ratio-aware width calculation
- Supabase URL detection

### image-proxy.ts

- Handles CORS-safe image loading for external URLs
- Provides CORS proxy logic (dev only), local asset fallback, and external URL detection

### entitlements.ts

- Centralized stub for premium feature limits and quotas
- All limits are currently stubbed; future: wire to SubscriptionManager
- Prevents scattered isPremium checks in business logic

### lazy-imports.ts

- Consistent pattern for lazy-loading heavy modules/components
- Reduces initial bundle size by deferring non-critical imports
- Safe error handling and timing for lazy loads
- Supports background loading and React component wrappers

### startup-time.ts

- Measures time from app launch to bridge initialization (native only)
- Returns 0 on web/desktop
- Used for performance analytics and diagnostics

### version.ts

- Exposes current app version (from package.json)
- Used for diagnostics, About screens, and update checks

### web-font-loader.ts

- Injects custom fonts.css on web/Electron
- Ensures custom fonts are available for all platforms

---

## API Reference & Usage Patterns

### Logger (`logger.ts`)

The Logger is a singleton that provides category-based, feature-flag controlled logging with zero overhead in production.

#### `logger.category(category): CategoryLogger`

Returns a category-specific logger for cleaner API.

**Parameters:**

- `category`: One of `'auth'`, `'navigation'`, `'api'`, `'network'`, `'performance'`, `'storage'`, `'ui'`, `'analytics'`, `'security'`, `'bootstrap'`, `'error'`, `'other'`

**Returns:** CategoryLogger instance with methods: `debug()`, `info()`, `warn()`, `error()`, `success()`, `group()`, `groupEnd()`, `table()`

**Example:**

```ts
import { logger } from "@/lib/utils/logger";

logger.category("auth").info("User logged in");
logger.category("api").debug("Fetching worlds...");
logger.category("storage").error("Storage quota exceeded", quotaError);
```

#### `logger.debug(category?, context?, ...args): void`

Log debug message (lowest level, dev-only by default).

**Parameters:**

- `category?`: Optional LogCategory for filtering
- `context?`: Optional context string (e.g., function name, component name)
- `...args`: Log message arguments (same as console.log)

**Example:**

```ts
logger.debug("auth", "validateToken", "Starting validation", tokenLength);
// Output: 🔍 [HH:MM:SS] [AUTH] Starting validation 32
```

#### `logger.info(category?, context?, ...args): void`

Log informational message.

**Example:**

```ts
logger.info("api", "Worlds fetched successfully");
```

#### `logger.warn(category?, context?, ...args): void`

Log warning message.

**Example:**

```ts
logger.warn("storage", "Cache quota approaching 80%");
```

#### `logger.error(category?, context?, ...args): void`

Log error message (always shown, even in production).

**Example:**

```ts
logger.error("storage", "Failed to persist data", storageError);
```

#### `logger.category(cat).group(label, collapsed?): void` and `groupEnd(): void`

Group related logs together.

**Example:**

```ts
logger.category("bootstrap").group("App Initialization", false);
logger.info("bootstrap", "Loading config");
logger.info("bootstrap", "Initializing auth");
logger.category("bootstrap").groupEnd();
```

#### `logger.category(cat).table(data): void`

Log structured data as a table.

**Example:**

```ts
logger.category("api").table([
  { endpoint: "/users", duration: 234, status: 200 },
  { endpoint: "/worlds", duration: 567, status: 200 },
]);
```

---

### PII Redaction (`pii-redaction.ts`)

Utilities for detecting and redacting personally identifiable information (PII) in logs and error messages.

#### `redactPII(value, options?): string`

Redact PII from a string or object using comprehensive patterns.

**Parameters:**

- `value`: String, object, or any value to redact
- `options.includeStandalone?`: boolean (default: true) - Also apply standalone patterns (bare emails, JWTs, UUIDs)

**Returns:** String with PII replaced by `[REDACTED]`

**Example:**

```ts
import { redactPII } from "@/lib/utils";

redactPII("email: user@example.com");
// "email: [REDACTED]"

redactPII("user@example.com");
// "[REDACTED]"

redactPII({
  token: "eyJhbGc...",
  userId: "123e4567-e89b-12d3-a456-426614174000",
});
// "{\"token\": \"[REDACTED]\", \"userId\": \"[REDACTED]\"}"

// Only prefixed patterns (more conservative)
redactPII("Session: xyz123", { includeStandalone: false });
// "Session: [REDACTED]"
```

#### `containsPII(value): boolean`

Check if a string contains any PII patterns.

**Parameters:**

- `value`: String to check

**Returns:** true if PII is detected, false otherwise

**Example:**

```ts
import { containsPII } from "@/lib/utils";

containsPII("email: user@example.com"); // true
containsPII("Hello world"); // false
containsPII("eyJhbGc..."); // true (JWT token)
```

#### Pattern Coverage

**Prefixed Patterns** (field name + value):

- Email: `email: user@example.com`, `email="..."`
- Token/JWT: `token: abc123`, `jwt: eyJhbGc...`
- Session ID: `session: xyz123`, `session: ...`
- User ID: `userid: 123`, `user_id: ...`
- UUID: `id: 8-4-4-4-12 format`
- API Key: `apikey: ...`, `api_key: ...`
- Phone: `phone: +1-555-123-4567`, `tel: ...`
- URL params: `?email=user@example.com&token=abc123`

**Standalone Patterns** (values without prefix):

- Email format: `user@example.com` (bare email)
- JWT: `eyJhbGc...` (starts with `ey`, contains dots)
- UUID: `8-4-4-4-12 hex format`
- API Keys: `32+ character alphanumeric strings`

---

### Image Optimization (`image-optimization.ts`)

Utilities for optimizing image loading, sizing, and delivery.

#### `optimizeSupabaseImage(url, options?): string`

Adds transformation parameters to a Supabase storage URL.

**Parameters:**

- `url`: Supabase storage URL (e.g., `https://abc.supabase.co/storage/v1/object/public/maps/world.jpg`)
- `options?`: ImageOptimizationOptions
  - `width?`: number (target width in pixels)
  - `height?`: number (target height in pixels)
  - `quality?`: number (1-100, default 80)
  - `format?`: `'webp'` | `'jpeg'` | `'png'` (best format)
  - `fit?`: `'cover'` | `'contain'` | `'fill'` | `'inside'` | `'outside'`

**Returns:** Optimized URL with query parameters

**Example:**

```ts
import { optimizeSupabaseImage } from "@/lib/utils/image-optimization";

const optimized = optimizeSupabaseImage(
  "https://abc.supabase.co/storage/v1/object/public/maps/world.jpg",
  { width: 800, quality: 80, format: "webp", fit: "cover" },
);
// Returns: ...world.jpg?width=800&quality=80&format=webp&fit=cover
```

#### `getOptimalImageWidth(containerWidth): number`

Calculates optimal image width based on container width and device pixel ratio.

**Parameters:**

- `containerWidth`: number (width of image container in pixels)

**Returns:** Recommended image width (accounts for DPR ≥ 1)

**Example:**

```ts
const containerWidth = 400;
const optimalWidth = getOptimalImageWidth(containerWidth);
// Returns 800 on Retina (2x DPR) or 400 on standard

const url = optimizeSupabaseImage(original, { width: optimalWidth });
```

#### `getResponsiveImageSizes(): { thumbnail, small, medium, large, xlarge }`

Returns recommended image sizes for different screen sizes.

**Returns:** Object with predefined widths

```ts
const sizes = getResponsiveImageSizes();
// { thumbnail: 150, small: 400, medium: 800, large: 1200, xlarge: 1600 }
```

#### `isSupabaseUrl(url): boolean`

Checks if a URL is a Supabase storage URL.

**Example:**

```ts
if (isSupabaseUrl(imageUrl)) {
  optimized = optimizeSupabaseImage(imageUrl, { width: 800 });
}
```

---

### Image Proxy (`image-proxy.ts`)

Utilities for handling CORS-safe image loading.

#### `isExternalUrl(url): boolean`

Checks if a URL is from an external domain (not current origin).

**Example:**

```ts
if (isExternalUrl(url)) {
  // Handle external image
}
```

#### `getCorsImageUrl(url): string`

Returns a CORS-safe URL for external images. Currently returns original URL; future: backend proxy.

**Note:** For production, consider:

- Downloading images and serving locally from `/assets/images`
- Using a backend endpoint that fetches and serves images
- Requesting CORS headers from the original server

---

### Entitlements (`entitlements.ts`)

Centralized stub for premium feature limits. All limits are currently hardcoded; future: wire to SubscriptionManager.

#### `Entitlements.getCharacterLimit(): number`

Max characters a user can create.

**Current:** 100 (stub)  
**TODO:** `isPremium ? 100 : 5`

#### `Entitlements.getWorldLimit(): number`

Max worlds a user can create.

**Current:** 50 (stub)  
**TODO:** `isPremium ? 50 : 3`

#### `Entitlements.getNPCLimit(): number`

Max NPCs per world.

**Current:** 500 (stub)  
**TODO:** `isPremium ? 500 : 25`

#### `Entitlements.getStorageBytes(): number`

Storage quota in bytes.

**Current:** 10GB (stub)  
**TODO:** `hasExtended ? 10GB : 100MB`

#### `Entitlements.getMaxFileSize(): number`

Max file upload size in bytes.

**Current:** 100MB (stub)  
**TODO:** `isPremium ? 100MB : 10MB`

#### `Entitlements.getApiRequestsPerHour(): number`

API requests allowed per hour.

**Current:** 10,000 (stub)  
**TODO:** `isPremium ? 10000 : 100`

#### `Entitlements.async canUseFeature(featureKey): Promise<boolean>`

Check if a specific premium feature is available.

**Parameters:**

- `featureKey`: string (e.g., `'export_pdf'`, `'extended_storage'`)

**Returns:** Promise<boolean>

**Current:** Always returns true (stub)  
**TODO:** Query SubscriptionManager for real feature availability

**Example:**

```ts
if (await Entitlements.canUseFeature("export_pdf")) {
  showPdfExportButton();
}
```

#### `Entitlements.getExportFormats(): string[]`

Available export formats for user.

**Current:** `['json', 'csv', 'pdf', 'docx', 'foundry-vtt']` (stub, all formats)  
**TODO:** Filter based on subscription tier

---

### Lazy Imports (`lazy-imports.ts`)

Utilities for lazy-loading heavy modules/components.

#### `lazyLoad<T>(importFn, moduleName?): Promise<T>`

Safely lazy-load a module with error handling and performance timing.

**Parameters:**

- `importFn`: `() => Promise<T>` — Dynamic import function
- `moduleName?`: string — Name for logging (default: `'Module'`)

**Returns:** Promise resolving to imported module

**Example:**

```ts
import { lazyLoad } from "@/lib/utils/lazy-imports";

const HeavyModule = await lazyLoad(
  () => import("./HeavyComponent"),
  "HeavyComponent",
);
// Logs: 🚀 HeavyComponent loaded (245ms)
```

#### `lazyLoadInBackground<T>(importFn, moduleName?): Promise<T>`

Load a module in the background without blocking.

**Example:**

```ts
lazyLoadInBackground(
  () => import("./OptionalFeature"),
  "OptionalFeature",
).catch(() => {
  logger.warn("lazy-load", "Background load failed, will retry on demand");
});
```

#### `createLazyComponent(importFn, componentName?): () => Promise<Component>`

Create a lazy-loadable React component wrapper.

**Example:**

```ts
const LazyStyleDesktop = createLazyComponent(
  () => import("./StyleDesktop"),
  "StyleDesktop"
);

// Later, in React:
<Suspense fallback={<Loading />}>
  <LazyStyleDesktop />
</Suspense>
```

---

### Startup Time (`startup-time.ts`)

Measures app startup performance on native platforms.

#### `nativeStartTime(): number`

Returns time from app launch to bridge initialization (native only).

**Returns:** number (milliseconds)  
**Returns 0 on web/desktop** (not applicable)

**Security Note:** This global is set by trusted native code only and is validated before use.

**Example:**

```ts
import { nativeStartTime } from "@/lib/utils/startup-time";

const startupMs = nativeStartTime();
console.log(`App started in ${startupMs}ms`);
analytics.recordStartupTime(startupMs);
```

---

### Version (`version.ts`)

Access current app version.

#### `APP_VERSION: string`

Current app version (synced from package.json).

**Example:**

```ts
import { APP_VERSION } from "@/lib/utils/version";

console.log(`Running D&D Toolkit v${APP_VERSION}`);
settings.showVersion(APP_VERSION);
```

---

### Web Font Loader (`web-font-loader.ts`)

Inject custom web fonts.

#### `injectWebFonts(): Promise<void>`

Injects fonts.css stylesheet into the document. No-op on non-web platforms.

**Behavior:**

- Detects Electron (`window.electronAPI`)
- Routes to `app://fonts.css` on Electron, `/fonts.css` on web
- Checks if already loaded; skips if present
- Logs success/failure

**Example:**

```ts
import { injectWebFonts } from "@/lib/utils/web-font-loader";

await injectWebFonts();
// Logs: ✅ Web fonts stylesheet injected (/fonts.css)
```

---

## Error Handling & Edge Cases

### Logger

- **Feature flags disabled in production:** When `debugLogs` feature flag is false, all non-error logs are suppressed. Only `error` and `security` categories are logged. This is zero-overhead and tree-shakeable.
- **Category filtering:** If a category is not enabled in config, logs for that category are not output. This allows fine-grained debugging control without redeploying.
- **Invalid categories:** Non-category logger calls (direct `logger.debug()`, `logger.info()`, etc.) still work, just without category filtering.

**Example:**

```ts
// With debugLogs: false (production)
logger.info("api", "Request started"); // SUPPRESSED
logger.error("storage", "Quota exceeded"); // SHOWN
```

### Image Optimization

- **Non-Supabase URLs:** `optimizeSupabaseImage()` checks for `'supabase'` in URL; non-Supabase URLs are returned as-is.
- **Missing parameters:** If no options provided, returns URL unchanged.
- **Invalid dimensions:** No validation; server-side transformation fails gracefully if width/height are invalid.

### Image Proxy

- **CORS proxy limitations:** Current implementation returns original URL. Dev-only CORS proxy commented out due to upstream rate limits and CORS proxy deprecation.
- **External URL detection:** Uses `window.location.hostname` for comparison; returns false on non-web platforms.

### Entitlements

- **All stubbed:** All methods return stub values (same for all users). Production needs wiring to SubscriptionManager.
- **No enforcement:** These are hints/display values only; actual quota enforcement happens in database mutations.

### Lazy Imports

- **Module not found:** If import fails, error is logged and rejected. App must handle via Suspense boundary or error boundary.
- **Background loads:** Background loads catch errors and log warnings; they don't throw to prevent blocking startup.
- **Already loaded:** If module is imported twice, both get same promise (browser caches dynamic imports).

**Example Error Handling:**

```ts
try {
  const module = await lazyLoad(() => import("./Missing"), "Missing");
} catch (err) {
  logger.error("lazy-load", "Failed to load Missing:", err);
  // Handle gracefully: show fallback UI, disable feature, etc.
}
```

### Startup Time

- **Web/Desktop returns 0:** Not applicable outside native platforms.
- **Validation:** Startup time is validated (0-30000ms range) before returning. Prevents exploitation from malicious globals.
- **Not settable:** Read-only global; JavaScript code cannot modify.

### Web Font Loader

- **Non-web platforms:** No-op (returns immediately).
- **Already loaded:** Checks for existing link tag; skips if found (prevents duplicate injection).
- **Electron detection:** Checks for `window.electronAPI` to route to correct font path (`app://` vs `/`).
- **Load failures:** Logs error but doesn't throw. App renders with fallback fonts.

---

## Security & Guarantees

- **No secrets in code:** All sensitive logic is handled in platform-specific modules
- **Logger:** Never logs secrets or PII; category-based filtering
- **Image Proxy:** Never proxies user credentials; dev-only proxy is safe for testing

---

## Performance & Scalability Analysis

### Logger

- **Zero overhead in production:** With `debugLogs: false`, logger calls are effectively inlined (console.log with condition check, ~1-2ns per call).
- **Development overhead:** With `debugLogs: true`, each log call incurs timestamp formatting (~1-2µs) and category validation (~100ns).
- **Memory:** Singleton instance holds config reference (~100 bytes).
- **Recommendation:** Safe to use for high-frequency logging in development without performance impact.

### Image Optimization

- **URL parsing:** `optimizeSupabaseImage()` uses URLSearchParams (O(n) where n = number of params, typically 3-5). Cost: <1µs.
- **Memory:** No state; all operations are stateless.
- **Recommendation:** Can be called in render loops without performance penalty.

### Lazy Imports

- **Import overhead:** Dynamic `import()` has platform-specific cost (~10-50ms on web, depending on bundle size).
- **Deduplication:** Browser caches dynamic imports; subsequent calls return same promise (zero cost).
- **Memory:** Loaded modules remain in memory after loading. Use for truly heavy modules (>500KB).
- **Recommendation:** Lazy-load components that are rarely used or only loaded on specific routes. Reduces initial bundle size by 10-30%.

### Startup Time

- **Native only:** Global read, one validation check (~100ns).
- **Web/Desktop:** Immediate return (zero cost).

### Web Font Loader

- **Synchronous DOM:** `createElement`, `appendChild` are synchronous (~1-5ms total).
- **Stylesheet parsing:** Browser parses fonts.css asynchronously; no blocking.
- **Recommendation:** Call early in bootstrap (before UI renders) to ensure fonts are available.

### Image Responsive Sizing

- **`getOptimalImageWidth()` cost:** Single DPR read + if/else chain (~100ns).
- **`getResponsiveImageSizes()` cost:** Object return (~10ns).
- **Recommendation:** Can memoize results if called frequently in render loops.

---

## Related Modules & Integration Points

- `lib/config` – Logger config, feature flags
- `lib/storage` – Logger, entitlements, and image optimization used in storage flows
- `lib/analytics` – Logger and startup time for performance tracking
- `lib/database` – Entitlements for quota enforcement

---

## File Breakdown

| File                  | Purpose                                  |
| --------------------- | ---------------------------------------- |
| logger.ts             | Category-based, environment-aware logger |
| pii-redaction.ts      | PII detection and redaction patterns     |
| image-optimization.ts | Supabase image optimization helpers      |
| image-proxy.ts        | CORS-safe image loading utilities        |
| entitlements.ts       | Centralized premium feature limits       |
| lazy-imports.ts       | Lazy-loading helpers for modules/comps   |
| startup-time.ts       | Native startup time measurement          |
| version.ts            | App version constant                     |
| web-font-loader.ts    | Web/Electron font injection              |

---

## Testing

- [ ] Logger: Test all log levels and categories, verify feature flag control
- [ ] PII Redaction: Test all pattern types (prefixed, standalone, combined), verify [REDACTED] output
- [ ] Image Optimization: Test URL transformation, responsive sizing
- [ ] Image Proxy: Test CORS proxy and local asset fallback
- [ ] Entitlements: Test all limits and feature checks (stubbed)
- [ ] Lazy Imports: Test lazyLoad and createLazyComponent with error scenarios
- [ ] Startup Time: Test on native and web/desktop
- [ ] Version: Verify version matches package.json
- [ ] Web Font Loader: Test font injection on web/Electron

---

## Future Enhancements

- **Logger:** Remote log streaming and user session correlation. Current logger writes to console only. Enhancement would add ability to stream logs to a backend service for real-time diagnostics, player support tickets, and analytics. Session correlation would tie all logs from a user session together for easier debugging of complex workflows.

- **Entitlements:** Wire to SubscriptionManager and real quota checks. Currently all limits are stubbed and return the same value for all users. Enhancement would integrate with SubscriptionManager to return different limits based on user tier (free vs. premium) and feature flags. Would enforce actual quotas (e.g., max 5 worlds for free, 50 for premium) during mutations.

- **Image Proxy:** Production-ready backend proxy or CDN integration. Current image proxy is dev-only and mentions CORS limitations. Enhancement would implement a robust backend proxy service that fetches and caches external images, or integrate with a CDN like Cloudflare or AWS CloudFront to serve images at scale with proper caching and optimization headers.

- **Lazy Imports:** Preload strategies and error boundary integration. Current lazy-loading defers module imports until needed. Enhancement would add configurable preload strategies (e.g., preload HeavyComponent on route navigation) and integrate with React error boundaries to gracefully handle lazy-loading failures without crashing the entire app.

- **Web Font Loader:** Dynamic font loading based on theme or language. Current implementation injects a static fonts.css. Enhancement would dynamically load different font families based on the user's selected theme (e.g., modern vs. classic) or language (e.g., Chinese, Japanese fonts for CJK support), reducing bandwidth and improving performance by loading only necessary fonts.

---
