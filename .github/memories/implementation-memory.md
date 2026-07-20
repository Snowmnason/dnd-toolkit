# Implementation Memory

## Use For
- Durable coding preferences that affect how implementation work should be carried out.
- Recurring cleanup expectations, scope-discipline reminders, and implementation habits.
- Stable quirks that help future issue slices stay consistent.

## Do Not Include
- Patch notes, raw diffs, or file-by-file change logs.
- Temporary bug state, current failing output, or issue-specific debugging notes.
- Backlog ideas, follow-up brainstorming, or docs and test tasks that belong elsewhere.
- Secrets, credentials, or machine-local setup details.

## Notes
- Keep implementation focused on code work and hand docs or tests off to the matching workflow instead of absorbing them here.

---

## Code Classification

**Dead Code** (delete immediately):
- Code replaced with cleaner/optimized versions
- Unused callsites after refactoring where the new path is active
- Old patterns made obsolete by architectural changes

**Unused Code for Future Features** (keep with "// Unused: ..." or "// Upcoming: ..." comments):
- Foundational infrastructure built for planned features not yet implemented
- Plugin/extension points designed but not yet used by the app
- Architecture-forward functions that are part of the design but not activated
- Mark with comment explaining intended use case

Example: `registerEventConsentMapping()` and `runtimeMapping` are foundational for plugin analytics (planned feature). Not dead—keep with "Unused" comment.

## Code Cleanup Patterns

**Consent Gating Refactoring (Issue #301):**
- Mark unused foundational code with `// Unused: ... ` comments explaining intended use case rather than deleting
- Remove re-exports that bloat import surface; let callers import from source directly
- Change log level from `.warn()` to `.debug()` for expected conditions (unmapped events) to reduce noise
- Remove unused function parameters, even if "kept for future expansion"—adds cognitive load and type complexity
- Test files must be updated when function signatures change (parameter removals)

---

## Manager Gateway Pattern Learnings

**Issue #301 — Analytics Manager Gateway**

### Principle: Move Code As-Is, Avoid Redesign

When establishing a manager gateway, prefer moving existing working code into the new location rather than redesigning it mid-move. Example:
- **Initial plan**: Separate tracker/orchestrator APIs (UI vs. lib) with new abstractions
- **Outcome**: Overcomplicated; added unnecessary indirection
- **Applied**: Unified single `Analytics` object; moved functions unchanged; split only by complexity/file size

**Takeaway:** Simpler abstractions (one manager, single entry point) prove more durable than context-specific APIs that try to solve too much.

### Principle: Global State for Truly Global Concerns

For concerns that are genuinely app-global and rarely change (like consent level), a mutable global variable at type-level is acceptable and can optimize hot paths:

```typescript
// type-definitions/analytics-types.ts
export let currentConsentLevel: ConsentLevel = 'basic'
export function setCurrentConsentLevel(level: ConsentLevel): void { ... }
```

Fast reads in hot paths: `if(currentConsentLevel === 'full') { ... }` (no function call)
Writes always routed through persistent layer: `AnalyticsConsent.setLevel()` (ensures storage/sync)

**Takeaway:** Dual-read pattern (global for speed, pipeline for correctness) works well for state that bridges layers.

### Principle: Keep Manager Files Focused

Manager entry points should be tight and minimal (~60 lines for public API). Delegate helpers to secondary files:
- `analytics-manager.ts` — Public API only
- `analytics-helpers.ts` — Private implementation details

This keeps the entry point clear and prevents scope creep.

**Takeaway:** The "main file" should read like an API contract, not implementation details.

---
