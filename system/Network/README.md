# System Network Module

Low-level network detection and connectivity monitoring providing platform-agnostic network status. Handles cross-platform network APIs, connection quality assessment, and state transitions. Pure network layer with no business logic.

## When to Use This Module

**Use this module for:**

- Detecting network connectivity status
- Assessing connection quality (online/offline/cell/wifi)
- Monitoring network state changes
- Platform-specific network API abstraction
- Network health checking

**Don't use this module for:**

- Business logic based on network status (belongs in lib/network)
- UI network indicators (belongs in hooks)
- Network-dependent features (belongs in lib modules)
- Offline queue management (belongs in lib/offline)

## Architecture & Data Flow

```
Platform APIs → NetworkDetection → State Machine
                                       ↓
Status Assessment → Quality Classification
                                       ↓
State Transitions → Event Emission → Subscribers
```

**Key Components:**

- **NetworkDetection**: Platform-specific network monitoring
- **StateMachine**: Manages network state transitions
- **ConnectionQuality**: Classifies connection types
- **EventEmitter**: Broadcasts network changes

## API Reference

### Network Detection

#### `NetworkDetection.getStatus(): NetworkStatus`

Get current network status synchronously.

```typescript
import { NetworkDetection } from '@/system/Network';

const status = NetworkDetection.getStatus();
if (status.isOnline) {
  // Network available
}
```

#### `NetworkDetection.subscribe(callback: (status: NetworkStatus) => void): () => void`

Subscribe to network status changes.

```typescript
const unsubscribe = NetworkDetection.subscribe((status) => {
  console.log('Network changed:', status.connectionQuality);
});

// Later
unsubscribe();
```

### Network Status

```typescript
interface NetworkStatus {
  isOnline: boolean;
  type: 'wifi' | 'cellular' | 'none' | 'unknown';
  isExpensive: boolean;
  connectionQuality: ConnectionQuality;
  isInternetReachable?: boolean;
}
```

### Connection Quality

```typescript
enum ConnectionQuality {
  GOOD = 'good',      // Fast connection
  BAD = 'bad',        // Slow connection
  CELLULAR = 'cellular', // Mobile network
  OFFLINE = 'offline' // No connection
}
```

## Dependencies

### External

- **`expo-network`** – Expo network detection
- **`@react-native-community/netinfo`** – React Native network info

### Internal

- **`lib/utils/logger`** – Network event logging

## Error Handling & Edge Cases

### Platform API Unavailable

Falls back to basic online/offline detection.

### Inconsistent APIs

Normalizes different platform behaviors.

### Rapid State Changes

Debounces state transitions.

### Permission Denied

Handles network permission restrictions.

## Performance Notes

- **Low Overhead**: Minimal resource usage
- **Event Batching**: Prevents excessive notifications
- **Platform Optimized**: Uses native APIs when available
- **Memory Efficient**: Small state footprint

## Related Modules

- **`lib/network`** – Business logic network handling
- **`hooks/network`** – UI network status hooks
- **`system/API`** – Network-aware request handling

## File Breakdown

| File | Purpose |
| --- | --- |
| `network-detection.ts` | Platform-specific network monitoring |
| `state-machine.ts` | Network state transition management |
| `helpers.ts` | Network utility functions |
| `index.ts` | Barrel export |