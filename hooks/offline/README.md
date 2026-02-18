# Offline

Hooks for managing offline queueing and forced resynchronization. Supports robust user experience when network is unavailable or intermittent.

## When to Use This Module

**Use this module if you need to:**
- Queue actions for later execution when offline
- Force a resync of local and remote state after reconnect

**Do NOT use this module for:**
- Directly handling network requests (see `lib/network`)
- Long-term persistent job storage (use `lib/offline`)

## Architecture & Data Flow

```
User action (offline)
        ↓
useOfflineQueue
        ↓
Queue action locally
        ↓
useForceResync (on reconnect)
        ↓
Flush queue to server
```

**Key Principles:**
- **Resilience**: Queue actions locally to avoid data loss.
- **Explicit resync**: Allow user or app to force a state reconciliation.

## API Reference

### `useOfflineQueue()`
Queue actions for later execution when offline.

### `useForceResync()`
Trigger a forced resync of local and remote state.

## Dependencies

### External Packages
- None (uses internal queue/state)

### Internal Dependencies
- **`lib/offline`** – offline queue and resync logic

## Error Handling & Edge Cases

### Queue Overflows
If the offline queue exceeds its limit, oldest actions are dropped and a warning is logged.

## Performance Notes

Queue is in-memory and fast; resync may be slow if many actions are queued.

## Related Modules
- **`lib/offline`** – core offline queue and resync implementation

## File Breakdown
| File | Purpose |
| ---- | ------- |
| `use-offline-queue.ts` | Queue actions for offline execution |
| `useForceResync.ts` | Force a resync of local and remote state |
