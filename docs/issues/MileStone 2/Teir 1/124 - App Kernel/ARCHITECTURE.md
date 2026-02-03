# App Kernel — Architecture & Implementation (Issue #124)

Purpose
- The App Kernel is the canonical app initialization and lifecycle coordinator.
- Responsibilities: preload critical assets, validate/migrate storage, initialize network detection, restore auth session (non-blocking), expose diagnostics, capability registry, and phase retry/re-run.

Key components
- `AppKernel` (singleton): core state machine tracking `KernelPhase` and `AppKernelState`.
- `AppKernelProvider` / `useAppKernel()`: React integration that exposes the kernel state to the UI tree.
- `lib/kernel/use-app-kernel.tsx`: provider + hooks implementation.
- `lib/kernel/app-kernel.ts`: kernel implementation, phases, error taxonomy, capability detection, retry/rerun APIs.
- `lib/kernel/lazy-fonts.ts`: lazy font registry used by the preload phase.

Phases
1. PRELOAD — load critical fonts and platform assets (aim <500ms)
2. STORAGE — validate critical caches and run migrations
3. NETWORK — initialize `NetworkDetection` and subscribe to status
4. AUTH — restore session (runs non-blocking where possible)
5. READY — app is safe to render main UI
6. ERROR — kernel-level critical failure with structured `KernelError`

Error taxonomy & recovery
- `KernelErrorCode` enumerates recoverable vs. unrecoverable errors (e.g., STORAGE_VALIDATION_FAILED may be recoverable by reset)
- Kernel exposes `retry()` and `rerunPhase(phase)` to let UI actions attempt recovery.
- `getDiagnostics()` returns a redacted snapshot (useful for support and bug reports).

Capability registry
- `kernel.capabilities` lists runtime features: `storage`, `network`, `auth`, `analytics`, `backend`, `platform`.
- Platform detection includes `'desktop'` (Electron), `'web'`, `'ios'`, `'android'`, `'unknown'`.

Observability
- Kernel emits state changes to subscribers via `subscribe()`; UI uses `useAppKernel()` which subscribes and re-renders on state updates.
- Kernel integrates with existing `logger` and `Analytics` hooks for performance/telemetry during phases.

Migration notes
- Replace all legacy `useAppBootstrap()` calls with `useAppKernel()` in layouts/hooks/screens.
- Deprecate `hooks/use-app-bootstrap.tsx` and remove once all usages are migrated.

Extensibility
- New phases can be added; follow `KernelPhase` enum and update state/timing tracking.
- `lazy-fonts.ts` provides a pattern for non-blocking resource registries.

Files to review
- `lib/kernel/app-kernel.ts` — implementation and API
- `lib/kernel/use-app-kernel.tsx` — provider + hooks
- `lib/network/network-detection.ts` — network service
- `lib/storage/cache-versioning.ts` — storage validation/migration

Questions / Next steps
- Add unit tests for phase transitions and `retry()` behavior? (recommended)
- Add short developer doc showing how to add a new kernel phase.

---

(Compact architecture summary for issue #124 and Milestone 2 planning.)