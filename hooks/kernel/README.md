# Kernel

Hooks for app lifecycle and bootstrap status monitoring. Used to wait for app initialization and track system readiness.

## When to Use This Module

**Use this module if you need to:**

- Wait for app initialization before rendering UI
- Track bootstrap phase progress
- Monitor system readiness state

**Do NOT use this module for:**

- Business logic initialization (belongs in lib/kernel)
- Component-specific setup (belongs in components)
- Manual phase advancement (belongs in system/Kernel)

## Architecture & Data Flow

```
Component
        ↓
useAppKernel / useAppReady
        ↓
Read kernel state
        ↓
Conditional rendering based on readiness
```

**Key Principles:**

- **Read-only**: Hooks only observe kernel state
- **Reactive**: Components re-render when phases complete
- **Lightweight**: Minimal performance overhead

## API Reference

### `useAppKernel()`

Access full kernel state for advanced use cases.

**Returns:** `AppKernelState` with phases, error, timing, capabilities

### `useAppReady()`

Simple boolean check for app readiness.

**Returns:** `boolean` - true when app is ready to render main UI

## Dependencies

### External Packages

- **React** – Hook dependencies

### Internal Dependencies

- **`lib/kernel`** – Kernel state management

## Error Handling & Edge Cases

### Bootstrap Failures

Hooks surface error state for error UI rendering.

### Phase Timeouts

Long initialization times handled gracefully.

## Performance Notes

Hooks use selective subscriptions to avoid unnecessary re-renders.

## Related Modules

- **`lib/kernel`** – Core kernel logic
- **`system/Kernel`** – Low-level kernel implementation

## File Breakdown

| File | Purpose |
| --- | --- |
| `use-app-kernel.tsx` | Kernel state access hooks |
| `index.ts` | Barrel export |