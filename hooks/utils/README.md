# Utils

General-purpose hooks (feature flags, notifications, A/B tracking, and world creation modal flow). Keep UI-agnostic logic here.

## When to Use This Module

**Use this module if you need to:**

- Check runtime feature flags or gating logic
- Show toasts/snackbars and queue notifications
- Track A/B variant engagement or run small client-side flows (world creation helper)

**Do NOT use this module for:**

- Large orchestration jobs or background workers

## Architecture & Data Flow

```
Component
        ↓
useFeatureFlag / useNotifications
        ↓
feature flags manager / notification queue
        ↓
re-render / toast display
```

**Key Principles:**

- **Small, testable units**: Each hook solves one concern and is easy to mock.
- **Non-blocking**: Tracking and notification calls do not block the UI.
- **Composable**: Hooks can be combined (feature gating + notifications) in components.

## API Reference

### `useFeatureFlag(flagName)`

Synchronous subscription to a runtime feature flag.

**Returns:**
- `boolean` – whether the flag is enabled for the current context

### `useNotifications()`

Queue and display toast/snackbar notifications.

**Returns:**
- `{ toast, success, error, info }` – methods to enqueue notifications

### `useVariantTracking()`

Track user engagement with A/B test variants; non-blocking telemetry.

### `useWorldCreation()` / `useWorldModal()`

Client-side flow helpers for multi-step world creation and modal state.

## Dependencies

### External Packages

- None specific; relies on internal analytics and UI to render notifications

### Internal Dependencies

- **`lib/feature-flags`** – authoritative feature data
- **`lib/analytics`** – telemetry targets for tracking

## Error Handling & Edge Cases

### Telemetry Failures

Tracking is fire-and-forget; failures should not block user interactions.

### Notification Flooding

Throttle repeated identical notifications to avoid spamming users.

## Performance Notes

Feature checks should be cheap (cached) and avoid synchronous network calls during render.

## Related Modules

- **`lib/feature-flags`** – feature evaluation and server sync
- **`components/ui`** – the visual toast/snackbar components

## File Breakdown

| File | Purpose |
| ---- | ------- |
| `index.ts` | Barrel export for utility hooks |
| `use-feature-flag.ts` | Runtime feature flag subscription hook |
| `use-feature-gating.ts` | Higher-level gating helpers (composed rules) |
| `use-notifications.tsx` | Enqueue and manage toast/snackbar notifications |
| `use-variant-tracking.ts` | A/B test variant telemetry helpers |
| `use-world-creation.tsx` | Multi-step world creation flow helper |
| `use-world-modal.tsx` | Modal state & selection helper for world creation/selection |
