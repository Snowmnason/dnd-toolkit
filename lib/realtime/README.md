# Realtime Module

Registry-based abstraction layer for real-time event subscriptions supporting WebSocket connections, server-sent events, and pub/sub systems.

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
App Code
    ↓
Operations Layer (semantic subscriptions)
    ↓
Registry Layer (handler lookup)
    ↓
Backend Implementation (Supabase, Firebase, etc.)
    ↓
Real-Time Service (WebSocket, SSE)
```

**Key Principles:**

- **Registry-based**: Handlers registered by semantic name, not backend-specific subscriptions
- **Backend agnostic**: Call sites don't depend on underlying real-time service
- **Type safe**: Each handler has defined payload interfaces
- **Testable**: Mock handlers can be registered for testing

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

## Dependencies

### External Packages

None (backend-specific dependencies handled by adapters)

### Internal Dependencies

- **`lib/utils/logger`** – Logging for connection events and errors

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

## Error Handling & Edge Cases

**Connection failures:** All subscription operations handle connection failures gracefully, logging errors but not throwing to calling code.

**Handler not registered:** `subscribeToChannel()` throws descriptive error if requested handler isn't registered.

**Invalid subscriptions:** Registry validates subscription IDs and prevents duplicate or invalid unsubscriptions.

**Backend unavailability:** Operations degrade gracefully when realtime backend is unavailable, with appropriate logging.

## Performance Notes

**Subscription overhead:** Each subscription maintains minimal state (subscription ID, callback reference).

**Memory management:** Registry automatically tracks and cleans up subscriptions to prevent memory leaks.

**Connection pooling:** Backend implementations handle connection reuse and pooling efficiently.

**Message processing:** Callbacks are invoked synchronously; heavy processing should be deferred.

## Related Modules

- **`lib/services`** – Backend adapters that register realtime handlers
- **`lib/utils/logger`** – Logging for connection events and subscription lifecycle

## File Breakdown

| File | Purpose |
|------|---------|
| `index.ts` | Barrel exports for realtime functionality |
| `registry.ts` | Core registry and subscription management system |
| `operations.ts` | High-level semantic operations for realtime features |</content>
<parameter name="filePath">p:\CodingProjects\dnd-toolkit\lib\realtime\README.md