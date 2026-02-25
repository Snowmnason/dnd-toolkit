# Network Detection - Implementation Reference

Architecture and implementation details for the network detection system. This document covers platform-specific behavior, integration points, and technical decisions.

## System Architecture

### Core Components

```
NetworkDetection (Singleton)
├── Web Detection (navigator.onLine)
├── Native Detection (@react-native-community/netinfo)
├── Battery Tracking (Battery Status API + device-info)
├── Periodic Ping (Web fallback)
└── Listeners (Subscribe/notify pattern)
```

### Data Flow

```
[Platform Events] → [Detection Class] → [Status Update] → [Listeners]
     ↓                      ↓                   ↓              ↓
  - navigator.onLine    - Load NetInfo     - Update     - React hooks
  - visibilitychange    - Setup listeners  - Calculate  - Custom subs
  - Battery API         - Parse events     - Log        - AppKernel
  - NetInfo events      - Measure latency  - Notify     - UI components
```

## Platform-Specific Implementation

### Web Implementation

**Online Detection**:

```typescript
// Initial status
this.currentStatus.isOnline = navigator.onLine;

// Listen to events
window.addEventListener("online", () => updateStatus({ isOnline: true }));
window.addEventListener("offline", () => updateStatus({ isOnline: false }));

// Check on app visibility
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    // Recheck in case connection changed while backgrounded
  }
});
```

**Periodic Ping**:

```typescript
// Every 5 minutes, ping to verify connectivity
setInterval(
  () => {
    // Fetch lightweight data URL (avoids CORS)
    // Measure latency using performance.now()
    // Track last 10 latencies
    // Calculate average latency
    // Update quality based on 500ms threshold
  },
  5 * 60 * 1000
);
```

**Battery Status API**:

```typescript
// Modern API (deprecated but still supported)
navigator
  .getBattery?.()
  ?.addEventListener("levelchange", updateExpensiveFlag)
  ?.addEventListener("chargingchange", updateExpensiveFlag);

// Falls back to no battery tracking if unavailable
```

### Native Implementation

**Network Detection** (@react-native-community/netinfo):

```typescript
// Dynamic import with error handling
const { NetInfo } = await import("@react-native-community/netinfo");

// Subscribe to state changes
NetInfo.addEventListener((state) => {
  // state.type: 'wifi' | 'cellular' | 'none' | 'unknown'
  // state.isInternetReachable: boolean | null
  // state.details?.isConnectionExpensive: boolean
});
```

**Battery Tracking** (react-native-device-info):

```typescript
// Optional - polls every 30 seconds
setInterval(async () => {
  const level = await deviceInfo.getBatteryLevel?.();
  const charging = await deviceInfo.isCharging?.();
  // Update battery state
}, 30000);
```

## Connection Quality Algorithm

Quality is determined by network type and measured latency:

```typescript
private updateConnectionQuality(): void {
  // 1. Check if online
  if (!isOnline) return OFFLINE;

  // 2. Check type
  if (type === 'none') return OFFLINE;
  if (type === 'cellular') return CELLULAR;

  // 3. Check latency (WiFi only)
  if (type === 'wifi') {
    const avgLatency = calculateAverage(last10Pings);
    return avgLatency > 500ms ? BAD : GOOD;
  }

  // 4. Default
  return GOOD;
}
```

**Latency Calculation**:

```typescript
// Store last 10 pings
pingLatencies: number[] = [];

// Each ping appends latency
this.pingLatencies.push(performance.now() - startTime);

// Keep window of 10
if (this.pingLatencies.length > 10) {
  this.pingLatencies.shift();
}

// Calculate average
const avg = pingLatencies.reduce((a, b) => a + b) / pingLatencies.length;
```

## Expensive Flag Logic

Determines when operations should be deferred:

```typescript
private updateExpensiveFlag(): void {
  const isCellular = type === 'cellular';
  const isLowBattery = battery.level != null && battery.level < 0.20;
  const isCharging = battery.charging;

  // Expensive if:
  // - Using cellular, OR
  // - Low battery AND not charging
  const isExpensive = isCellular || (isLowBattery && !isCharging);

  if (isExpensive !== oldStatus.isExpensive) {
    updateStatus({ isExpensive });
  }
}
```

**Threshold**: 20% (LOW_BATTERY_THRESHOLD = 0.20)

## Initialization Flow

### Phase 1: AppKernel Bootstrap

```typescript
// During NETWORK phase in AppKernel
await NetworkDetection.initialize();

// Setup subscription
NetworkDetection.subscribe((status) => {
  // Update kernel state
  updateState({ networkStatus: status });
});

// Get initial status
const initialStatus = NetworkDetection.getStatus();
```

### Phase 2: Network Detection Setup

```typescript
async initialize() {
  // 1. Web detection (always)
  if (typeof window !== 'undefined') {
    setupWebNetworkDetection();  // Listen to events
    setupWebPeriodicPing();      // Start 5-min timer
  }

  // 2. Battery tracking (web + native)
  await setupBatteryTracking();

  // 3. Native detection (only on native)
  if (!isWeb && !isWebPlatform) {
    const NetInfo = await loadNetInfo();
    if (NetInfo) setupNativeNetworkDetection(NetInfo);
  }
}
```

## Error Handling

All errors are non-blocking and gracefully degrade:

```typescript
// Package loading errors
try {
  const NetInfo = await import("@react-native-community/netinfo");
} catch (error) {
  logger.catorgy("-").debug("Failed to load NetInfo (non-critical)");
  // Continue without native detection
  return null;
}

// Listener errors
try {
  listener(currentStatus);
} catch (error) {
  logger.catogery("other").error("Listener error", error);
  // Continue notifying other listeners
}

// Battery tracking errors
try {
  const battery = await navigator.getBattery?.();
} catch (error) {
  logger.catorgy("-").debug("Battery API unavailable");
  // Continue without battery tracking
}
```

## Integration Points

### AppKernel

**Location**: `lib/kernel/app-kernel.ts`

**Integration**:

1. Imported at top: `import { NetworkDetection } from '@/lib/network'`
2. Initialized in Phase 3: `await NetworkDetection.initialize()`
3. Subscribed for updates: `NetworkDetection.subscribe(updateHandler)`
4. Stored in state: `kernel.state.networkStatus`

**Usage**:

```typescript
const kernel = useAppKernel();
if (kernel.state.networkStatus?.isOnline) {
  // Network is ready
}
```

### Error Handling

**Location**: `lib/network/error-handling.ts`

**Integration**:

```typescript
// Check network before determining cache strategy
const isOnline = NetworkDetection.isOnline();
const quality = NetworkDetection.getConnectionQuality();

if (quality === ConnectionQuality.OFFLINE) {
  // Return from cache only
} else if (quality === ConnectionQuality.BAD) {
  // Return from cache first, try to refresh
}
```

## Type System

### Type Declarations

Files created for optional packages:

- `types/react-native-community-netinfo.d.ts` - NetInfo interface
- `types/react-native-device-info.d.ts` - Battery functions

This allows TypeScript to work without these packages installed (graceful degradation).

### Exported Types

```typescript
// From lib/network/network-detection.ts

export enum ConnectionQuality {
  GOOD = "good",
  BAD = "bad",
  CELLULAR = "no-wifi",
  OFFLINE = "offline",
}

export interface NetworkStatus {
  isOnline: boolean;
  type: "wifi" | "cellular" | "none" | "unknown";
  isExpensive: boolean;
  connectionQuality: ConnectionQuality;
  isInternetReachable?: boolean;
}

export type NetworkStatusCallback = (status: NetworkStatus) => void;
```

## Logging

All network events logged via `logger.category('network')`:

```typescript
logger.category('network').info('Network detection initialized', { ... });
logger.category('network').debug('Battery level changed', { level: 0.25 });
logger.category('network').info('Connection quality changed', { from: GOOD, to: BAD });
logger.category('network').warn('Failed to setup native detection:', error);
logger.category('network').error('Listener error:', error);
```

**Filter in dev tools**:

```javascript
// Show only network logs
localStorage.setItem("loggerCategories", JSON.stringify(["network"]));
```

## Performance Considerations

### Memory Usage

- **Listeners**: Stored in Set, cleaned up via unsubscribe
- **Ping Latencies**: Only last 10 stored (~40 bytes)
- **Battery Status**: Single object reference

### CPU Usage

- **Web Ping**: 1 fetch every 5 minutes (negligible)
- **Native Battery Poll**: Every 30 seconds (negligible)
- **Event Listeners**: Immediate updates (no polling)

### Network Impact

- **Web Ping**: ~1KB every 5 minutes = ~288 bytes/hour
- Minimal impact even on metered connections

## Testing Strategy

### Unit Testing

Test connection quality algorithm:

```typescript
test("BAD quality when latency > 500ms", () => {
  // Set wifi type, latency > 500ms
  // Assert quality === ConnectionQuality.BAD
});

test("Expensive when cellular", () => {
  // Set type = 'cellular'
  // Assert isExpensive === true
});
```

### Integration Testing

1. **Web**: Use DevTools offline simulator
2. **Mobile**: Use Airplane Mode, WiFi/cellular toggle
3. **Battery**: Use simulator battery settings

### Manual Testing

```typescript
// In console
import { NetworkDetection, ConnectionQuality } from "@/lib/network";

// Check status
NetworkDetection.getStatus();
NetworkDetection.getConnectionQuality();

// Subscribe for debugging
NetworkDetection.subscribe(console.log);

// Simulate events
window.dispatchEvent(new Event("offline"));
window.dispatchEvent(new Event("online"));
```

## Future Enhancements

1. **Signal Quality**: Measure RSSI (WiFi signal strength)
2. **Bandwidth Estimation**: Measure actual speeds
3. **Connection Type Detection**: Distinguish 4G vs 5G
4. **User Preferences**: Let users override connection type
5. **Analytics**: Track connection quality distribution
6. **Recovery Strategies**: Auto-retry with backoff based on quality

## Files

- **`lib/network/network-detection.ts`** (650+ lines)
  - Core NetworkDetectionClass
  - Web, native, battery implementations
  - Connection quality algorithm
  - useNetworkStatus hook

- **`lib/utils/logger.ts`** (Updated)
  - Added 'network' category

- **`types/react-native-community-netinfo.d.ts`** (Created)
  - Type declarations for optional package

- **`types/react-native-device-info.d.ts`** (Created)
  - Type declarations for optional battery package

- **`docs/issues/MileStone 2/149 - Network Infrastructure Polish/`** (Created)
  - USAGE_GUIDE.md (this file)
  - IMPLEMENTATION_REFERENCE.md (this file)
