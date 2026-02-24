# lib/realtime

Registry-based abstraction layer for real-time event subscriptions (WebSocket connections, server-sent events, pub/sub systems). Supports swapping real-time backends (Supabase Realtime, Firebase Realtime Database, Socket.io, etc.) without changing call sites.

## When to Use This Module

**Use this module if you need to:**

- Subscribe to real-time events (world updates, chat messages, notifications)
- Receive live updates from other users or system events
- Implement collaborative features (shared editing, live cursors)
- Handle server-sent events or WebSocket messages
- Swap real-time backends without changing application code
- Test real-time features with mock implementations

**Do NOT use this module for:**

- One-time API requests (use `lib/api` instead)
- Local event handling (use React state/events instead)
- File storage operations (use `lib/storage/buckets` instead)
- Database queries (use `lib/database` instead)
- Caching (use `lib/storage/cache` instead)

## Architecture & Data Flow

```
App Code (subscribeToWorldUpdates, etc.)
  ↓
Operations Layer (lib/realtime/operations.ts)
  ↓
Registry Layer (lib/realtime/registry.ts)
  ↓
Backend Implementation (Supabase, Firebase, Socket.io, etc.)
  ↓
Real-Time Service (WebSocket, SSE, etc.)
```

## Core Concepts

### Registry Pattern

Real-time handlers are registered by semantic name (e.g., `'WORLD_UPDATED'`, `'CHAT_MESSAGE'`) rather than backend-specific subscriptions. This allows:

- **Backend Agnosticism**: Call sites don't know or care about the underlying real-time service
- **Runtime Swapping**: Change real-time providers without code changes
- **Testability**: Register mock handlers for testing
- **Type Safety**: Each handler has defined payload interfaces

### Subscription Management

The registry automatically tracks active subscriptions and provides cleanup:

- **Subscription IDs**: Unique identifiers for each subscription
- **Automatic Cleanup**: Prevents memory leaks from forgotten unsubscriptions
- **Error Handling**: Graceful handling of connection failures
- **Debugging**: Introspection of active subscriptions

## API Reference

### Registry Functions

```typescript
// Register a handler implementation
registerRealtimeHandler(handlerName: string, handler: RealtimeHandler): void

// Subscribe to a channel
subscribeToChannel<T>(handlerName: string, channel: string, onMessage: (payload: T) => void): Promise<string>

// Unsubscribe from a channel
unsubscribeFromChannel(subscriptionId: string): Promise<void>

// Check if handler is registered
isRealtimeHandlerRegistered(handlerName: string): boolean

// Get all registered handlers (for debugging)
getRegisteredRealtimeHandlers(): string[]
```

### Handler Interface

```typescript
interface RealtimeHandler<Payload = any> {
  subscribe: (channel: string, onMessage: (payload: Payload) => void) => Promise<string>;
  unsubscribe: (subscriptionId: string) => Promise<void>;
}
```

### Available Handlers

| Handler | Payload Type | Description |
|---------|-------------|-------------|
| `WORLD_UPDATED` | `WorldUpdatePayload` | World data changes (settings, members) |
| `NOTIFICATION_RECEIVED` | `NotificationPayload` | User notifications |
| `CHAT_MESSAGE` | `ChatMessagePayload` | Chat messages in channels |

## Usage Examples

### Basic Subscription

```typescript
import { subscribeToChannel, unsubscribeFromChannel } from '@/lib/realtime';

// Subscribe to world updates
const subscriptionId = await subscribeToChannel(
  'WORLD_UPDATED',
  `world-${worldId}`,
  (payload: WorldUpdatePayload) => {
    console.log('World updated:', payload);
    // Update UI with new data
  }
);

// Later, unsubscribe
await unsubscribeFromChannel(subscriptionId);
```

### High-Level Operations

```typescript
import { subscribeToWorldUpdates } from '@/lib/realtime';

// Subscribe to world updates (handles channel naming, error handling)
const subscriptionId = await subscribeToWorldUpdates(worldId, (update) => {
  // Handle world update
});
```

## Backend Registration

Handlers are registered during app bootstrap. See `lib/services/supabase/supabase-realtime-adapter.ts` for the Supabase implementation.

```typescript
// In service initialization
import { registerRealtimeHandler } from '@/lib/realtime';
import { createSupabaseRealtimeHandlers } from '@/lib/services/supabase/supabase-realtime-adapter';

registerRealtimeHandler('WORLD_UPDATED', createSupabaseRealtimeHandlers().worldUpdated);
```

## Error Handling

All operations handle connection failures gracefully:

```typescript
try {
  const subId = await subscribeToChannel('WORLD_UPDATED', channel, callback);
} catch (error) {
  if (error.message.includes('not registered')) {
    // Handler not implemented
  } else {
    // Connection or backend error
  }
}
```

## Subscription Lifecycle

Subscriptions are automatically tracked and cleaned up:

```typescript
// Get active subscriptions (for debugging)
import { getActiveSubscriptions } from '@/lib/realtime';
console.log('Active subscriptions:', getActiveSubscriptions());
```

## Testing

Register mock handlers for testing:

```typescript
import { registerRealtimeHandler, clearRealtimeRegistry } from '@/lib/realtime';

describe('RealtimeFeature', () => {
  beforeEach(() => {
    clearRealtimeRegistry();
    registerRealtimeHandler('WORLD_UPDATED', {
      subscribe: jest.fn().mockResolvedValue('mock-sub-id'),
      unsubscribe: jest.fn().mockResolvedValue(undefined),
    });
  });
});
```

## File Structure

```
lib/realtime/
├── index.ts           # Barrel exports
├── registry.ts        # Core registry and subscription management
└── operations.ts      # High-level semantic operations
```

## Dependencies

- **Internal**: `lib/utils/logger` for logging
- **External**: None (backend-specific dependencies handled by adapters)

## Future Enhancements

- Connection status monitoring
- Automatic reconnection
- Message queuing for offline scenarios
- Channel pattern matching (wildcards)
- Message filtering and transformation
- Real-time presence/typing indicators
- Message history and catch-up</content>
<parameter name="filePath">p:\CodingProjects\dnd-toolkit\lib\realtime\README.md