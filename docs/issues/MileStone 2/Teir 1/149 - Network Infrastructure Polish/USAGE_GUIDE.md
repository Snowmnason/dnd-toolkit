# Network Detection - Usage Guide

Complete guide for using the network detection system with connection quality tracking, battery awareness, and degraded mode support.

## Quick Start

### Get Network Status

```typescript
import { useNetworkStatus, ConnectionQuality } from '@/lib/network';

function MyComponent() {
  const { isOnline, connectionQuality, type, isExpensive } = useNetworkStatus();

  if (connectionQuality === ConnectionQuality.OFFLINE) {
    return <div>Offline - showing cached data</div>;
  }

  if (connectionQuality === ConnectionQuality.BAD) {
    return <div>Poor connection - using reduced features</div>;
  }

  if (isExpensive) {
    return <div>Metered connection - be mindful of data usage</div>;
  }

  return <div>Great connection - full features available</div>;
}
```

### Listen to Network Changes

```typescript
import { NetworkDetection } from "@/lib/network";

// Subscribe to changes
const unsubscribe = NetworkDetection.subscribe((status) => {
  console.log("Network changed:", {
    isOnline: status.isOnline,
    quality: status.connectionQuality,
    expensive: status.isExpensive,
  });
});

// Cleanup when done
return () => unsubscribe();
```

### Check Network State Programmatically

```typescript
import { NetworkDetection, ConnectionQuality } from "@/lib/network";

const status = NetworkDetection.getStatus();

// Simple check
if (!status.isOnline) {
  // Handle offline
}

// Check connection quality for API decisions
if (status.connectionQuality === ConnectionQuality.BAD) {
  // Use compression, smaller payloads, reduce request frequency
}

// Check if expensive for sync decisions
if (status.isExpensive) {
  // Defer non-critical sync, warn user about data usage
}
```

## Connection Quality States

The system tracks four distinct connection states for implementing progressive degradation:

### GOOD

- **When**: WiFi connection with normal latency (< 500ms average)
- **Use Case**: Full feature set, large payloads, frequent sync
- **Example**:
  ```typescript
  if (status.connectionQuality === ConnectionQuality.GOOD) {
    // Safe to sync large campaign maps
    // Can fetch high-res images
    // Can update frequently
  }
  ```

### BAD

- **When**: WiFi connection with high latency (> 500ms average)
- **Indicators**: Slow/laggy WiFi, airport networks, crowded areas
- **Use Case**: Reduce payload sizes, batch requests, increase intervals
- **Example**:
  ```typescript
  if (status.connectionQuality === ConnectionQuality.BAD) {
    // Use thumbnail images instead of full resolution
    // Batch multiple API calls into one request
    // Increase sync interval from 1s to 5s
    // Disable real-time updates temporarily
  }
  ```

### CELLULAR

- **When**: Connected via cellular/mobile hotspot
- **Indicators**: `type === 'cellular'`
- **Use Case**: Warn user, restrict data-heavy operations
- **Example**:
  ```typescript
  if (status.connectionQuality === ConnectionQuality.CELLULAR) {
    // Show "Cellular connection" indicator
    // Warn before downloading large files
    // Defer auto-sync of large worlds
    // Compress data more aggressively
  }
  ```

### OFFLINE

- **When**: No network service at all
- **Indicators**: `isOnline === false` or `type === 'none'`
- **Use Case**: Show offline UI, use cached data only
- **Example**:
  ```typescript
  if (status.connectionQuality === ConnectionQuality.OFFLINE) {
    // Show "Offline Mode" banner
    // Disable all sync operations
    // Show last-synced timestamp
    // Queue mutations for when online
  }
  ```

## Battery-Aware Operations

The `isExpensive` flag indicates when operations should be deferred:

```typescript
const status = useNetworkStatus();

// Expensive = cellular OR (low battery < 20% AND not charging)
if (status.isExpensive) {
  // Skip auto-sync in background
  // Don't start large uploads/downloads
  // Reduce animation frame rate
  // Defer non-critical tasks
}
```

### Battery Tracking

**Web**: Battery Status API (if browser supports it)

- Real-time level and charging updates
- Threshold: 20% battery without charger

**Native (iOS/Android)**: react-native-device-info

- Polling every 30 seconds
- Threshold: 20% battery without charger

## Platform-Specific Behavior

### Web

- **Online Detection**: `navigator.onLine` + visibility changes
- **Latency Measurement**: Periodic ping every 5 minutes
- **Battery Tracking**: Battery Status API (declining browser support)
- **Fallback**: Works without any packages

### iOS/Android

- **Network Detection**: @react-native-community/netinfo (installed)
- **Type Detection**: Distinguishes WiFi vs cellular
- **Battery Tracking**: react-native-device-info (optional)
- **Graceful Degradation**: Works even if packages unavailable

### Desktop

- Same as native platforms (Electron uses React Native)

## Implementation Patterns

### Pattern 1: Conditional Rendering

```typescript
import { useNetworkStatus, ConnectionQuality } from '@/lib/network';

export function SyncButton() {
  const { connectionQuality } = useNetworkStatus();
  const isDisabled = connectionQuality === ConnectionQuality.OFFLINE;

  return (
    <button disabled={isDisabled} onClick={sync}>
      {isDisabled ? 'Offline' : 'Sync Now'}
    </button>
  );
}
```

### Pattern 2: Payload Optimization

```typescript
function selectImageSize(
  quality: ConnectionQuality
): "thumb" | "normal" | "high" {
  switch (quality) {
    case ConnectionQuality.OFFLINE:
      return "thumb"; // Cached only
    case ConnectionQuality.BAD:
      return "thumb"; // Smallest size
    case ConnectionQuality.CELLULAR:
      return "normal"; // Balanced
    case ConnectionQuality.GOOD:
      return "high"; // Full resolution
  }
}
```

### Pattern 3: Request Batching

```typescript
function getBatchInterval(quality: ConnectionQuality): number {
  switch (quality) {
    case ConnectionQuality.GOOD:
      return 1000; // 1 second
    case ConnectionQuality.BAD:
      return 5000; // 5 seconds
    case ConnectionQuality.CELLULAR:
      return 10000; // 10 seconds
    case ConnectionQuality.OFFLINE:
      return Infinity; // Don't batch, queue only
  }
}
```

### Pattern 4: Background Sync

```typescript
useEffect(() => {
  const unsubscribe = NetworkDetection.subscribe((status) => {
    // Only sync in background if connection is good
    if (
      status.isOnline &&
      status.connectionQuality === ConnectionQuality.GOOD &&
      !status.isExpensive
    ) {
      startBackgroundSync();
    }
  });

  return unsubscribe;
}, []);
```

## Accessing Network Status from AppKernel

The kernel stores current network status and updates it as it changes:

```typescript
import { useAppKernel } from "@/hooks/use-app-kernel";

function MyComponent() {
  const kernel = useAppKernel();

  // Network status is always available after bootstrap
  if (kernel.state.networkStatus?.isOnline) {
    // Do something
  }
}
```

## Troubleshooting

### Network Status Not Updating

1. **Check Initialization**: Ensure AppKernel has completed bootstrap

   ```typescript
   const kernel = useAppKernel();
   if (!kernel.phases.networkReady) {
     return <Loading />;
   }
   ```

2. **Verify Hook Usage**: `useNetworkStatus()` must be in a component

   ```typescript
   // ✅ Correct
   function MyComponent() {
     const status = useNetworkStatus();
   }

   // ❌ Wrong
   const status = useNetworkStatus(); // Called outside component
   ```

3. **Check Network Package**: On native platforms, @react-native-community/netinfo must be installed
   ```bash
   npm list @react-native-community/netinfo
   ```

### Latency Not Updating (Web)

- Web ping runs every 5 minutes
- Latency is averaged over last 10 pings
- Quality is calculated from average, not single ping
- May take 50+ minutes to see BAD quality on slow connection

### Battery Tracking Not Working

**Web**: Battery Status API is deprecated/removed in many browsers

- Only works on some browsers (Chrome, Firefox)
- Falls back to `charging: false` if unavailable

**Native**: Requires react-native-device-info

- Will silently skip battery tracking if package unavailable
- Polling happens every 30 seconds (not real-time)

### AppKernel Not Setting networkReady

Check that:

1. `NetworkDetection.initialize()` completed (check logs)
2. No errors in Network phase of bootstrap (check `kernel.state.error`)
3. Platform detection is working (check `kernel.state.capabilities.platform`)

## Advanced Usage

### Custom Network Monitoring

```typescript
import { NetworkDetection, NetworkStatusCallback } from "@/lib/network";

const listener: NetworkStatusCallback = (status) => {
  // Log all changes
  console.log("Network:", {
    isOnline: status.isOnline,
    type: status.type,
    quality: status.connectionQuality,
    expensive: status.isExpensive,
  });
};

const unsubscribe = NetworkDetection.subscribe(listener);
```

### Combining with Error Handling

```typescript
import { NetworkDetection } from "@/lib/network";
import { handleNetworkError } from "@/lib/network/error-handling";

async function fetchData() {
  try {
    const response = await fetch("/api/data");
    return response.json();
  } catch (error) {
    // Error handler checks network status automatically
    await handleNetworkError(error);
  }
}
```

### Conditional API Strategy

```typescript
function getApiConfig(quality: ConnectionQuality) {
  return {
    timeout: quality === ConnectionQuality.BAD ? 30000 : 10000,
    retries: quality === ConnectionQuality.BAD ? 3 : 1,
    compress: quality === ConnectionQuality.CELLULAR,
    batchSize: quality === ConnectionQuality.GOOD ? 50 : 10,
  };
}
```

## API Reference

### `useNetworkStatus()`

React hook that subscribes to network status changes.

```typescript
function useNetworkStatus(): NetworkStatus;
```

**Returns**: Current network status object

**Note**: Re-renders component when status changes

### `NetworkDetection.subscribe(callback)`

Subscribe to network status changes (without React).

```typescript
function subscribe(callback: NetworkStatusCallback): () => void;
```

**Parameters**:

- `callback`: Function called when status changes

**Returns**: Unsubscribe function

**Example**:

```typescript
const unsubscribe = NetworkDetection.subscribe((status) => {
  console.log(status);
});

// Later
unsubscribe();
```

### `NetworkDetection.getStatus()`

Get current network status synchronously.

```typescript
function getStatus(): NetworkStatus;
```

**Returns**: Current network status (always has data, never null)

### `NetworkDetection.getConnectionQuality()`

Get current connection quality state.

```typescript
function getConnectionQuality(): ConnectionQuality;
```

**Returns**: One of: `'good'`, `'bad'`, `'no-wifi'`, `'offline'`

### Types

```typescript
export enum ConnectionQuality {
  GOOD = "good",
  BAD = "bad",
  CELLULAR = "no-wifi",
  OFFLINE = "offline",
}

export interface NetworkStatus {
  /** Is device connected to any network */
  isOnline: boolean;

  /** Network type: wifi, cellular, none, unknown */
  type: "wifi" | "cellular" | "none" | "unknown";

  /** Is connection expensive (cellular or low battery + not charging) */
  isExpensive: boolean;

  /** Connection quality for implementing degraded modes */
  connectionQuality: ConnectionQuality;

  /** More accurate than isOnline (requires native package) */
  isInternetReachable?: boolean;
}

export type NetworkStatusCallback = (status: NetworkStatus) => void;
```

## Best Practices

1. **Use the hook for React components** - Simpler than subscribe()
2. **Check quality before large operations** - Respect user's connection
3. **Show connection indicators** - Help users understand their experience
4. **Warn on expensive connections** - Cellular data is precious
5. **Queue mutations offline** - Don't lose user data
6. **Test on real networks** - Simulator doesn't catch all issues
7. **Monitor logs** - Check `logger.category('network')` for issues
8. **Handle gracefully** - App works offline, just with limitations

## Testing Checklist

- [ ] App starts on web without network packages
- [ ] Network status updates when toggling DevTools offline
- [ ] Connection quality changes with latency simulation
- [ ] Battery tracking shows in console logs (if available)
- [ ] AppKernel completes bootstrap successfully
- [ ] No memory leaks from subscriptions
- [ ] Mobile: WiFi to cellular switch detected
- [ ] Mobile: Airplane mode toggles offline state
