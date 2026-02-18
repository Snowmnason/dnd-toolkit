# UI

Hooks for UI concerns: responsive scaling, theme switching, splash control, and a dev-only render tracker.

## When to Use This Module

**Use this module if you need to:**

- Derive responsive tokens (fonts, spacing) via `useScale`
- Switch theme family or mode programmatically
- Control the splash screen during bootstrap

**Do NOT use this module for:**

- Heavy layout computation on the main thread
- Replacing design-system tokens (use `theme` tokens instead)

## Architecture & Data Flow

```
Component
        ↓
useScale / useThemeSwitcher
        ↓
ThemeProvider / ScaleProvider -> update CSS / native styles
```

**Key Principles:**

- **Token-driven**: Expose scaled tokens, not absolute pixel math.
- **Provider-backed**: Hooks read/write from `ThemeProvider` / `ScaleProvider`.
- **Dev utilities**: `useRenderTracker` is safe-only in development builds.

## API Reference

### `useScale()`

Get responsive sizing tokens.

**Returns:**
- `scale` – object with `font`, `space`, `breakpoint` values.

### `useThemeSwitcher()`

Manage theme family and mode.

**Returns:**
- `{ family, mode, setFamily, setMode }`

### `useSplashScreen()`

Control splash visibility during app bootstrap.

### `useRenderTracker(componentName)`

Development helper to log render counts for a component.

## Dependencies

### External Packages

- None specific; relies on internal providers

### Internal Dependencies

- **`providers/ThemeProvider`** – theme state and tokens
- **`providers/ScaleProvider`** – responsive scale values

## Error Handling & Edge Cases

### Slow Font Loads

Splash control should keep the splash visible until critical fonts are loaded to avoid layout jitter.

## Performance Notes

Avoid running expensive layout calculations on every render; use memoized token transforms.

## Related Modules

- **`providers`** – Theme and Scale providers
- **`components/ui`** – components consuming these hooks

## File Breakdown

| File | Purpose |
| ---- | ------- |
| `index.ts` | Barrel export for UI hooks |
| `useScale.ts` | Responsive sizing token hook |
| `useThemeSwitcher.ts` | Theme family/mode control hook |
| `use-splash-screen.tsx` | Splash screen visibility controls |
| `use-render-tracker.tsx` | Dev helper for render counts |
