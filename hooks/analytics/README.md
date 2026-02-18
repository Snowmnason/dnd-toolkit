# Analytics

Hooks for analytics buffer status and telemetry integration. Used to monitor analytics event queue and ensure events are sent reliably.

## When to Use This Module

**Use this module if you need to:**
- Monitor analytics buffer status for UI or debugging
- Trigger UI changes based on analytics queue state

**Do NOT use this module for:**
- Sending analytics events directly (use `lib/analytics`)
- Managing analytics configuration (see `lib/analytics`)

## Architecture & Data Flow

```
Component
        ↓
useAnalyticsBufferStatus
        ↓
Read analytics event buffer state
        ↓
Update UI or trigger flush
```

**Key Principles:**
- **Observability**: Hooks expose analytics buffer state for UI/monitoring.
- **Separation**: Event sending and config live in `lib/analytics`.

## API Reference

### `useAnalyticsBufferStatus()`
Read the current status of the analytics event buffer.

## Dependencies

### External Packages
- None

### Internal Dependencies
- **`lib/analytics`** – analytics event buffer and telemetry logic

## Error Handling & Edge Cases

### Buffer Overflows
If the buffer is full, hooks should surface status for UI to prompt a flush or warn the user.

## Performance Notes

Buffer status checks are lightweight; avoid polling too frequently.

## Related Modules
- **`lib/analytics`** – analytics event buffer and telemetry

## File Breakdown
| File | Purpose |
| ---- | ------- |
| `use-analytics-buffer-status.ts` | Read analytics event buffer status for UI/monitoring |
