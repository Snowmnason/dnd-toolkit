# Provider Architecture Follow-Ups

Future cleanup ideas for provider layering, readiness, and context organization.

## Why Keep This Note

Providers are part of the app shell. When they become hard to reason about, the cost shows up everywhere: app startup, screen rendering, testing, and crash recovery.

This note keeps the main provider follow-ups visible without turning them into a heavyweight refactor plan.

## Current Shape

The app already relies on a real provider stack for bootstrap, theme, UI state, notifications, and other cross-app concerns.

That works, but there are a few long-term pressure points that are worth keeping in view:

- provider setup can become visually noisy as the stack grows
- ownership can feel split between `providers/` and `contexts/`
- failures high in the provider tree are expensive because they affect the whole app shell
- some contexts may eventually deserve a hotter or colder split if rerender pressure becomes noticeable

## Useful Future Follow-Ups

### Clearer Provider Composition

If the root layout keeps getting more nested, a small composition helper may make the provider stack easier to read and maintain.

The point is not to hide the stack completely. The point is to make ownership and ordering easier to scan.

### Better Readiness Visibility

Some providers are foundational during startup, while others are more optional.

Potential future value:

- a clearer view of which app-shell providers are still initializing
- better control over what the UI should render before the shell is fully ready
- fewer ad hoc readiness checks spread across startup code

### Better Failure Containment

Provider-level failures are costly because they happen near the root of the app.

If this area becomes unstable, future work could add better crash containment and fallback behavior around the provider shell instead of letting one provider failure take out the whole app view.

### Clearer Context Ownership

There is still long-term cleanup value in making provider and context ownership easier to follow.

That does not require moving everything at once. It can be done gradually by:

- keeping new app-shell state in clearer provider entry points
- avoiding duplicate patterns across `providers/` and `contexts/`
- documenting dependency order and responsibility more plainly

### Testing Helpers

Provider-heavy tests can become harder to read than the feature they are testing.

Useful future work:

- shared provider test wrappers
- lighter mock provider patterns
- clearer guidance on when to test through the real provider stack versus a narrow wrapper

## Guardrails

Any provider cleanup should stay pragmatic:

- do not refactor providers just to make the tree look clever
- keep public hook APIs stable unless there is a real payoff
- only split hot and cold context state where profiling or real rerender pressure justifies it
- keep startup ownership clear rather than hiding it behind too much abstraction

## Priority

Low to medium.

This is worth revisiting when provider setup, startup readiness, or provider-heavy tests start to feel harder than they should.