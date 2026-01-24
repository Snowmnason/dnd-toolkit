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
  - NO_WIFI: On cellular/hotspot, possibly metered
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

React hook to subscribe to network status updates. Returns current status immediately and re-renders when status changes.

```ts
import { useNetworkStatus } from '@/lib/network';

export function MyComponent() {
  const status = useNetworkStatus();

  if (status.connectionQuality === ConnectionQuality.OFFLINE) {
    return <OfflineMessage />;
  }

  if (status.connectionQuality === ConnectionQuality.BAD) {
    return (
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

```ts
const unsubscribe = NetworkDetection.subscribe((status) => {
  if (status.isOnline === false) {
    showOfflineIndicator();
  }
});

// Later: unsubscribe when done
unsubscribe();
```

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
}
```

### `shouldServeStaleOnError(error: any, options: { isNetworkError: boolean; hasCache: boolean; isOnline: boolean }): boolean`

Decide whether to serve stale cache when error occurs.

```ts
import { isNetworkError, shouldServeStaleOnError } from "@/lib/network";

try {
  const data = await fetchLatestCharacters(worldId);
  return data;
} catch (error) {
  const shouldServeStale = shouldServeStaleOnError(error, {
    isNetworkError: isNetworkError(error),
    hasCache: !!cachedCharacters,
    isOnline: NetworkDetection.getCurrentStatus().isOnline,
  });

  if (shouldServeStale) {
    return cachedCharacters; // Serve stale
  } else {
    throw error;
  }
}
```

## Interfaces

### `NetworkStatus`

Current network state.

```ts
interface NetworkStatus {
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
enum ConnectionQuality {
  /** Excellent connection - can do all operations */
  GOOD = "good",

  /** Poor connection - latency/packet loss detected - use smaller payloads */
  BAD = "bad",

  /** WiFi disconnected, using cellular/hotspot - may be metered */
  NO_WIFI = "no-wifi",

  /** No network service at all */
  OFFLINE = "offline",
}
```

## Dependencies

### External Packages

- **`expo-network`** – Network detection on iOS/Android
- **`expo-battery`** – Battery status on iOS/Android (for expensive connection detection)
- **`expo-constants`** – Supabase URL from environment

### Internal Dependencies

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
2. Monitor `expo-battery` to mark cellular + low battery as "expensive"
3. React to real-time state changes via native listeners

**Graceful Degradation:**

- If Supabase health endpoint fails → Fall back to `navigator.onLine` / native API
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

## Future Enhancements

See `docs/suggestions/` for planned improvements:

1. **Offline queue system** – Queue mutations when offline, sync when online
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
