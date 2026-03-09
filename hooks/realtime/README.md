# Realtime

Hooks for real-time data subscriptions and live updates. Used to subscribe to server-sent events and handle real-time data streams.

## When to Use This Module

**Use this module if you need to:**

- Subscribe to real-time data updates
- Handle live event streams from server
- Manage real-time connection lifecycle

**Do NOT use this module for:**

- Polling data (use regular queries)
- One-time data fetches (use API calls)
- Offline data management (belongs in lib/offline)

## Architecture & Data Flow

```
Component
        ↓
useRealtimeChannel
        ↓
Subscribe to channel
        ↓
Receive real-time updates
        ↓
Update component state
```

**Key Principles:**

- **Reactive**: Components update automatically on data changes
- **Connection-aware**: Handles connection drops and reconnections
- **Clean**: Automatic cleanup on unmount

## API Reference

### `useRealtimeChannel(channel, callback)`

Subscribe to a real-time channel.

**Parameters:**
- `channel`: Channel name or configuration
- `callback`: Function called on new data

**Returns:** Subscription object with cleanup

## Dependencies

### External Packages

- **None** – Pure real-time logic

### Internal Dependencies

- **`lib/realtime`** – Real-time subscription management

## Error Handling & Edge Cases

### Connection Failures

Hooks handle reconnection automatically with backoff.

### Message Loss

Server handles message persistence and redelivery.

### Component Unmount

Subscriptions cleaned up automatically.

## Performance Notes

Subscriptions are lightweight; avoid subscribing to high-frequency channels in many components.

## Related Modules

- **`lib/realtime`** – Core real-time logic
- **`system/Services`** – Real-time service providers

## File Breakdown

| File | Purpose |
| --- | --- |
| `useRealtimeChannel.ts` | Real-time channel subscription hook |
| `index.ts` | Barrel export |