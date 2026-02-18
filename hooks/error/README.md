# Error

Hooks for error boundary management and safe mode activation. Used to detect, handle, and recover from critical errors in the app.

## When to Use This Module

**Use this module if you need to:**
- Detect app-level errors and trigger safe mode
- Integrate error boundaries with custom recovery logic

**Do NOT use this module for:**
- Logging errors to external services (see `lib/error`)
- Handling network errors (use `lib/network`)

## Architecture & Data Flow

```
Component
        ↓
useSafeMode
        ↓
Error boundary / recovery UI
```

**Key Principles:**
- **Fail-safe**: Hooks enable fallback UI and recovery flows.
- **Separation**: Error handling logic is decoupled from business logic.

## API Reference

### `useSafeMode()`
Detect and activate safe mode in response to critical errors.

## Dependencies

### External Packages
- None (relies on React error boundaries)

### Internal Dependencies
- **`lib/error`** – error boundary and safe mode logic

## Error Handling & Edge Cases

### Repeated Failures
Safe mode should not enter infinite retry loops; user must be able to exit or reset.

## Performance Notes

Safe mode activation is rare and has minimal runtime cost.

## Related Modules
- **`lib/error`** – error boundary and safe mode implementation

## File Breakdown
| File | Purpose |
| ---- | ------- |
| `index.ts` | Barrel export for error hooks |
| `use-safe-mode.ts` | Detect and activate safe mode |
