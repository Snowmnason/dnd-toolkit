# lib/network

Cross-platform network status detection and error handling. Detects online/offline state, connection quality (good/bad/cellular/offline), and battery status. Enables graceful degradation (serving stale cache when network is unavailable or unreliable).

## When to Use This Module

**Use this module to:**

- Check if device is online before making requests or rendering UI
- Detect connection quality (good/bad/cellular/offline) for graceful degradation
- Determine if connection is expensive (cellular + low battery = avoid heavy downloads)
- Handle network errors gracefully with appropriate fallback strategies
- Monitor network health and subscribe to connection status changes
- Implement offline-first patterns with [lib/offline](../offline/README.md)
- Log network events for [lib/analytics](../analytics/README.md) and [lib/utils's Logger](../utils/README.md)

**Do NOT use this module for:**

- HTTP request retries (use [lib/api's RequestManager](../api/README.md) instead)
- Offline data queuing (use [lib/offline](../offline/README.md) mutation queue or [lib/storage's SecureStorage](../storage/README.md) instead)
- Authentication state detection (use [lib/auth's AuthStateManager](../auth/README.md) instead)
- Cache invalidation (use [lib/cache's QueryCache](../cache/README.md) tag-based invalidation instead)
- Connection simulation/mocking (use feature flags or [lib/config](../config/README.md) dev utilities instead)

## Architecture & Data Flow

```
Network Events
        ↓
Platform-specific detection:
  - Web: navigator.onLine, online/offline events, periodic ping
  - Native: react-native-netinfo, battery monitoring
        ↓
Normalize to ConnectionQuality:
  - GOOD: Excellent connection, all operations safe
  - BAD: Latency >500ms, packet loss detected, use smaller payloads
  - CELLULAR: On cellular/hotspot, possibly metered
  - OFFLINE: No network at all
        ↓
Notify subscribers (real-time updates)
        ↓
Error handler uses quality to decide:
  - Network error + offline → Serve stale cache
  - Network error + bad connection → Serve stale cache
  - Server error (5xx) → Serve stale cache
  - Client error (4xx) → Fail (real error)
```

## API Reference

### `useNetworkStatus(): NetworkStatus`
  const status = useNetworkStatus();

  if (status.connectionQuality === ConnectionQuality.OFFLINE) {
      <>
        <PoorConnectionWarning />
        <SmallPayloadList /> {/* Use lighter data */}
      </>
    );
  }

  if (status.isExpensive) {
    return <CellularWarning />;
  }

  return <NormalScreen />;
}
```

### `NetworkDetection.getCurrentStatus(): NetworkStatus`

Get current network status synchronously (no subscription).

```ts
import { NetworkDetection } from "@/lib/network";

const status = NetworkDetection.getCurrentStatus();
console.log(`Online: ${status.isOnline}, Quality: ${status.connectionQuality}`);
```

### `NetworkDetection.subscribe(callback: NetworkStatusCallback): () => void`

Subscribe to network status changes. Returns unsubscribe function.

  }
});
### `isNetworkError(error: any): boolean`

Determine if an error is network-related (not a logical/validation error).

```ts
import { isNetworkError } from "@/lib/network";

try {
  await fetchData();
} catch (error) {
  if (isNetworkError(error)) {
    // Try stale cache or retry
    return useFallback();
  } else {
    // Real validation/logic error
    throw error;
}
```

### `shouldServeStaleOnError(error: any, options: { isNetworkError: boolean; hasCache: boolean; isOnline: boolean }): boolean`

Decide whether to serve stale cache when error occurs.

```ts
import { isNetworkError, shouldServeStaleOnError } from "@/lib/network";
try {
  const data = await fetchLatestCharacters(worldId);
} catch (error) {
  const shouldServeStale = shouldServeStaleOnError(error, {
    hasCache: !!cachedCharacters,
    isOnline: NetworkDetection.getCurrentStatus().isOnline,
  });
  if (shouldServeStale) {
    return cachedCharacters; // Serve stale
  } else {
  }
}
```

## Interfaces
### `NetworkStatus`

Current network state.

```ts
  /** Is device connected to any network */
  isOnline: boolean;

  /** Network type: 'wifi' | 'cellular' | 'none' | 'unknown' */
  type: "wifi" | "cellular" | "none" | "unknown";
  /** Is connection expensive (cellular or low battery + not charging) */
  isExpensive: boolean;

  /** Connection quality for degraded modes */
  connectionQuality: ConnectionQuality;
  /** More accurate than isOnline (requires native package) */
  isInternetReachable?: boolean;
}
```
### `ConnectionQuality` Enum

```ts
  /** Excellent connection - can do all operations */
  GOOD = "good",

  BAD = "bad",

  /** WiFi disconnected, using cellular/hotspot - may be metered */

  /** No network service at all */
}
```

## Dependencies

- **`expo-network`** – Network detection on iOS/Android
- **`expo-battery`** – Battery status on iOS/Android (for expensive connection detection)
- **`expo-constants`** – Supabase URL from environment
- **`lib/utils/logger`** – Logging network state changes
- **`lib/api`** – HTTP requests (uses network detection indirectly)
- **`lib/cache`** – Stale cache serving via error handler

## File Breakdown

| File                   | Purpose                                                                  | Exports                                                                                             |
| ---------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `network-detection.ts` | Cross-platform network status detection. Tracks online/quality/battery.  | `NetworkDetection` (singleton), `useNetworkStatus` hook, `ConnectionQuality`, types                 |
| `network-config.ts`    | Configuration constants and dynamic Supabase health endpoint resolution. | `SUPABASE_HEALTH_ENDPOINT`, `WEB_PING_INTERVAL`, `LATENCY_THRESHOLD`, `getSupabaseHealthEndpoint()` |
| `error-handling.ts`    | Network error classification and stale cache decision logic.             | `isNetworkError()`, `shouldServeStaleOnError()`, `logNetworkError()`, `handleErrorGracefully()`     |
| `index.ts`             | Barrel export for public API.                                            | All public exports re-exported                                                                      |

## How It Works

### Network Detection Flow

**Web:**

1. Check `navigator.onLine` on startup
2. Listen to `online` / `offline` events
3. Periodically ping Supabase health endpoint (5 min intervals when app visible)
4. Measure latency to detect bad connections (>500ms)

**Native (iOS/Android):**

1. Use `expo-network` to detect wifi vs cellular

- If battery detection unavailable → Assume charging (conservative estimate)
- If latency check fails → Assume good connection (optimistic estimate)

### Error Handling Strategy

```ts
// When fetch fails:
1. Check isNetworkError(error)
2. Check isOnline status
3. Check hasCache
4. Decide: serve stale cache OR throw error

// Stale cache is served for:
- Network errors when offline
- Network errors when online but unreliable
- Server errors (5xx)

// Stale cache is NOT served for:
- Client errors (4xx)
- Validation errors (real logic errors)
```

## Configuration

### Environment Variables

- **`EXPO_PUBLIC_SUPABASE_URL`** – Used to construct health endpoint for pings
- **`EXPO_PUBLIC_SUPABASE_HEALTH_ENDPOINT`** (optional) – Override health endpoint explicitly

### Constants

All in `network-config.ts`:

```ts
WEB_PING_INTERVAL = 5 * 60 * 1000; // 5 minutes
WEB_PING_TIMEOUT = 5000; // 5 seconds
LATENCY_THRESHOLD = 500; // 500ms = poor connection
LOW_BATTERY_THRESHOLD = 0.2; // 20% = mark as expensive
```

Adjust these for different network conditions or battery strategies.

## State Machine

The network detection system uses an explicit state machine (`lib/network/state-machine.ts`) to manage recovery logic and side effects reliably.

### NetworkState Type

Six states define the network lifecycle:

| State          | Meaning                                 | Transitions To                     |
| -------------- | --------------------------------------- | ---------------------------------- |
| `INITIALIZING` | App starting, no status yet             | GOOD, BAD, CELLULAR, OFFLINE        |
| `GOOD`         | Network available, responsive           | BAD, CELLULAR, OFFLINE, RECOVERING  |
| `BAD`          | Network present but slow/high-latency   | GOOD, CELLULAR, OFFLINE, RECOVERING |
| `CELLULAR`      | Cellular/offline detected (iOS/Android) | GOOD, BAD, OFFLINE, RECOVERING     |
| `OFFLINE`      | No connectivity at all                  | INITIALIZING, RECOVERING           |
| `RECOVERING`   | Attempting reconnection with backoff    | GOOD, BAD, CELLULAR, OFFLINE        |

### Valid Transitions

The `VALID_TRANSITIONS` map enforces a strict directed graph. Key rules:

- **Recovery path**: `OFFLINE` can only reach `GOOD` via `RECOVERING` (ensures recovery side effects execute)
- **Initialization**: `INITIALIZING` only reachable at startup
- **WiFi switch**: `CELLULAR` ↔ `GOOD` allowed (iOS/Android WiFi toggles)

Invalid transitions are rejected with an error.

### Transition Hooks

Register callbacks to execute on specific transitions or any state change:

#### Specific Transition Hooks

Execute when a particular transition occurs (e.g., recovery completed):

```ts
import { NetworkStateManager } from "@/lib/network";

// Sync offline queue when recovering → good
NetworkStateManager.onSpecificTransition("RECOVERING", "GOOD", async () => {
  await syncOfflineQueue();
  await invalidateCacheOlderThan(2 * 60 * 60 * 1000); // 2 hours stale
  AppToast.show("Connection restored");
});
```

#### Global Transition Hooks

Execute on every state change:

```ts
// Log all transitions
NetworkStateManager.onTransition((from, to) => {
  logger.info("network", `State: ${from} → ${to}`);
});
```

Hooks are registered once (typically at app bootstrap in `AppKernelProvider`) and execute for all subsequent transitions. Unsubscribe by calling the returned function.

### Recovery Backoff

When transitioning to `RECOVERING`, the manager applies exponential backoff with a 30-second cap:

- 1st retry: 1s delay
- 2nd retry: 2s delay
- 3rd retry: 4s delay
- ... (2^n pattern)
- Cap: 30s max

Query retry state:

```ts
const retries = NetworkStateManager.getRecoveryRetries();
const backoffMs = NetworkStateManager.getRecoveryBackoff(); // milliseconds until next retry

// Use in recovery logic:
await delay(backoffMs);
await attemptReconnection();
```

### Testing & Simulation

For unit tests, manually transition the state machine and verify hook execution:

```ts
import { NetworkStateManager } from "@/lib/network";

// Register test hook
let transitioned = false;
NetworkStateManager.onSpecificTransition("OFFLINE", "RECOVERING", () => {
  transitioned = true;
});

// Simulate offline → recovering → good sequence
await NetworkStateManager.transitionTo("OFFLINE");
await NetworkStateManager.transitionTo("RECOVERING");
await NetworkStateManager.transitionTo("GOOD");

expect(transitioned).toBe(true);

// Reset for next test
NetworkStateManager.reset(); // clears state, hooks, retry count
```

## Related Modules

- **`lib/api`** – RequestManager uses network detection for retry logic
- **`lib/cache`** – QueryCache works with error handler to serve stale data
- **`lib/analytics`** – Track network quality for performance monitoring
- **`lib/offline`** – Future offline queue system will build on network detection

## Testing

### Manual Testing

- **Offline mode:** Use browser DevTools → Network tab → set to "Offline"
- **Poor connection:** Use browser DevTools → Network → set to "Slow 3G"
- **Cellular + low battery:** Use iOS/Android simulators to change battery level

### Unit Tests

Create `__tests__/lib/network/detection.test.ts`:

- Mock platform detection (web vs native)
- Test status transitions (online → offline → online)
- Test connection quality detection (good/bad/expensive)
- Test listeners/subscriptions
- Test battery threshold logic

### Integration Tests

Create `__tests__/lib/network/error-handling.test.ts`:

- Test error classification (network vs client error)
- Test stale cache decisions (when to serve, when to reject)
- Test with various error codes (0, 4xx, 5xx, custom network errors)

## Performance Notes

- Network detection is lightweight (no polling by default)
- Web ping runs every 5 minutes only when app is visible
- Native detection uses OS-level callbacks (no polling)
- Subscription updates are batched (debounced)
- Current status available synchronously (no async needed)

## Known Limitations

- Web ping relies on Supabase being available (CSP whitelisted)
- Battery detection unavailable on web (fallback: assume charging)
- Connection type unavailable on older web browsers (fallback: "unknown")
- Latency detection via ping only on web (native relies on OS detection)

## Integration with Offline Mutation Queue

The **[lib/offline module](../offline/README.md)** uses `NetworkDetection` to automatically sync queued mutations when connection is restored:

```ts
// In OnlineSyncManager
NetworkDetection.subscribe((status) => {
  if (status.isOnline && status.connectionQuality === "GOOD") {
    // Trigger sync of queued mutations
    await syncQueuedMutations();
  }
});
```

## Adaptive Payload Sizing (Issue #205)

Automatically reduce API payload complexity based on network quality.

### Architecture

```
NetworkDetection.getStatus()
        ↓
    {effectiveType: '4g'|'3g'|'2g'|'slow-2g'|'offline'}
        ↓
getAdaptivePayloadOptions()
        ↓
{imageQuality: 'hd'|'sd'|'thumb',
 includeDetails: true|false,
 includeMaps: true|false,
 maxPayloadSize: number}
        ↓
buildAdaptiveQueryParams()
        ↓
Request sent with params: ?imageQuality=sd&excludeMaps=true&summaryOnly=true
        ↓
Server responds with appropriately sized payload
        ↓
RequestManager caches result + invalidates on quality change
```

### Quality Tiers

| Connection | Quality | Images | Details | Maps | Max Size |
|-----------|---------|--------|---------|------|----------|
| 4G        | HD      | Full   | Full    | Yes  | 5MB      |
| 3G        | SD      | Medium | Full    | No   | 2MB      |
| 2G        | Thumb   | Small  | Summary | No   | 500KB    |
| Offline   | Text    | None   | Summary | No   | 0        |

### API Reference

#### `getAdaptivePayloadOptions(status: NetworkStatus): AdaptivePayloadOptions`

Maps connection quality to payload options.

```ts
import { getAdaptivePayloadOptions } from '@/lib/network';
import { NetworkDetection } from '@/lib/network';

const status = NetworkDetection.getStatus();
const options = getAdaptivePayloadOptions(status);

console.log(options); // { imageQuality: 'sd', includeMaps: false, ... }
```

#### `buildAdaptiveQueryParams(options: AdaptivePayloadOptions): Record<string, any>`

Converts payload options to query parameters for server request.

```ts
import { buildAdaptiveQueryParams, getAdaptivePayloadOptions } from '@/lib/network';

const status = NetworkDetection.getStatus();
const options = getAdaptivePayloadOptions(status);
const params = buildAdaptiveQueryParams(options);
// Result: { imageQuality: 'sd', excludeMaps: 'true', summaryOnly: 'true', ... }

// Use in RequestManager:
const data = await RequestManager.fetch(url, fetcher, { params });
```

#### `appendAdaptiveParams(key: string): string`

Appends quality params to a URL or cache key.

```ts
import { appendAdaptiveParams } from '@/lib/network';

// Automatically appends based on current network quality
const keyWithParams = appendAdaptiveParams('worlds:list');
// Result: 'worlds:list?imageQuality=hd&...' (if 4G)
//      or 'worlds:list?imageQuality=thumb&...' (if 2G)
```

#### `useAdaptivePayload(): { networkStatus, payloadOptions }`

React hook for UI awareness of current quality tier.

```ts
import { useAdaptivePayload } from '@/hooks/network/use-adaptive-payload';

function MyComponent() {
  const { payloadOptions } = useAdaptivePayload();
  
  return (
    <>
      {payloadOptions.includeDetails && <FullDescription />}
      {!payloadOptions.includeDetails && <Summary />}
      {payloadOptions.includeMaps && <MapComponent />}
    </>
  );
}
```

### Integration with RequestManager

RequestManager automatically injects adaptive params for HTTP-like URLs:

```ts
// Auto-inject adaptive params for /api/* URLs
const data = await RequestManager.fetch(
  '/api/worlds',
  () => worldsAPI.getWorlds(),
  {
    useAdaptiveParams: true, // Default for HTTP URLs
    useQueryCache: true,
  }
);

// or explicit params override
const data = await RequestManager.fetch(
  '/api/worlds',
  () => worldsAPI.getWorlds(),
  {
    params: { limit: 20, offset: 0 },
    useAdaptiveParams: true, // Still injects imageQuality, etc.
  }
);

// Disable for internal cache keys
const data = await RequestManager.fetch(
  'worlds:list:local',
  () => localCache.getWorlds(),
  {
    useAdaptiveParams: false, // Don't append to internal keys
  }
);
```

### Cache Strategy

Include quality tier in cache keys so variants are stored separately:

```ts
import { getQualityAwareCacheKey } from '@/lib/network/adaptive-payload-integration';

const queryKey = getQualityAwareCacheKey({
  baseCacheKey: 'worlds:list',
  cacheTagsToInvalidate: ['worlds'],
});
// Result: 'worlds:list:4g' or 'worlds:list:2g' (depending on quality)
```

### Auto-Invalidation on Quality Change

When network quality changes, cache automatically invalidates and refetches:

```ts
import { useAdaptivePayloadCacheInvalidation } from '@/hooks/network/useAdaptivePayloadCacheInvalidation';

function WorldsList() {
  // Subscribe to network quality changes
  useAdaptivePayloadCacheInvalidation({
    tagsToInvalidate: ['worlds', 'characters'],
  });

  const { worlds } = useWorldsQuery(); // Auto-refetches on quality change
  return <>{worlds.map(w => <WorldCard key={w.id} world={w} />)}</>;
}
```

### Server Support

Server support for quality params is **optional**. Clients send params; servers gracefully ignore unsupported ones:

- Servers that support quality params respond with appropriately sized payloads
- Servers that don't support params return full payload (same as before)
- Clients gracefully handle both cases

Implement server-side support via Issue #XXX - Server-Side Image Variants.

### Related Modules

- **[lib/api/request-manager](../api/README.md)** – Injects params automatically
- **[lib/cache/QueryCache](../cache/README.md)** – Caches variants per quality tier
- **[lib/offline](../offline/README.md)** – Uses adaptive payloads for mutation queuing
- **Issue #206** – Network Offline Queue
- **Issue #208** – Network Telemetry (tracks quality distribution)

### Known Limitations

- **Server-side variants not yet implemented** – Client requests quality params, but server doesn't resize. Implement via Issue #XXX
- **Progressive loading not implemented** – Images don't incrementally improve quality. Phase 4+ enhancement
- **No manual override** – Users can't manually force HD on 2G. Can be added as debug feature

---

**Key Integration Points:**

- **Online Detection**: When `NetworkDetection.isOnline` transitions from `false` → `true`, `OnlineSyncManager` begins syncing queued mutations
- **Connection Quality**: Sync only starts when quality is stable (GOOD); BAD/CELLULAR connections continue queueing
- **Debouncing**: Rapid online/offline flapping is debounced (5000ms default) to avoid redundant sync attempts
- **Error Handling**: If sync fails, mutations remain queued and retry with exponential backoff

See [lib/offline/README.md](../offline/README.md#architecture--data-flow) for complete offline queue architecture.

## Future Enhancements

See `docs/suggestions/` for planned improvements:

1. ✅ **Offline queue system** – IMPLEMENTED (see [lib/offline](../offline/README.md))
2. **Network quality prediction** – ML-based prediction of connection quality
3. **Adaptive payload sizing** – Automatically reduce payloads based on connection
4. **Telemetry & metrics** – Track network quality distribution, impact on UX
5. **Custom health endpoints** – Allow apps to use their own health check URL
6. **Connection state machine** – Explicit state transitions with hooks

## Notes

- Network status is real-time but may have slight delay on native (OS event batching)
- Offline detection is conservative: waits for clear offline signal before marking offline
- Stale cache strategy is "optimistic" – serves cache on any network uncertainty
- Future: offline mutation queue will require more sophisticated detection
