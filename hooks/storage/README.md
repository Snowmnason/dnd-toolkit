# Storage

Hooks for managing storage cache refresh and synchronization. Used to keep local storage in sync with server or app state.

## When to Use This Module

**Use this module if you need to:**
- Refresh or invalidate storage cache after data changes
- Trigger cache updates in response to user or app events

**Do NOT use this module for:**
- Directly reading/writing storage (use `lib/storage`)
- Managing in-memory query cache (see `lib/cache`)

## Architecture & Data Flow

```
Component
        ↓
useRefreshStorageCache
        ↓
Trigger cache refresh in lib/storage
        ↓
Return updated state to UI
```

**Key Principles:**
- **Consistency**: Hooks help keep storage and UI in sync.
- **Separation**: Storage logic lives in `lib/storage`, hooks only trigger refresh.

## API Reference

### `useRefreshStorageCache()`
Trigger a refresh of the storage cache and update dependent UI.

## Dependencies

### External Packages
- None

### Internal Dependencies
- **`lib/storage`** – storage cache and refresh logic

## Error Handling & Edge Cases

### Refresh Failures
If refresh fails, hooks should surface errors for UI fallback.

## Performance Notes

Cache refresh is fast for small data; large storage may cause UI jank if not batched.

## Related Modules
- **`lib/storage`** – core storage and cache logic

## File Breakdown
| File | Purpose |
| ---- | ------- |
| `useRefreshStorageCache.ts` | Trigger storage cache refresh and update UI |
