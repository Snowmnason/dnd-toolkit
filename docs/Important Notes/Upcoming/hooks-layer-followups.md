# Hooks Layer Follow-Ups

Future cleanup ideas for the hooks layer as the app grows.

## Why Keep This Note

The hooks layer is already large and important. It is the bridge between UI code and the rest of the app, so inconsistent patterns here become expensive over time.

This is not a rewrite plan. It is a reminder of the clearest improvement areas if hooks work starts to feel repetitive, hard to test, or hard to understand.

## Current Shape

The repo already has a broad hooks surface for auth, analytics, navigation, network, jobs, feature work, and app state.

That gives the app flexibility, but it also means a few different styles now live side by side:

- some hooks read like lightweight query helpers
- some hooks wrap mutations or action flows
- some hooks coordinate larger UI-facing workflows
- documentation and examples are stronger in some areas than others

The main risk is not that hooks exist. The risk is that the patterns drift apart enough that adding or testing new hooks becomes slower than it should be.

## Useful Future Follow-Ups

### Clearer Shared Patterns

If hook duplication keeps growing, it may be worth standardizing a small set of repeatable patterns for:

- data-loading hooks
- action or mutation hooks
- loading, error, and retry state
- success and failure feedback

The goal should be consistency, not a giant abstraction layer.

### Better Documentation And Examples

Hooks are easier to maintain when the expected shape is obvious.

Useful future cleanup:

- stronger JSDoc on public hooks
- short usage examples for the more important hooks
- a clearer top-level `hooks/README.md` map for common use cases

### Better Test Helpers

Hook tests can get noisy when every test must rebuild full provider state.

Potential value:

- shared hook test helpers
- lighter mock patterns for common hook families
- clearer expectations for what belongs in a hook test versus a manager or integration test

### Better Composition For UI-Facing Flows

Some screens need several related hooks at once.

If repeated combinations keep showing up, a few higher-level composition hooks could help reduce screen-level glue code.

That should stay within the hook layer's real job: shaping UI-facing state and actions. It should not pull business orchestration down out of managers.

### Smarter Request Sharing

If duplicate requests become a real problem in practice, request sharing or deduplication is worth revisiting.

But that work should prefer existing cache, request, or manager layers where possible rather than forcing every hook to own its own networking policy.

## Guardrails

Any future hook cleanup should keep the current architecture boundaries intact:

- hooks bridge UI state and user actions
- managers keep business validation and orchestration
- middleware and system keep infrastructure concerns

If a hook refactor starts turning hooks into a second orchestration layer, it is probably moving in the wrong direction.

## Priority

Low to medium.

This is a quality and maintainability follow-up, not a current foundation blocker.