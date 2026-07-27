# Copilot instructions for dnd-toolkit

Purpose: enforce the small set of rules that must apply in every coding session. Keep this file focused on always-on architectural and workflow constraints; place procedural detail in scoped instructions, prompts, or agents.

## Non-Negotiable Rules

- Do not build backwards compatibility into pre-release foundation work unless the task explicitly requires coexistence.
- When replacing a pattern or system, update call sites and remove the old path instead of leaving fallback code behind.
- Delete dead code exposed by the change: unused branches, stale helpers, obsolete exports, compatibility shims, and duplicate entry points.
- Prefer one clear active code path over multiple partially active paths.
- Keep changes typed, minimal, and aligned with the intended architecture.
- Prefer the repo logger over ad hoc `console.*` calls for operational or debugging code; keep logging structured by category.

## Architecture Model

This repo implements Clean Architecture (Uncle Bob, 2017). Enforce these rules strictly.

### 1. Dependency Boundaries

This rule answers: what is allowed to import what?

**Full dependency flow (Presentation→Logic→Infrastructure):**

```
Presentation (Hooks/Components) — PUBLIC ENTRY POINT
    ↓ (can call)
Managers (Orchestration) — PUBLIC ENTRY POINT  
    ├─ Call /lib for domain logic (ONLY layer that imports lib)
    ├─ Call other managers for cross-domain coordination  
    └─ Call /middleware for infrastructure
    ↓
/lib (Domain Logic) — PRIVATE IMPLEMENTATION
    ├─ Pure business logic (math, transforms, validation)
    ├─ Can ONLY import /lib and shared support
    ├─ CANNOT import managers, middleware, or system
    └─ Lib-to-lib calls must route through managers
    ↓  
/middleware (Adapters) — PUBLIC ENTRY POINT
    ├─ Precondition checks (network, storage readiness)
    ├─ Data normalization and adaptation
    └─ Calls /system for infrastructure
    ↓
/system (Infrastructure) — PRIVATE IMPLEMENTATION  
    ├─ HTTP, database, files, platform APIs
    ├─ App-agnostic; must remain portable
    ├─ CANNOT import lib, managers, or middleware
    └─ Can emit events/callbacks for Hooks (no direct imports)

Shared Support (Config/Types/Validation/Maps) — EXEMPT FROM RULES
    └─ Can be imported by any layer
```

**Public vs. Private Principle:**
- PUBLIC layers: Managers, Middleware (entry points for calling)
- PRIVATE layers: Lib, System (implementation details)

**Enforcement Rules (Mandatory):**
- Managers are the ONLY layer that imports /lib modules
- Managers can call other managers (cross-domain orchestration OK)
- System can emit events; Hooks can listen (no direct imports)
- Lib CANNOT import managers (no upward calls)
- Lib CANNOT import middleware (no sibling calls)
- Lib-to-lib imports must go through managers (no shortcuts)
- System CANNOT import lib, managers, or middleware
- Hooks CANNOT skip managers; must call through manager layer

**Rationale:**
- Lib is pure logic; if lib breaks, only one manager is affected
- Managers are orchestration; if manager deleted, only call sites change
- If system breaks, only middleware is affected
- Shared support breaks these rules (by design; it's infrastructure)

**Reference:** [Manager Gateway Pattern issue](../../docs/issues/Milestone%202/Tier%208/300%20-%20Manager%20Gateway%20Pattern/Manager%20Gateway%20Pattern.md) — Full spec with examples

### 2. Runtime Ownership

This rule answers: who should coordinate work at runtime?

- Screens and components render and delegate.
- Hooks bridge UI state and user actions into use-case execution, including fast UI-facing validation for immediate feedback.
- Managers or orchestrators validate and normalize input for domain logic, coordinate cross-module behavior, and control the use-case flow.
- `lib` owns independent domain logic and should stay reusable rather than becoming UI or app-shell orchestration. Managers may call `lib`; `lib` should not become a general cross-module calling layer.
- `middleware` performs the final infrastructure-facing validation and normalization step before `system`, including provider readiness, network/system checks, tracing, and transport adaptation.
- `system` performs transport and infrastructure work only.

Results flow back upward through the same chain in reverse:

- `system` returns raw infrastructure results.
- `middleware` normalizes infrastructure responses into something safe and readable for app layers.
- `managers` shape results into use-case-ready data, coordinate follow-on actions, and prevent duplicate cross-module logic.
- `hooks` shape those results into UI-ready state and fast user-facing errors.
- screens and components present the final state.

Do not collapse these responsibilities into one layer unless the architecture for that area is intentionally being changed.

### Transition Note

- The repo is moving manager or orchestrator code out of `/lib` into `/managers`.
- Some manager-style code still lives under `/lib` today.
- Treat that as transitional, not as the desired end state.
- New work should follow the target hierarchy where practical, and cleanup work should prefer removing temporary layering instead of deepening it.

## Foundation-First Rule

- Build portable foundation patterns first, then layer app-specific behavior on top.
- Keep `/system` genuinely app-agnostic so it can survive repo cloning into future apps.
- Do not hardcode current DnD-specific assumptions into portable layers unless they are required to preserve architectural integrity.
- Keep app-specific behavior in higher layers, scoped instructions, prompts, or app-specific docs rather than the always-on contract.

## Workflow Discipline

- Stay aligned with the active issue, milestone, and tier.
- Respect the current workflow role. Implementation work should not create or reorganize docs unless the task or workflow stage explicitly requires it.
- Do not widen scope just because adjacent cleanup is tempting; only take the follow-on edits necessary to keep the touched slice correct.
- Prefer handing work to the correct prompt, instruction, or agent flow instead of doing every stage in one pass.

## Durable Memory Model

- Treat memory as three layers:
    - chat history for short-term continuity while the current conversation is still alive
    - shared workflow artifacts such as issue docs, milestone or tier plans, PR bodies, and closeout docs
    - concise persistent memory notes for durable quirks, habits, recurring corrections, and repo workflow facts
- Use chat continuity when it exists, but do not depend on it. A restarted chat should be able to recover from the issue artifact layer plus persistent memory notes.
- Before acting on a multi-step workflow task, check relevant persistent memory when it could affect tone, scope, workflow choice, or known repo habits.
- Write back only durable, reusable learnings:
    - user preferences and recurring collaboration habits go in `.github/memories/workflow-preferences.md`
    - repo workflow facts, validated conventions, and stable process learnings go in `.github/memories/*.md`
- Do not store secrets, temporary issue state, speculative ideas, or long narrative summaries in persistent memory.
- Prefer updating an existing memory note over creating a new one, and keep memory entries short enough to stay useful after many sessions.

## Validation

- Run the narrowest useful validation for the touched scope.
- Default repo checks are:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run test`
  - `npm run config:validate`

## Where Code Usually Lives

- `/app`, `/components`: screens and UI surfaces
- `/hooks`: React bridge, UI-facing validation, and UI-ready state shaping
- `/managers`: orchestration, business validation/normalization, cross-module coordination, and use-case control
- `/lib`: independent domain logic and reusable module behavior called by managers
- `/middleware`: provider and infrastructure adaptation
- `/system`: portable infrastructure
- `/maps`, `/type-definitions`, `/validation`, `/pure-algo-immutables`, `/localization`, `/config`: shared support directories outside the main pipeline that may be imported across layers when appropriate

## Related References

- Use `.github/agentCommands.md` as the human-facing entry point for prompts and agents.
- Use `.github/DOCUMENTATION_MAP.md` for documentation routing during the cleanup and refactor.
- Use scoped instruction files under `.github/instructions/` for file-local rules that do not belong in this always-on contract.
