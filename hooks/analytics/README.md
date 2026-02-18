# Analytics

Hooks for analytics buffer status, breadcrumb queue monitoring, and telemetry integration. Used to monitor analytics event queues and ensure events are sent reliably.

## When to Use This Module

**Use this module if you need to:**
- Monitor analytics buffer status for UI or debugging
- Track breadcrumb queue state for offline analytics
- Trigger UI changes based on analytics queue state

**Do NOT use this module for:**
- Sending analytics events directly (use `lib/analytics`)
- Managing analytics configuration (see `lib/analytics`)

## Architecture & Data Flow

```
Component
        ↓
useAnalyticsBufferStatus / useBreadcrumbQueueStatus
        ↓
Read analytics event buffer or breadcrumb queue state
        ↓
Update UI or trigger flush
```

**Key Principles:**
- **Observability**: Hooks expose analytics buffer and breadcrumb queue state for UI/monitoring.
- **Separation**: Event sending and config live in `lib/analytics`.

## API Reference

### `useAnalyticsBufferStatus()`
Read the current status of the analytics event buffer.

### `useBreadcrumbQueueStatus()`
Read the current status of the breadcrumb queue for offline analytics.

## Dependencies

### External Packages
- None

### Internal Dependencies
- **`lib/analytics`** – analytics event buffer, breadcrumb queue, and telemetry logic

## Error Handling & Edge Cases

### Buffer Overflows
If the buffer is full, hooks should surface status for UI to prompt a flush or warn the user.

### Queue Issues
Breadcrumb queue status should handle cases where the queue is corrupted or provider is unavailable.

## Performance Notes

Buffer and queue status checks are lightweight; avoid polling too frequently.

## Related Modules
- **`lib/analytics`** – analytics event buffer, breadcrumb queue, and telemetry

## File Breakdown
| File | Purpose |
| ---- | ------- |
| `use-analytics-buffer-status.ts` | Read analytics event buffer status for UI/monitoring |
| `use-breadcrumb-queue-status.ts` | Read breadcrumb queue status for offline analytics monitoring |
