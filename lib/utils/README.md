# lib/utils

Foundational utilities for logging, image optimization, entitlements, lazy imports, startup timing, versioning, web font loading, and error codes. Provides cross-platform, production-ready tools for common app needs.

## When to Use This Module

**Use this module if you need:**

- Environment-aware, category-based logging with feature-flag control and zero production overhead (11 categories)
- Responsive image optimization for Supabase URLs (automatic resizing, quality negotiation, format detection)
- CORS-safe image loading with intelligent fallback and placeholder strategies
- Centralized premium feature limits and quota logic (tier-aware entitlements without scattered checks)
- Lazy-loading of heavy modules and components to reduce bundle size and improve startup time
- Measuring app startup performance metrics on native platforms
- Accessing current app version for About screens, update checks, or error reporting
- Injecting custom web fonts on web and Electron platforms
- Type-safe error codes and metadata for consistent error handling across the application

**Do NOT use this module for:**

- In-memory, session-scoped state (use React state or [lib/cache's FastCache](../cache/README.md))
- Persistent data storage (use [lib/storage's SecureStorage](../storage/README.md))
- Server-side logging or real-time metrics (use [lib/analytics](../analytics/README.md))
- Complex image transformations beyond resize/quality (use external image service or CDN)
- Font loading with complex fallback logic (use CSS @font-face or native frameworks)

## Architecture & Data Flow

```
App Code
  ↓
Import from lib/utils
  ↓
[Logger | Image Optimization | Entitlements | Lazy Imports | Startup Time | Version | Web Font Loader | Error Codes]
  ↓
Platform-specific or cross-platform implementation
```

**Components:**
- **logger.ts**: Category-based, environment-aware logging with feature-flag control
- **pii-redaction.ts**: PII pattern detection and redaction
- **image-optimization.ts**: Supabase image URL optimization and responsive sizing
- **image-proxy.ts**: CORS-safe image loading for external URLs
- **entitlements.ts**: Centralized stub for premium feature limits and quotas
- **lazy-imports.ts**: Lazy-loading of heavy modules/components with error handling
- **startup-time.ts**: Native startup time measurement (0 on web/desktop)
- **version.ts**: Current app version constant
- **web-font-loader.ts**: Custom font injection for web/Electron
- **ERROR_CODES.ts**: Centralized registry of type-safe error codes and metadata

## API Reference

### Error Codes (`ERROR_CODES.ts`)

Centralized registry of type-safe error codes with structured metadata for consistent error handling.

#### `ERROR_CODES: Record<string, Record<string, string>>`

Registry of all valid error codes organized by category.

**Categories:**
- `AUTH` - Authentication/authorization errors
- `NETWORK` - Connectivity and transport errors  
- `DATABASE` - Data operations errors
- `STORAGE` - Storage and persistence errors
- `HTTP` - HTTP status code mappings
- `VALIDATION` - Input validation errors
- `RETRY` - Retry strategy errors

**Example:**
```ts
import { ERROR_CODES } from "@/lib/utils";

throw new AppError(ERROR_CODES.AUTH.INVALID_CREDENTIALS, "Invalid email or password");
```

#### `ERROR_CODES_METADATA: Record<string, ErrorCodeMetadata>`

Structured metadata for each error code including severity, recoverability, retry strategy, and user messages.

**Example:**
```ts
import { ERROR_CODES_METADATA } from "@/lib/utils";

const meta = ERROR_CODES_METADATA[ERROR_CODES.AUTH.INVALID_CREDENTIALS];
// {
//   severity: 'low',
//   recoverable: true,
//   retryStrategy: 'none',
//   userMessage: 'Invalid email or password. Please try again.',
//   category: 'auth'
// }
```

#### Error Code Types

Type-safe error code types for each category:

```ts
import type { AuthErrorCode, NetworkErrorCode, DatabaseErrorCode } from "@/lib/utils";

function handleAuthError(code: AuthErrorCode) {
  // TypeScript ensures only AUTH.* codes are passed
}
```

#### Helper Functions

**`getErrorCodesByCategory(category: string): string[]`**
Returns all error codes for a category.

**`mapSupabaseError(error: any): string`**
Maps Supabase errors to standardized error codes.

**Example:**
```ts
import { getErrorCodesByCategory, mapSupabaseError } from "@/lib/utils";

const authCodes = getErrorCodesByCategory('auth');
const code = mapSupabaseError(supabaseError);
```

---

### Logger (`logger.ts`)

Category-based, feature-flag controlled logging with zero overhead in production.

#### `logger.category(category): CategoryLogger`

Returns a category-specific logger. Categories: `'auth'`, `'navigation'`, `'api'`, `'network'`, `'performance'`, `'storage'`, `'ui'`, `'analytics'`, `'security'`, `'bootstrap'`, `'error'`, `'other'`

**Example:**
```ts
import { logger } from "@/lib/utils/logger";

logger.category("auth").info("User logged in");
logger.category("api").error("Failed to fetch", error);
logger.category("storage").warn("Cache quota approaching 80%");
```

#### `logger.debug/info/warn/error/success(category?, context?, ...args): void`

Log at different levels.

**Example:**
```ts
logger.category('api').info("Worlds fetched successfully");
logger.group("bootstrap", "Initialization", false);
logger.category('bootstrap').info("Loading config");
logger.groupEnd();
```

#### `logger.category(cat).table(data): void`

Log structured data as a table.

---

### PII Redaction (`pii-redaction.ts`)

Detect and redact personally identifiable information in logs and error messages.

#### `redactPII(value, options?): string`

Redact PII from a string or object.

**Example:**
```ts
import { redactPII } from "@/lib/utils";

redactPII("email: user@example.com"); // "email: [REDACTED]"
redactPII("user@example.com"); // "[REDACTED]"
redactPII({ token: "eyJhbGc...", userId: "uuid" }); // Redacts both
```

#### `containsPII(value): boolean`

Check if a string contains any PII patterns.

**Patterns:** Email, JWT, session IDs, UUIDs, API keys, phone numbers, URL params.

---

### Image Optimization (`image-optimization.ts`)

Optimize image loading, sizing, and delivery.

#### `optimizeSupabaseImage(url, options?): string`

Adds transformation parameters to a Supabase storage URL.

**Parameters:**
- `url`: Supabase storage URL
- `options?.width`: Target width (pixels)
- `options?.height`: Target height (pixels)
- `options?.quality`: 1-100 (default: 80)
- `options?.format`: `'webp'` | `'jpeg'` | `'png'`
- `options?.fit`: `'cover'` | `'contain'` | `'fill'`

**Example:**
```ts
import { optimizeSupabaseImage } from "@/lib/utils/image-optimization";

const optimized = optimizeSupabaseImage(
  "https://abc.supabase.co/storage/v1/object/public/maps/world.jpg",
  { width: 800, quality: 80, format: "webp", fit: "cover" }
);
```

#### `getOptimalImageWidth(containerWidth): number`

Calculates optimal image width based on container width and device pixel ratio.

#### `getResponsiveImageSizes(): { thumbnail, small, medium, large, xlarge }`

Returns predefined widths for different screen sizes.

#### `isSupabaseUrl(url): boolean`

Checks if a URL is a Supabase storage URL.

---

### Image Proxy (`image-proxy.ts`)

CORS-safe image loading utilities.

#### `isExternalUrl(url): boolean`

Checks if a URL is from an external domain.

#### `getCorsImageUrl(url): string`

Returns a CORS-safe URL. Currently returns original URL; future: backend proxy.

---

### Entitlements (`entitlements.ts`)

Centralized stub for premium feature limits. **All values are currently stubbed; future: wire to SubscriptionManager.**

#### `Entitlements.getCharacterLimit(): number`

Max characters user can create. Current: 100

#### `Entitlements.getWorldLimit(): number`

Max worlds user can create. Current: 50

#### `Entitlements.getNPCLimit(): number`

Max NPCs per world. Current: 500

#### `Entitlements.getStorageBytes(): number`

Storage quota in bytes. Current: 10GB

#### `Entitlements.getMaxFileSize(): number`

Max file upload size. Current: 100MB

#### `Entitlements.getApiRequestsPerHour(): number`

API requests allowed per hour. Current: 10,000

#### `Entitlements.async canUseFeature(featureKey): Promise<boolean>`

Check if a specific premium feature is available. Current: Always true (stub)

**Example:**
```ts
if (await Entitlements.canUseFeature("export_pdf")) {
  showPdfExportButton();
}
```

#### `Entitlements.getExportFormats(): string[]`

Available export formats. Current: All formats `['json', 'csv', 'pdf', 'docx', 'foundry-vtt']`

---

### Lazy Imports (`lazy-imports.ts`)

Lazy-loading utilities for heavy modules/components.

#### `lazyLoad<T>(importFn, moduleName?): Promise<T>`

Safely lazy-load a module with error handling and timing.

**Example:**
```ts
import { lazyLoad } from "@/lib/utils/lazy-imports";

const HeavyModule = await lazyLoad(
  () => import("./HeavyComponent"),
  "HeavyComponent"
);
```

#### `lazyLoadInBackground<T>(importFn, moduleName?): Promise<T>`

Load a module in the background without blocking.

#### `createLazyComponent(importFn, componentName?): () => Promise<Component>`

Create a lazy-loadable React component wrapper.

**Example:**
```ts
const LazyStyleDesktop = createLazyComponent(
  () => import("./StyleDesktop"),
  "StyleDesktop"
);

// In React:
<Suspense fallback={<Loading />}>
  <LazyStyleDesktop />
</Suspense>
```

---

### Startup Time (`startup-time.ts`)

Measures app startup performance on native platforms.

#### `nativeStartTime(): number`

Returns time from app launch to bridge initialization (milliseconds). Returns 0 on web/desktop.

**Example:**
```ts
import { nativeStartTime } from "@/lib/utils/startup-time";

const startupMs = nativeStartTime();
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

**Example:**
```ts
import { injectWebFonts } from "@/lib/utils/web-font-loader";

await injectWebFonts();
// Logs: ✅ Web fonts stylesheet injected (/fonts.css)
```

## Error Handling & Edge Cases

### Logger

- **Feature flags disabled in production:** When `debugLogs` feature flag is false, all non-error logs are suppressed. Zero-overhead and tree-shakeable.
- **Category filtering:** Categories not enabled in config are skipped.
- **Invalid categories:** Direct calls (no category) still work, just without filtering.

### Image Optimization

- **Non-Supabase URLs:** Returned as-is (no transformation).
- **Missing parameters:** URL unchanged if no options provided.
- **Invalid dimensions:** Server-side transformation fails gracefully.

### Entitlements

- **All stubbed:** Same values for all users. Production needs wiring to SubscriptionManager.
- **No enforcement:** These are hint/display values only; actual quota enforcement is in database mutations.

### Lazy Imports

- **Module not found:** Error logged and rejected. App must handle via Suspense or error boundary.
- **Background loads:** Catch errors and log warnings; don't throw.
- **Already loaded:** Browser caches dynamic imports; subsequent calls return same promise.

**Error Handling:**
```ts
try {
  const module = await lazyLoad(() => import("./Missing"), "Missing");
} catch (err) {
  logger.category('lazy-load').error("Failed to load Missing:", err);
  // Handle gracefully
}
```

### Startup Time

- **Web/Desktop returns 0:** Not applicable outside native platforms.
- **Validation:** Startup time validated (0-30000ms range). Prevents exploitation from malicious globals.
- **Read-only:** Cannot be modified by JavaScript code.

### Web Font Loader

- **Non-web platforms:** No-op.
- **Already loaded:** Checks for existing link tag; skips if found.
- **Electron detection:** Checks for `window.electronAPI` to route to correct font path.
- **Load failures:** Logs error but doesn't throw. App renders with fallback fonts.

## Performance Notes

- **Logger:** With `debugLogs: false` (production), ~1-2ns per call (effectively inlined). With `debugLogs: true`, ~1-2µs per call.
- **Image Optimization:** URL parsing is ~<1µs. Stateless operations. Safe for render loops.
- **Lazy Imports:** Dynamic import cost ~10-50ms on web (platform-dependent). Browser caches subsequent calls (zero cost). Use for truly heavy modules (>500KB) or rarely-used features.
- **Startup Time:** Single validation check (~100ns). Web/Desktop returns immediately.
- **Web Font Loader:** DOM operations ~1-5ms. Stylesheet parsing asynchronous (non-blocking).

## Related Modules & Integration Points

- `lib/config` – Logger config, feature flags
- `lib/storage` – Logger, entitlements, image optimization
- `lib/analytics` – Logger and startup time for performance tracking
- `lib/database` – Entitlements for quota enforcement

## File Breakdown

| File                  | Purpose                                |
| --------------------- | -------------------------------------- |
| logger.ts             | Category-based, environment-aware logger |
| pii-redaction.ts      | PII detection and redaction patterns   |
| image-optimization.ts | Supabase image optimization helpers    |
| image-proxy.ts        | CORS-safe image loading utilities      |
| entitlements.ts       | Centralized premium feature limits     |
| lazy-imports.ts       | Lazy-loading helpers for modules/comps |
| startup-time.ts       | Native startup time measurement        |
| version.ts            | App version constant                   |
| web-font-loader.ts    | Web/Electron font injection            |
| ERROR_CODES.ts        | Centralized error code registry        |
| index.ts              | Barrel export                          |
