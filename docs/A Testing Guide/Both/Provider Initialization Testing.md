# Provider Initialization Testing

Purpose: describe manual and automated tests to validate kernel phase-aware providers, `usePhaseReady()` hook, and the `UIBlockerLayer` UX.

Scope
- Kernel phase lifecycle and provider initialization ordering
- `usePhaseReady()` behavior (unit)
- `AppParamsStableProvider` / provider integration with kernel (integration)
- `UIBlockerLayer` and `useUIBlocker()` (unit + integration)

Quick commands
- Run unit & integration tests: `npm test`
- Run TypeScript checks: `npm run typecheck`
- Lint: `npm run lint`

Test environment notes
- Tests run under Vitest. The repo uses `vitest.config.ts` with `environment: "node"` by default; DOM tests require `// @vitest-environment jsdom` at the top of the test file.
- Avoid adding new dependencies for these tests; use `vi.mock()` to stub kernel and provider runtime internals.

Mocking kernel state
- Pattern: mock `@/lib/kernel` helpers (`getKernelState`, `onKernelStateChange`, `initializeKernel`) and expose a `__testHelpers.trigger(newState)` method to push updates into subscribers.
- Example: the unit test for `usePhaseReady()` should:
  1. Mock `@/lib/kernel` returning an initial state with `servicesReady: false`.
 2. Render a tiny consumer inside `AppKernelProvider` (or mock provider) that calls `usePhaseReady('servicesReady')`.
 3. Assert initial render is `false`.
 4. Call `__testHelpers.trigger({... phases: { servicesReady: true } })` and assert the consumer re-renders to `true`.

Unit tests
- `usePhaseReady()`
  - Returns `false` before the phase completes and `true` after simulated kernel update.
  - Re-renders when kernel emits a state change.
  - Test file: `__tests__/kernel/usePhaseReady.test.tsx` (use `// @vitest-environment jsdom`).

- `UIBlockerLayer` / `useUIBlocker()`
  - Unit: `useUIBlocker()` exposes `setLoading` which accepts `boolean` and partial state objects.
  - Integration: mount `UIBlockerLayer` inside test tree, call `setLoading(true)`, verify DOM contains SplashScreen and state fields update (title, subtitle, message, progress).
  - Test file: `__tests__/components/UIBlockerLayer.test.tsx` (jsdom env).

Integration tests
- `AppParamsStableProvider` + kernel lifecycle
  - Scenario: Provider should not attempt storage/auth access until `servicesReady` is true.
  - Test approach: mock kernel to deliver phases in order, spy on storage/auth calls (vi.mock) and assert they are called only after `servicesReady`.
  - Use `AppKernelProvider` in the test tree or mock the kernel manager to simulate safe behavior.

- Provider race conditions
  - Mount multiple providers concurrently and ensure they do not race (no unhandled promise rejections, and consumer state is consistent). Use mocked long-running phase transitions to exercise ordering.

Type-level tests
- Compile-time validation: invalid phase names passed to `usePhaseReady()` should be caught by TypeScript because the hook signature restricts keys to `keyof AppKernelState['phases']`.
- Run `npm run typecheck` as part of CI to ensure this is enforced.

Testing checklist (acceptance criteria)
- Unit tests for `usePhaseReady()` pass.
- Unit + integration tests for `UIBlockerLayer`/`useUIBlocker()` pass.
- `AppParamsStableProvider` integration tests confirm it waits for `servicesReady`.
- No console errors like "Auth provider not ready" during bootstrap integration runs.
- `npm run lint` and `npm run typecheck` pass.

Where to add tests
- Unit: `__tests__/kernel/`, `__tests__/contexts/`
- Integration: `__tests__/kernel/` or `__tests__/integration/` (keep kernel-related integrations grouped)

Notes & tips
- Prefer mocking `@/lib/kernel` rather than `system/Kernel` directly to respect architecture boundaries.
- Use `vi.clearAllMocks()` in `afterEach` to avoid cross-test leakage.
- For DOM tests, include `// @vitest-environment jsdom` at the top of test files; if the project-wide environment is `node`, add the header per-file.

Example test snippets (patterns)
- Mock kernel and expose trigger:
```ts
vi.mock("@/lib/kernel", () => {
  let cb = null;
  const state = { phases: { servicesReady: false }, /* ... */ };
  return {
    getKernelState: () => state,
    initializeKernel: async () => {},
    onKernelStateChange: (listener) => { cb = listener; return () => { cb = null; }; },
    __testHelpers: { trigger: (s) => { if (cb) cb(s); } },
  };
});
```

Next steps
- If you want, I can move or copy the new kernel/context tests into a canonical location, or add the remaining provider integration tests mentioned in the guide.
