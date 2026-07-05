# Barrel Exports Pattern

Reference note for the repo's preferred public export pattern.

## Purpose

Barrel exports give each module one clear public entry point.

- They define what other parts of the app are allowed to import.
- They hide internal file structure from callers.
- They make refactors safer because consumers depend on the module entry, not the internal file path.

## Standard Shape

Use a module folder with an `index.ts` file that re-exports only the public API.

```ts
// lib/example/index.ts
export { doThing } from './do-thing';
export type { ExampleResult } from './types';
```

Consumers should import from the module root:

```ts
import { doThing } from '@/lib/example';
```

Avoid reaching into internal files when the module already exposes a public entry point.

```ts
import { doThing } from '@/lib/example/do-thing';
```

## Why The Repo Uses This Pattern

- It keeps public and private module surfaces separate.
- It reduces import churn when files are renamed or split.
- It makes module boundaries easier to scan during reviews.
- It matches the repo goal of one clear active code path.

## When To Apply It

- Prefer barrel exports for `lib`, `hooks`, `system`, and other reusable module folders.
- Use them when a folder exposes a stable API to the rest of the app.
- Keep the barrel small and intentional. Do not export every internal helper by default.

## Review Rule

When touching a module, check whether the public entry point still reflects the intended API.

- Add new exports only when they are meant to be consumed elsewhere.
- Remove stale exports when the underlying path is no longer part of the supported surface.
- Prefer updating callers to use the barrel instead of preserving deep-import habits.