# Adaptive Payload Sizing - Architecture

**Issue:** #205  
**Phase:** 2-3 (Implementation + Integration)  
**Status:** Complete (client-side foundation; server-side variants pending)

---

## System Overview

Adaptive payload sizing reduces API response complexity based on real-time network quality. Clients automatically request appropriately-sized payloads; servers respond with data optimized for connection conditions.

```
User Device
    ↓
Network Detection (real-time quality assessment)
    ├─ Online/Offline status
    ├─ Connection type (wifi/cellular)
    ├─ Effective Type (4g/3g/2g/slow-2g)
    └─ Battery status (for expensive connection detection)
    ↓
Quality Tier Mapping (connection → quality level)
    ├─ 4g → HD (full resolution, full detail)
    ├─ 3g → SD (medium resolution, core detail)
    ├─ 2g → Thumb (low resolution, summary only)
    └─ Offline → Text (minimal, cached copy)
    ↓
Adaptive Params Generation
    ├─ imageQuality parameter
    ├─ excludeMaps toggle
    ├─ summaryOnly toggle
    └─ maxPayloadSize constraint
    ↓
RequestManager Auto-Injection
    ├─ HTTP-like URLs: auto-inject (unless disabled)
    ├─ Internal cache keys: manual control
    └─ Params merged with user-provided params
    ↓
Cache-Quality Mapping
    ├─ Same URL, different params → separate cache entries
    ├─ 4g cache entry: full data
    ├─ 2g cache entry: lightweight copy
    └─ Auto-invalidate on quality change
    ↓
HTTP Request
    └─ Server receives params, responds with sized payload
    ↓
Response Caching (cached by quality tier)
    └─ Next request on same network: instant serve
```

---

## 5-Layer Architecture

The adaptive payload system consists of 5 integrated layers:

### Layer 1: Network Detection & Status Monitoring

**File:** `lib/network/network-detection.ts`  
**Purpose:** Real-time assessment of connection quality

```
┌─────────────────────────────────────┐
│   Network Detection Layer           │
├─────────────────────────────────────┤
│ • Native (expo-network):            │
│   - Detect wifi vs cellular         │
│   - Detect battery state            │
│                                     │
│ • Web (navigator API):              │
│   - online/offline events           │
│   - navigator.connection (beta)     │
│   - Periodic Supabase ping          │
│                                     │
│ • Outputs: NetworkStatus            │
│   - isOnline: boolean               │
│   - type: 'wifi' | 'cellular'       │
│   - connectionQuality: enum         │
│   - isExpensive: boolean            │
└─────────────────────────────────────┘
```

**Key Exports:**
- `NetworkDetection.getStatus()` – Synchronous current status
- `NetworkDetection.subscribe(callback)` – Listen to changes
- `useNetworkStatus()` – React hook for UI components
- `ConnectionQuality` enum: GOOD / BAD / NO_WIFI

### Layer 2: Quality Tier Mapping & Payload Options

**File:** `lib/network/adaptive-payload.ts`  
**Purpose:** Map connection quality → optimized payload options

```
┌──────────────────────────────────────────┐
│   Quality Tier Mapping Layer             │
├──────────────────────────────────────────┤
│ Input: NetworkStatus                     │
│ ↓                                        │
│ Decision Tree:                           │
│   if GOOD & wifi → HD (full quality)    │
│   if GOOD & cellular → SD               │
│   if BAD → Thumb (small images)         │
│   if NO_WIFI → Text (cache fallback)    │
│ ↓                                        │
│ Output: AdaptivePayloadOptions           │
│   - imageQuality: 'hd'|'sd'|'thumb'     │
│   - includeDetails: boolean              │
│   - includeMaps: boolean                 │
│   - maxPayloadSize: number               │
│   - fetchStrategy: 'live'|'cached'      │
└──────────────────────────────────────────┘
```

**Quality Tier Definitions:**

| Tier | Connection | Images | Details | Maps | Max Size |
|------|-----------|--------|---------|------|----------|
| HD | 4G wifi | Full 1920px | Full + metadata | Rendered | 5MB |
| SD | 3G cellular | 1024px | Core only | Vector only | 2MB |
| Thumb | 2G slow | 256px | Summary | No | 500KB |
| Text | Offline | None | Summary | No | 0 |

**Key Exports:**
- `getAdaptivePayloadOptions(status: NetworkStatus)` – Map quality
- `buildAdaptiveQueryParams(options)` – Build query params object
- `shouldDowngradeResource(retryCount)` – Quality downgrade on retry

### Layer 3: Request Manager Auto-Injection & Params Conversion

**File:** `lib/api/request-manager.ts`  
**Purpose:** Automatic param injection and enriched cache key management

```
┌────────────────────────────────────────────────┐
│   RequestManager Enhancement (Layer 3)         │
├────────────────────────────────────────────────┤
│                                                │
│ Input: fetch(key, fetcher, {params, ...})      │
│ ↓                                              │
│ 1. Decide to auto-inject?                      │
│    ├─ useAdaptiveParams = true & HTTP URL    │
│    │  → import adaptive params                 │
│    └─ Otherwise → skip injection               │
│ ↓                                              │
│ 2. Merge params into query string              │
│    ├─ params: {imageQuality, excludeMaps}    │
│    ├─ Convert to: ?imageQuality=sd&...        │
│    └─ Handle existing ?foo=bar (append with &) │
│ ↓                                              │
│ 3. Create enriched cache key                   │
│    ├─ Old: 'https://api.com/worlds'           │
│    ├─ New: 'https://api.com/worlds?...params' │
│    └─ Same URL w/ different quality = cache   │
│       entries (separate caches stored)         │
│ ↓                                              │
│ 4. Track retry state for quality downgrade     │
│    ├─ 1st attempt: HD quality requested        │
│    ├─ 2nd attempt: SD (if 1st failed)         │
│    ├─ 3rd attempt: Thumb                       │
│    └─ 4th attempt: Text (cached)               │
│ ↓                                              │
│ Output: enrichedKey used throughout fetch      │
│ (dedup, cache, tracking, offline queue)        │
└────────────────────────────────────────────────┘
```

**RequestOptions Extensions:**

```typescript
interface RequestOptions {
  // Existing (unchanged)
  useQueryCache?: boolean;
  retry?: { count: number; delay: number };
  
  // NEW for adaptive payloads:
  params?: Record<string, string | number | boolean>;
  useAdaptiveParams?: boolean;  // true for HTTP URLs by default
}
```

**New Methods:**
- `paramsToQueryString(params)` – Convert object to query string
- `appendParamsToKey(key, params)` – Safely append params to URL/key
- `shouldAutoInjectAdaptiveParams(key)` – Detect HTTP-like URLs
- `downgradeAdaptiveQuality(retryAttempt)` – Map attempt → quality

**Key Behavior:**
- Auto-inject is conservative: only for URLs starting with `http` or `/`
- Explicit `useAdaptiveParams: false` disables injection (for cache keys)
- All downstream operations (dedupe, cache, tracking, offline queue) use enriched key
- Non-breaking: new fields optional; existing code works unchanged

### Layer 4: Cache Strategy with Quality-Aware Keys

**File:** `lib/cache/use-query.ts` + `lib/cache/query-cache.ts`  
**Purpose:** Store/retrieve variants by quality tier; invalidate on quality change

```
┌─────────────────────────────────────────────────┐
│   Query Cache with Quality Variants             │
├─────────────────────────────────────────────────┤
│                                                 │
│ Scenario: User fetches worlds list              │
│                                                 │
│ On 4G (HD):                                     │
│   Key: 'worlds:list?imageQuality=hd&...'      │
│   → Full world metadata, map data stored        │
│                                                 │
│ Switch to 2G (Thumb):                           │
│   Key: 'worlds:list?imageQuality=thumb&...'   │
│   → Different key = different cache entry       │
│   → Triggers auto-invalidation if enabled       │
│   → New fetch happens with thumb params         │
│                                                 │
│ Switch back to 4G:                              │
│   Key: 'worlds:list?imageQuality=hd&...'      │
│   → Original key still in cache (if not stale)  │
│   → Serve full data instantly                   │
│                                                 │
│ Cache Entry Structure:                          │
│   {                                             │
│     data: <payload>,     // Sized data          │
│     timestamp: <ms>,     // When cached         │
│     staleTime: 2h,       // Revalidate threshold│
│     cacheTime: 4h,       // Expiration threshold│
│     tags: ['worlds'],    // For invalidation    │
│     version: <number>    // Race condition safe │
│   }                                             │
└─────────────────────────────────────────────────┘
```

**New useQuery cachePriority Modes:**

```typescript
useQuery(key, fetcher, {
  cachePriority: 'balanced' | 'cacheFirst' | 'networkFirst' | 'offlineFirst'
})
```

| Mode | Behavior | Best For |
|------|----------|----------|
| **balanced** (default) | Return cache immediately; revalidate if stale (SWR) | Most queries (good UX + freshness) |
| **cacheFirst** | Use cache without revalidation; only refetch on explicit `refetch()` call | Stable data, rare updates |
| **networkFirst** | Always try network; fallback to cache on error | Real-time data requiring freshness |
| **offlineFirst** | When offline, serve cache even if stale; don't force revalidation | Critical features needed offline |

**Auto-Invalidation Pattern:**

```typescript
useAdaptivePayloadCacheInvalidation({
  tagsToInvalidate: ['worlds', 'characters']
})
// Watches NetworkDetection.getStatus()
// On quality change: invalidate specified tags
// On next render: useQuery refetches with new quality params
```

### Layer 5: Integration Points & Data Flow

**File:** Multiple (`lib/api/`, `lib/cache/`, `lib/network/`, `hooks/`)  
**Purpose:** Wire all layers together for end-to-end adaptive payloads

```
Component Render
    ↓
useQuery('worlds:list', fetcher, { cachePriority: 'balanced' })
    ↓
Check cache for 'worlds:list?imageQuality=hd&...' (enriched key)
    ├─ Found & fresh: return immediately (SWR)
    └─ Found & stale: return + revalidate in background
    ↓
RequestManager.fetch() called
    ├─ Auto-inject adaptive params (unless disabled)
    ├─ Create enriched key with params
    ├─ Deduplicate if already in-flight
    └─ Check QueryCache with enriched key
    ↓
Network Request (with quality params)
    └─ Server receives: ?imageQuality=sd&excludeMaps=true&...
    ↓
Response cached with enriched key
    └─ Key: 'https://api.com/worlds?imageQuality=sd&...'
    ↓
NetworkDetection detects quality change (e.g., 4g → 2g)
    ├─ useAdaptivePayloadCacheInvalidation triggered
    ├─ Tags ['worlds'] invalidated
    └─ useQuery refetches with new quality params
    ↓
Cycle repeats with new quality tier
```

---

## Decision Tree: When Does Adaptive Injection Happen?

```
RequestManager.fetch(key, fetcher, options)
    ↓
Is useAdaptiveParams explicitly set?
    ├─ Yes: useAdaptiveParams = true?
    │   └─ Inject adaptive params
    ├─ Yes: useAdaptiveParams = false?
    │   └─ Skip injection
    └─ No: default behavior
        ↓
        Does key look like HTTP URL?
        (starts with 'http://', 'https://', or '/')
        ├─ Yes → Inject adaptive params
        └─ No → Skip injection
```

**Examples:**

```typescript
// Auto-inject (matches 'http' pattern)
RequestManager.fetch('https://api.example.com/worlds', fetcher)
// → Adaptive params injected automatically

// Auto-inject (matches '/' pattern)
RequestManager.fetch('/api/worlds', fetcher)
// → Adaptive params injected automatically

// No injection (doesn't match pattern)
RequestManager.fetch('worlds:list', fetcher)
// → No adaptive params

// Explicit disable
RequestManager.fetch('https://api.example.com/user', fetcher, {
  useAdaptiveParams: false
})
// → No injection despite matching pattern

// Explicit enable
RequestManager.fetch('worlds:list', fetcher, {
  useAdaptiveParams: true
})
// → Injection attempted (won't match URL pattern, but forced)
```

---

## Param Conversion & Query String Handling

RequestManager intelligently converts params to query strings, handling existing query params:

```typescript
// Input 1: Simple URL + params
RequestManager.fetch('https://api.example.com/worlds', fetcher, {
  params: { imageQuality: 'sd', excludeMaps: true }
})
// Result: https://api.example.com/worlds?imageQuality=sd&excludeMaps=true

// Input 2: URL with existing query + new params
RequestManager.fetch('https://api.example.com/worlds?page=1&limit=10', fetcher, {
  params: { imageQuality: 'sd' }
})
// Result: https://api.example.com/worlds?page=1&limit=10&imageQuality=sd

// Input 3: Adaptive params auto-injected + user params merged
RequestManager.fetch('https://api.example.com/worlds', fetcher, {
  params: { page: 1 }
  // useAdaptiveParams: true (default for HTTP)
})
// Result: https://api.example.com/worlds?imageQuality=sd&excludeMaps=true&page=1

// Input 4: Params object with various types
RequestManager.fetch('https://api.example.com/worlds', fetcher, {
  params: {
    imageQuality: 'sd',        // string
    limit: 20,                 // number
    includeDetails: true       // boolean
  }
})
// Result: https://api.example.com/worlds?imageQuality=sd&limit=20&includeDetails=true
```

---

## Quality Downgrade on Retry

When a request fails, RequestManager can reduce quality tier on subsequent retries:

```typescript
// RequestManager retry state tracking

Request 1 (Attempt 1):
  Params: { imageQuality: 'hd' }
  → Throws error (timeout/connection issue)

Request 2 (Attempt 2):
  Params: { imageQuality: 'sd' }  // Downgraded
  → Throws error

Request 3 (Attempt 3):
  Params: { imageQuality: 'thumb' }  // Further downgraded
  → Success!
```

**Helper Function:**

```typescript
downgradeAdaptiveQuality(retryAttempt: number): PayloadQuality | null
// Attempt 1 → 'hd'
// Attempt 2 → 'sd'
// Attempt 3 → 'thumb'
// Attempt 4+ → null (give up, use cache)
```

---

## Data Flow Diagram: Full Request Lifecycle

```
User on 3G network
    ↓
Component: useQuery('worlds:list', fetcher)
    ↓
QueryCache.get('worlds:list?imageQuality=sd&...')
    ├─ Cache HIT (not stale) → Return data immediately
    └─ Cache MISS or STALE → Proceed to fetch
    ↓
RequestManager.fetch(key='worlds:list',
                     fetcher=() => fetch('/api/worlds'),
                     { params = {}, useAdaptiveParams = true })
    ↓
[Auto-Inject Adaptive Params]
    ├─ NetworkDetection.getStatus() → { connectionQuality: GOOD, type: 'cellular' }
    ├─ getAdaptivePayloadOptions() → { imageQuality: 'sd', includeDetails: true, includeMaps: false }
    ├─ buildAdaptiveQueryParams() → { imageQuality: 'sd', ... }
    └─ enrichedKey = 'worlds:list?imageQuality=sd&...'
    ↓
[Deduplication Check]
    ├─ Is fetch(enrichedKey) already pending?
    ├─ Yes → Return existing promise
    └─ No → Proceed
    ↓
[QueryCache Check with Enriched Key]
    └─ Optional second cache check (for in-flight dedup)
    ↓
[Execute Fetcher with AbortController]
    ├─ signal: abortController.signal (for quality-based abort)
    ├─ Call user's fetcher function
    └─ GET /api/worlds?imageQuality=sd&excludeMaps=true&...
    ↓
[Server Response: 1.5MB (SD quality)]
    ├─ Received within timeout
    └─ Parse JSON
    ↓
[Store in QueryCache]
    ├─ Key: 'worlds:list?imageQuality=sd&...'
    ├─ Check race condition (version mismatch during fetch)
    └─ If race condition detected: discard (invalidation occurred during fetch)
    ↓
[Notify Subscribers]
    └─ All useQuery('worlds:list') listeners updated
    ↓
[Return to Component]
    └─ data = worlds array, isLoading = false
    ↓
Late Scenario: User switches to 2G
    ├─ NetworkDetection triggers quality change event
    ├─ useAdaptivePayloadCacheInvalidation detects change
    ├─ Tags ['worlds'] invalidated
    └─ useQuery refetches with new params: ?imageQuality=thumb&...
```

---

## Complexity Hotspots & Design Decisions

### 1. Enriched Cache Keys (Key Complexity Source)

**Why Enriched Keys?**
- Same URL with different quality params = different payloads
- Can't use same cache entry for HD and Thumb data
- Must store separately to avoid serving wrong-sized data

**Complexity:**
- Must update ALL references: dedup, cache checks, cleanup, tracking, endpoints
- Params must be deterministically converted (order matters for cache hits)
- Must handle existing query strings (`?foo=bar` + new params → `?foo=bar&imageQuality=sd`)

**Solution:**
- Created `appendParamsToKey()` utility for consistent handling
- All fetch() operations use `enrichedKey` from start to end
- Cache keys are querystring representations of params

### 2. Auto-Injection Conservative Design

**Why Not Inject Everywhere?**
- Internal cache keys (e.g., `worlds:list:local`) shouldn't have adaptive params
- Only HTTP-like URLs should auto-inject (prevents breaking non-HTTP code)

**Complexity:**
- Must detect HTTP URLs reliably (`key.startsWith('http')` or `key.startsWith('/')`)
- User can explicitly disable (`useAdaptiveParams: false`)
- Users can force enable on non-HTTP URLs (`useAdaptiveParams: true`)

**Solution:**
- `shouldAutoInjectAdaptiveParams(key)` checks URL pattern
- Default logic: enable for HTTP, disable otherwise
- Explicit options override defaults

### 3. Quality-Aware Cache Invalidation

**Why Not Invalidate All Variants?**
- User on 4G: cache HD data
- User switches to 2G: don't discard HD cache
- User switches back to 4G: reuse old HD cache (fast!)

**Complexity:**
- Must track quality tier and invalidate intelligently
- `useAdaptivePayloadCacheInvalidation()` watches connection changes
- Different quality = different cache key = separate invalidation

**Solution:**
- Enriched keys automatically separate variants
- Auto-invalidation hook checks quality changes
- Tag-based invalidation applies to all quality variants of same resource

### 4. Param Conversion & QueryString Handling

**Challenge:**
- Convert object `{ imageQuality: 'sd', limit: 20 }` to `?imageQuality=sd&limit=20`
- Handle existing params in URL: merge correctly
- Ensure deterministic order for cache hits

**Complexity:**
- URL parsing needed to detect existing query string
- Order matters: `?a=1&b=2` !== `?b=2&a=1` (for cache key matching)
- Multiple data types (string, number, boolean) need conversion

**Solution:**
- `paramsToQueryString()` converts object to deterministic query string
- `appendParamsToKey()` safely merges params to existing URLs
- Uses sorted keys for consistency

### 5. Race Condition Prevention (Stale Write Protection)

**Challenge:**
- Request A starts for key X at version=10
- Meanwhile, cache is invalidated (version incremented to 11)
- Request A completes after invalidation
- Must NOT cache stale data from Request A

**Complexity:**
- Track version when request started
- Check version again when writing to cache
- Discard writes if invalidation occurred during fetch

**Solution:**
- `QueryCache.getCurrentVersion()` returns global version number
- Capture version at request start: `requestVersion = getCurrentVersion()`
- Pass to `QueryCache.set(key, data, options, requestVersion)`
- Set method rejects write if `requestVersion < currentVersion`

---

## Implementation Phases

### Phase 1: Foundation (Completed)
- ✅ `lib/network/adaptive-payload.ts` – Quality mapping
- ✅ `lib/network/network-detection.ts` – Online/quality detection
- ✅ `hooks/network/use-adaptive-payload.ts` – UI awareness
- ✅ RequestManager wiring (params injection, conversion, quality downgrade)
- ✅ useQuery cachePriority modes

### Phase 2: Documentation (Completed)
- ✅ `lib/network/README.md` – Architecture, API reference
- ✅ `lib/cache/README.md` – cachePriority documentation
- ✅ ARCHITECTURE.md (this file) – Comprehensive overview
- ✅ WHAT_HASNT_BEEN_DONE.md – Future work

### Phase 3: Server-Side Support (Pending)
- ❌ Server-side image variant generation
- ❌ Database queries accepting quality params
- ❌ Edge function optimization
- ❌ Payload size verification

### Phase 4: Advanced Features (Pending)
- ❌ Progressive loading (incremental quality improvement)
- ❌ Manual override UI for power users
- ❌ Adaptive compression (per-quality compression levels)
- ❌ Advanced analytics (quality distribution tracking)

---

## Testing Strategy

See [Adaptive Payload Testing.md](../../A%20Testing%20Guide/Adaptive%20Payload%20Testing.md) for comprehensive manual testing procedures.

**Key Test Scenarios:**
1. Quality tier mapping (4G→HD, 3G→SD, 2G→Thumb)
2. Param injection and querystring conversion
3. Cache key differentiation (different qualities = different entries)
4. Auto-invalidation on quality change
5. RequestManager auto-injection for HTTP URLs
6. Payload size reduction verification
7. Offline behavior (text-only payloads)

---

## Dependencies & Integration Points

**Core Libraries:**
- `lib/network/network-detection.ts` – Real-time network status
- `lib/network/adaptive-payload.ts` – Quality mapping logic
- `lib/api/request-manager.ts` – Request dedup, retry, caching
- `lib/cache/query-cache.ts` – Cache storage and invalidation
- `hooks/network/use-adaptive-payload.ts` – UI awareness

**Downstream Integration:**
- `lib/offline/OnlineSyncManager` – Offline queue uses RequestManager
- `hooks/network/useAdaptivePayloadCacheInvalidation.ts` – Auto-invalidate
- All hooks calling `RequestManager.fetch()` automatically benefit

**Server Dependencies:**
- API endpoints must accept quality params (imageQuality, excludeMaps, etc.)
- Server must respond with appropriately-sized payloads
- See WHAT_HASNT_BEEN_DONE.md for server implementation work

---

## Performance Characteristics

**Best Case:**
- User on stable 4G network
- Fetch worlds list: 5MB full data
- Cache hit on next fetch: instant serve

**Worst Case:**
- User on 2G network with flaky connection
- Quality params: { imageQuality: 'thumb', summaryOnly: true }
- Downgrades on retries: attempt 1 (thumb) → attempt 2 (text-only)
- Payload size: 500KB → 50KB on downgrade
- Cache serves degraded data until comes online

**Optimization:**
- Enriched cache keys allow instant serving of previously-fetched quality variants
- Auto-invalidation prevents serving outdated payloads
- Deduplication prevents thundering herd on quality changes
- AbortController.signal allows aborting in-flight requests on quality downgrade

---

## Backward Compatibility

All changes are backward compatible:

✅ Existing code without adaptive payloads works unchanged  
✅ RequestManager.fetch() calls don't require new params  
✅ useQuery() doesn't require cachePriority option  
✅ New fields in RequestOptions are optional  
✅ Non-HTTP URLs unaffected by auto-injection logic  

