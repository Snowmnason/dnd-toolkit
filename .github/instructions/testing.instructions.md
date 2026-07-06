---
applyTo: "__tests__/**"
description: "Use when writing backend-focused Vitest coverage under __tests__/** and keep tests limited to non-UI logic in this project"
---

# Testing Conventions

## Tooling

- **Runner**: Vitest (`npm run test`). Environment: `node` (not jsdom).
- **Globals**: `describe`, `it`, `expect`, `vi`, `beforeEach`, `afterEach` are injected globally — no explicit imports needed.
- **Setup file**: `__tests__/setup.ts` — provides shims for `ExpoModulesCore`, `EventEmitter`, and `expo-crypto`. Do not duplicate these shims in individual test files.
- **Path alias**: `@/*` maps to the repo root, same as production code.
- Do not install packages or add new test tooling for this workflow.

## Structure

- Mirror the source directory structure under `__tests__/` (e.g., `lib/auth/auth-manager.ts` → `__tests__/lib/auth/auth-manager.test.ts`).
- Test file name: `*.test.ts` or `*.test.tsx`.
- Helpers and shared fixtures live in `__tests__/test-helpers/`.
- Write Vitest only under `__tests__/**`.

## Mocking

- Mock React Native via the workspace mock at `__mocks__/react-native.ts`. Do not add per-file RN mocks.
- Mock external services (Supabase, Sentry) in the test file using `vi.mock(...)`. Never call real network APIs in tests.
- Mock storage via `vi.mock('@/system/storage/cache')` — never access `localStorage`/`sessionStorage` directly in tests either.
- For `lib/` unit tests, mock `system/` layer dependencies; leave `maps/`, `validation/`, `pure-algo-immutables/` unmocked (they're pure).

## Scope

- Test backend and logic-heavy code only.
- Allowed targets usually include `lib/`, `managers/`, `middleware/`, `system/`, `config/`, and `validation/`.
- Do not write Vitest coverage for UI rendering, components, presentation-only navigation changes, or other visual behavior.
- Do not test hooks by default; only do so if the user explicitly treats the hook as backend-like logic rather than UI behavior.

## Patterns

```typescript
// Typical lib unit test
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SomeManager } from '@/lib/some-manager';

vi.mock('@/system/storage/cache', () => ({ SecureStorage: { get: vi.fn(), set: vi.fn() } }));

describe('SomeManager', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does the thing', async () => {
    const result = await SomeManager.doThing({ input: 'value' });
    expect(result.success).toBe(true);
  });
});
```

- Test the **manager's public interface** (what hooks call), not internal implementation details.
- Test error paths: pass invalid input, simulate system-layer failures.
- Use `AppError` and `ERROR_CODES` assertions when testing error cases:
- Prefer the narrowest useful test type: unit, integration, then stress when capacity or performance behavior is part of the issue.

```typescript
import { ERROR_CODES } from '@/maps/ERROR_CODES';
expect(result.error?.code).toBe(ERROR_CODES.AUTH.INVALID_CREDENTIALS);
```

## Stress Tests

- Use stress tests for queues, batching, retries, persistence bounds, performance-sensitive flows, or other capacity-oriented backend behavior.
- Keep assertions bounded and concrete.
- Use explicit timeouts when volume makes them necessary.

## What NOT to test

- Do not test `system/` transport internals (retries, circuit breaker) at the manager layer — test them in isolation in `__tests__/api/` or `__tests__/storage/`.
- Do not render React components in `__tests__/`.
- Do not add hook smoke tests that pass when an implementation is missing.
- Do not snapshot-test UI components here.
- Do not change production code just to satisfy a test in this workflow.
- If a real behavior failure is exposed, report it and hand it back to implementation instead of patching the code here.
