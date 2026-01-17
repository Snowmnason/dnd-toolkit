# App Kernel — How to Use (Issue #124)

This short guide shows how to use the App Kernel at runtime. The kernel is the single, authoritative initialization and lifecycle manager for the app — use it instead of legacy bootstrap hooks.

Quick summary
- Kernel singleton: `AppKernel` (access via `lib/kernel` barrel)
- React hook: `useAppKernel()` — subscribes to kernel state from React
- Provider: `AppKernelProvider` — mounted at app root (wraps the app)
- Readiness: `kernel.phases` contains boolean flags (`preloadReady`, `storageReady`, `networkReady`, `authReady`, `appReady`)
- Diagnostics: `AppKernel.getDiagnostics()` returns a redacted snapshot for debugging

Import paths
- `import { AppKernelProvider, useAppKernel, useAppReady, usePhaseReady } from '@/lib';`
- (The app-level barrel exposes these from `lib/kernel`)

Common patterns
- Root provider (already implemented):

```tsx
// app/_layout.tsx
import { AppKernelProvider } from '@/lib';

export default function RootLayout() {
  return (
    <AppKernelProvider>
      {/* rest of app */}
    </AppKernelProvider>
  );
}
```

- Read app readiness in layouts/screens:

```tsx
import { useAppKernel } from '@/lib';

function SomeLayout() {
  const kernel = useAppKernel();
  if (!kernel.phases.appReady) return <LoadingOverlay message="Starting application…" error={kernel.error} />;
  // appReady true → safe to render main UI
}
```

- Wait for specific phase (e.g., storage):

```tsx
import { usePhaseReady } from '@/lib';

const storageReady = usePhaseReady('storage');
if (!storageReady) return <LoadingOverlay message="Preparing storage…" />;
```

Error handling & retry
- Kernel surfaces structured errors (`KernelError`) on `kernel.error`.
- Call `AppKernel.retry()` or expose a UI button that triggers `AppKernel.retry()` to attempt recovery for recoverable errors.

Capability checks
- Use `kernel.capabilities` to feature-gate code paths (storage, network, analytics, backend, platform).

Notes
- Prefer `useAppKernel()` over any legacy `useAppBootstrap()` references in docs or code.
- The kernel intentionally keeps services independent; it initializes and coordinates but does not proxy every API.

If you want, I can add quick examples for testing, telemetry hooks, or a small troubleshooting checklist.