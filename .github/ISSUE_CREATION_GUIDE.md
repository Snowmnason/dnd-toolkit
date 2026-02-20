# Comprehensive Issue Creation Guide

**Purpose:** Document the standard format and methodology for writing detailed, actionable Tier 4 (and beyond) issues in the dnd-toolkit project.

**Applies to:** Issues that require multi-phase implementation (5+ phases), architectural decisions, or significant feature work.

**Reference Issues:** #70 (Analytics Buffer), #179 (Sentry Queue), #178 (Custom Exporters), #180 (Performance Regression), #181 (Persist Consent)

---

## Table of Contents

1. [Overview](#overview)
2. [Issue Header](#issue-header)
3. [Problem Statement](#problem-statement)
4. [Codebase Status](#codebase-status)
5. [Solution & Phases](#solution--phases)
6. [Phase 0: Discussion](#phase-0-discussion)
7. [Phase 1: Tracks (Implementation)](#phase-1-tracks-implementation)
8. [Phase 2: Documentation](#phase-2-documentation)
9. [Phase 3: Usage Guides](#phase-3-usage-guides)
10. [Phase 4: Testing](#phase-4-testing)
11. [Acceptance Criteria](#acceptance-criteria)
12. [Dependencies & Notes](#dependencies--notes)
13. [Formatting Conventions](#formatting-conventions)
14. [Quick Checklist](#quick-checklist)

---

## Overview

### 5-Phase Methodology

Each comprehensive issue follows a 5-phase structure:

| Phase | Purpose | Scope | Deliverable |
|-------|---------|-------|-------------|
| **Phase 0** | Understanding & Planning | Discussion, clarifying questions, draft PR body | Shared understanding of scope |
| **Phase 1: Tracks** | Implementation | Isolated tracks (A+B Core, C Integration, D Adoption, E Hardening) — include what applies | Working code per track, each independently reviewable |
| **Phase 2** | Documentation | Module README, API reference, architecture | lib/[module]/README.md |
| **Phase 3** | Guides & Testing | Usage guide, test guide with manual cases | docs/issues/MileStone/... |
| **Phase 4** | Testing | Unit, integration, E2E, stress tests | Test coverage verified |

### Why This Structure?

- **Phase 0:** Ensures both developer and user understand scope before code starts (prevents rework)
- **Phase 1 Tracks:** Isolates each concern (Core+Surface, Integration, Adoption, Hardening) so each track is reviewable independently — Track E keeps logging/warnings out of Track C reviews
- **Phase 2:** Ensures API is documented as it's built (not retrofit)
- **Phase 3:** Creates reusable guides for future developers
- **Phase 4:** Guarantees quality (unit + integration + E2E + stress)

---

# Template

## Issue Header

Start every issue with a header block:

# Issue #XXX: [Feature Name]

**Status:** Tier 4 (Category)  
**Impact:** LARGE / MEDIUM / SMALL — [1-2 sentence impact summary]  
**Depends on:** #ABC (Feature X), #DEF (Feature Y)  
**Integrates with:** `lib/module`, `lib/other-module`, Component/Hook name, Feature flags  
**Impacts (check if applicable):**
  - [ ] Config — edit `appsettings.json`, `appsettings.dev.json`, config loader, `expected-differences.json`
  - [ ] Storage/Migration (SecureStorage key, schema changes, migration logic)
  - [ ] PII/Privacy (user data handling, consent checks)
  - [ ] Encryption (data at rest via SecureStorage)

### Header Fields Explained

| Field | Purpose | Example |
|-------|---------|---------|
| **Status** | Tier level (Tier 1-4) and category | Tier 4 (Analytics & Privacy) |
| **Impact** | Business/technical significance | LARGE — User privacy, GDPR compliance |
| **Depends on** | Issues that must complete first | #206 (Offline Queue), #208 (Telemetry) |
| **Integrates with** | Code modules this touches | `lib/analytics`, `lib/storage/SecureStorage`, Feature flags |

### Header Best Practices

- **Depends on:** List 2-3 key dependencies in logical order (build order)
- **Integrates with:** Focus on MODULE PATHS, not filenames (more discoverable)
- **Status/Impact:** Keep concise (one sentence for Impact)
- **Forward-looking:** This is written AFTER earlier issues complete; assume they're working

---

## Problem Statement

**Goal:** Clearly explain what's broken and why it matters.

### Format

## Problem

[Current broken behavior with 2-3 concrete examples]

- **Issue 1** — What's missing or wrong
- **Issue 2** — Consequence of issue 1
- **Issue 3** — Real-world impact on users/developers

Result: [1-2 sentence summary of impact]

### Problem Writing Tips

- **Be specific:** "Consent is lost" is vague; "consent resets from 'full' to 'basic'" is concrete
- **Lead with user impact:** GDPR risk → UX friction → operational issue
- **Use bullet points:** Easy to scan, easy to verify as complete
- **End with business impact:** Why should this issue be prioritized?

---

## Codebase Status

**Goal:** Show what exists and what's missing, grounded in actual code.

### Format

## Codebase Status

**Currently Implemented:**
- ✅ [Module/file] — [What it does, why it's relevant]
- ✅ [Earlier issue] implementation — [Key classes/functions]

**Gap Analysis:**
- ⚠️ **[Missing piece 1]** — [Why needed, impact]
- ⚠️ **[Missing piece 2]** — [Example: no API exists, code tightly coupled]
- ⚠️ **[Missing piece 3]** — [Volume of work: "No README", "No test guide"]

### Gap Analysis Best Practices

- **Research first:** Read 2-3 relevant files to understand current state
- **Be specific:** "No persistence" is vague; "Breadcrumbs stored in memory only" is concrete
- **List volume:** "No README" is one issue, "No integration with #70" is another
- **Count gaps:** 5-8 gaps is appropriate; more = the issue is too large
- **Reference code:** Use actual filenames and class names

---

## Solution & Phases

**Goal:** Show how to fix the problem, broken into phases.

## Solution

[1-2 sentence summary: what will be built]

## Out of Scope

- [What is explicitly NOT being addressed in this phase]
- [Examples: "UI redesign", "Mobile-only feature", "Multi-provider support"]

### Solution Tips

- **Lead with big picture:** One sentence saying what architecture/pattern you're using
- **Use Tracks:** Include only the tracks that apply — A+B (always), C (always), D (if migrating), E (recommended)
- **Track isolation:** Each track is a separate review unit; don't mix concerns across tracks
- **Track titles are commit titles:** "Create consent manager and barrel exports" NOT "Track A+B: Create..."

---

## Phase 0: Discussion

**Goal:** Ensure developer and stakeholder agree on scope BEFORE any code is written.

## Phase 0: Understand scope and draft PR body

**Scope:**
- [ ] Read the issue thoroughly (Problem, Solution, acceptance criteria, edge cases)
- [ ] Discuss with author to confirm understanding:
  - **Key Q1:** [Specific architectural decision question?]
  - **Key Q2:** [API design decision?]
  - **Key Q3:** [Performance/privacy trade-off?]
  - **Key Q4:** [Integration with other system?]
  - **Key Q5:** [Feature scope or minimal MVP?]
- [ ] Clarify edge cases:
  - [Edge case 1 and recovery strategy]
  - [Edge case 2]
  - [Platform-specific concern]
  - [Error handling scenario]
- [ ] Confirm acceptance criteria are clear
- [ ] Draft PR body (copy into `docs/issues.md` for reference):
- **Follow the style guide:** See `.github\PR_BODY_TEMPLATE.md` for detailed formatting requirements for all issue docs

\`\`\`markdown
## [Feature Name] #XXX

[1-2 line summary]

### Features
- [Feature 1]
- [Feature 2]

### Key Decisions
- [Design decision 1]
- [Design decision 2]

### Tracks
- Track A+B: [Core files + barrel exports]
- Track C: [Runtime integration]
- Track D: [Adoption/migration, if applicable]
- Track E: [Hardening — logging, warnings, edge cases]
- Phase 2-4: [Docs, tests]

### Success Criteria
- [Criterion 1]
- [Criterion 2]
\`\`\`

### Phase 0 Tips

- **5 Key Questions:** Tailor each to the specific issue (not generic)
- **Edge cases:** List 5-8 realistic edge cases (app crash, quota exceeded, platform differences, etc.)
- **Draft PR body:** This is reference documentation (NOT a GitHub PR yet); it's a shared understanding
- **Clear acceptance criteria:** Make sure 3-5 success criteria are non-ambiguous

## Phase 1: Tracks (Implementation)

**Goal:** Build and wire the feature in isolated, reviewable increments.

Phase 1 uses a **Tracks model** — include only the tracks that apply. Each track is a separate review unit.

| Track | Name | Required? | Goal |
|-------|------|-----------|------|
| **A+B** | Core + Surface | Always (new system) | Build files in isolation, add barrel exports |
| **C** | Integration | Always | Wire into runtime (providers, hooks, bootstrap) |
| **D** | Adoption | Only if replacing something | Migrate call sites, remove old code |
| **E** | Hardening | Recommended | Logging, warnings, edge cases, type polish |
| **F** | Codebase Checklist | Always (before PR) | Final verification — PII, analytics gates, network resilience, safe mode |

> **For update issues:** Add a **Track 0 — Intent + Impact** step before coding (format below).

---

### Track 0 — Intent + Impact (update issues only)

Before writing any code on an update issue, define:

- **What is changing?** — behavior, signature, data shape, side effects
- **Is it breaking?** — yes/no + migration plan or feature flag scope
- **Impacted modules list** — even if incomplete (prevents "forgot to update X" PR churn)
- **Rollout plan** — flag / adapter / direct swap

✅ Exit: reviewer can see exactly what's changing and which files will be touched before a line of code is written.

---

### Track A+B — Core + Surface

**Goal:** The new system works in isolation and has a clean public API.

**Scope:**
- [ ] Create files, types, interfaces under `lib/module/`
- [ ] Implement core logic + edge cases
- [ ] Add internal validation (zod/guards), error types
- [ ] Add barrel exports (`lib/module/index.ts`)
- [ ] Define the one recommended import path
- [ ] Hide internals — only expose the public surface

✅ Exit: runs/unit-tests locally without touching app routing or UI. Reviewer can tell what's public vs private instantly.

---

### Track C — Integration

**Goal:** The app can actually use the system.

**Scope:**
- [ ] Add providers/hooks (if needed)
- [ ] Connect to navigation, bootstrap, request-manager, storage, cache, etc.
- [ ] Honor feature flags / dev-prod config (if relevant)
- [ ] Update `appsettings.json`, `appsettings.dev.json`, config loader, `expected-differences.json` (if applicable)

✅ Exit: feature is exercisable from the app (even if only in a dev screen or via logs).

---

### Track D — Adoption (only if migrating from old system)

**Goal:** Existing code stops doing the old thing.

**Scope:**
- [ ] Update impacted modules (list them explicitly)
- [ ] Replace old utilities / patterns
- [ ] Remove duplicated logic
- [ ] Mark any temporary compat adapters with `// TODO: remove after #XXX`

✅ Exit: no "half old / half new" behavior remains (or it's explicitly staged with a TODO).

---

### Track E — Hardening

**Goal:** Remove papercuts that cause PR churn. Keep isolated from Track C so logging/warnings don't pollute that review.

**Scope:**
- [ ] Fill edge cases discovered during Track C/D
- [ ] Tighten types
- [ ] Add runtime safety checks + clearer error messages
- [ ] Add logger categories and consistent error handling
- [ ] Fix any console warnings introduced

✅ Exit: `npm run lint` passes, no TypeScript errors, no noisy console output.

---

### Track F — Codebase Checklist

**Goal:** Final verification pass before PR. Confirm the feature is coded safely and integrated correctly with the app's cross-cutting concerns. This is a copy-paste checklist — tick what applies, skip what doesn't.

> ⚠️ This is a **coding checklist** only — testing and documentation have their own phases (2-4).

**Scope:**
- [ ] **PII Safety** — No user-identifiable data in logs, analytics events, or Sentry breadcrumbs; sanitized before leaving device
- [ ] **Analytics Consent Gate** — All analytics events check consent level before emitting; respects `ConsentLevel` (#181)
- [ ] **Safe Mode / Degradation** — Feature degrades gracefully; fallback UI exists; safe mode considered (#172)
- [ ] **Network Resilience** — Works offline or queues operations; circuit breaker aware (#206, #217)
- [ ] **Adaptive Payload** — Request payload sized for network quality where relevant (#205)
- [ ] **Background Jobs** — Async operations use job queue, not fire-and-forget promises (#167)
- [ ] **Feature Flag Gating** — Feature is gated if experimental; progressive rollout considered
- [ ] **Navigation System** — Centralized Navigation System that helps allow proper routing and auth grauds
- [ ] **Cache Invalidation** — Any data writes properly invalidate related cache tags; no orphaned stale data
- [ ] **Performance Baseline** — Screen/request timing tracked where relevant; slow operation thresholds respected (#180)
- [ ] **Config Support** — Behaviour is env-aware; feature toggles in `appsettings.json` if needed
- [ ] **Error Handling** — Errors categorized, user-facing messages exist, recovery path defined

✅ Exit: All applicable items checked. PR reviewer can see which items were skipped and why.

---

### Format for Each Track

## Track A+B: [Specific title]

**Scope:**
- [ ] Create `lib/module/file.ts`:
  - [Interface/type definition]
  - [Class with methods]
  - [Error handling approach]
- [ ] Barrel export in `lib/module/index.ts`

✅ Exit: [What to verify before moving to Track C]

### Optional: Sub-Tracks (when a track is large)

If Track A+B (or any track) has multiple **independent concerns**, break it into **Sub-tracks** that can be reviewed/implemented in sequence:

```markdown
## Track A+B: [Specific title with multiple concerns]

**Goal:** [Overall goal]

**Scope — Sub-track 1: [First independent concern]**
- [ ] [Task 1]
- [ ] [Task 2]

✅ Exit: [Sub-track 1 specific exit criteria]

---

**Scope — Sub-track 2: [Second independent concern]**
- [ ] [Task 3]
- [ ] [Task 4]

✅ Exit: [Sub-track 2 specific exit criteria]

---

**Scope — Sub-track 3: [Third independent concern]**
- [ ] [Task 5]

✅ Exit: [Sub-track 3 specific exit criteria and final track exit]
```

**When to use sub-tracks:**
- A single track is large enough that it has 2+ independent concerns (e.g., local storage + database persistence)
- Each sub-track can be implemented/reviewed independently
- Dependencies between sub-tracks are clear

**When NOT to use sub-tracks:**
- Track is already small (A+B are usually 1-2 files, C is 1-2 changes). Avoid over-organizing.
- Tasks are sequential and depend heavily on each other.

---

## Track C: [Integration title]

**Scope:**
- [ ] [Task with details]
- [ ] Config: `appsettings.json`, `appsettings.dev.json`, loader, `expected-differences.json`

✅ Exit: [What to verify]

---

## Track E: Hardening

**Scope:**
- [ ] [Logging + warnings + edge cases]

✅ Exit: lint passes, no TypeScript errors, no console noise

---

## Track F: Codebase Checklist

- [ ] **PII Safety** — [tick or note N/A]
- [ ] **Analytics Consent Gate** — [tick or note N/A]
- [ ] **Safe Mode / Degradation** — [tick or note N/A]
- [ ] **Network Resilience** — [tick or note N/A]
- [ ] **Adaptive Payload** — [tick or note N/A]
- [ ] **Background Jobs** — [tick or note N/A]
- [ ] **Feature Flag Gating** — [tick or note N/A]
- [ ] **Cache Invalidation** — [tick or note N/A]
- [ ] **Performance Baseline** — [tick or note N/A]
- [ ] **Config Support** — [tick or note N/A]
- [ ] **Error Handling** — [tick or note N/A]

✅ Exit: All applicable items checked. Skipped items noted as N/A.

### Tracks Tips

- **Track isolation:** Do not mix A+B work into Track C — each track is its own review unit
- **Track E is always separate:** Logging and warning fixes go here, not in C — keeps C reviews clean
- **Config always in Track C:** All `appsettings.*` + `expected-differences.json` edits belong in Track C
- **Sub-tracks for large tracks:** If a single track has 2+ independent concerns (e.g., local + database persistence), break into Sub-track 1, 2, 3 — each with its own exit criteria. Avoids single PRs being too large.
- **Specific over vague:** Include TypeScript interfaces, method signatures, config JSON
- **Track titles are commit titles:** e.g., "Create consent manager and barrel exports"

### Example Track A+B Scope Item

```markdown
- [ ] Create `lib/analytics/performance-baseline.ts`:
  - `OperationBaseline` type: `{ label, p50, p95, p99, lastUpdated, version }`
  - `PerformanceBaselineService` class:
    - `initialize()` → Load from SecureStorage
    - `recordSample(label, duration)` → Add + persist
    - `getBaseline(label)` → Return p50/p95/p99
  - Storage key: `dnd:performance:baselines` (use STORAGE_KEYS)
  - Validation: Ensure p50 ≤ p95 ≤ p99
- [ ] Export from `lib/analytics/index.ts`

---

## Phase 2: Documentation

**Goal:** Module README documenting architecture, API, integration points.

## Phase 2: Create lib/[module]/README.md

**Scope:**

**Create or update `lib/[module]/README.md` following the repository's style guide:**
- [ ] "When to Use This Module" section (suitable vs unsuitable use cases)
- [ ] Architecture & Data Flow (brief description or diagram)
- [ ] API Reference (all exports with type signatures and code examples)
- [ ] Dependencies (external packages + internal lib dependencies)
- [ ] Error Handling & Edge Cases (known limitations, error patterns)
- [ ] Performance Notes (caching, overhead, optimization tradeoffs)
- [ ] Related Modules (links to connected lib/* modules)
- [ ] File Breakdown (what each file does in a table)
- [ ] Testing section (link to test guide if exists, or manual testing tips)
- [ ] Future Enhancements (planned improvements or tech debt)
- [ ] **Must be app-agnostic** – no app-specific language; readable by developers using this in future projects


### Phase 2 Tips

- **Focus on developer experience:** This is for FUTURE developers using this module
- **Code examples:** Show common usage patterns (best case, error case)
- **Architecture diagrams:** ASCII or brief mermaid (help visualize data flow)
- **Don't document implementation:** Document the API and intent, not internal details
- **Link to other modules:** Make it easy to discover related functionality
- **Follow the style guide:** See `.github\README_STYLE_GUIDE.md` for detailed formatting requirements for all issue docs
- **Avoid Testing/Future sections if not applicable:** Per repository guidelines, these are optional for simple modules but required for complex ones

---

## Phase 3: Usage Guides

**Goal:** Real-world integration guide + test guide for manual testing.

## Phase 3: Create usage guide

**Scope:**

**Create `docs/issues/MileStone X/XXX - [Feature]/IMPLEMENTATION_GUIDE.md` (for complex features):**
- [ ] Architecture overview and data flow
- [ ] File structure and key classes/interfaces
- [ ] Integration points with existing modules
- [ ] Configuration options and appsettings
- [ ] Error handling patterns and edge cases

**Create `docs/issues/MileStone X/XXX - [Feature]/USAGE_GUIDE.md`:**
- [ ] Integration checklist (step-by-step how to add to app)
- [ ] Code examples (all common use cases)
- [ ] Common patterns (recommended ways to use)
- [ ] Debugging section (how to identify issues)
- [ ] Troubleshooting (common problems + solutions)

Additional files are allowed and encouraged when needed:

| File (example names) | When to create it |
| -------------------- | ----------------- |
| `ARCHITECTURE.md` | When the feature has a non-trivial data flow or system design worth diagramming separately |
| `EXAMPLES.md` | When the Usage Guide would get too long with all examples inline |
| `LIMITS.md` | When the feature has important constraints, quotas, or known boundaries a dev needs to know |
| `MISSING.md` or `GAPS.md` | When scope was intentionally cut and a future dev needs to know what is not done yet |
| `VARIANT_TRACKING_GUIDE.md` | Feature-specific doc for A/B test variant tracking, etc. |

### Phase 3 Tips

- **Follow the style guide:** See `.github/ISSUE_DOC_STYLE_GUIDE.md` for detailed formatting requirements for all issue docs
- **Optional additional docs:** For complex features, consider creating `ARCHITECTURE.md`, `EXAMPLES.md`, `LIMITS.md`, `MISSING.md`, or `VARIANT_TRACKING_GUIDE.md` as needed (see style guide for when to use each)

---

## Phase 4: Testing

**Goal:** Comprehensive test coverage (unit, integration, E2E, stress).

## Phase 4: Comprehensive tests

**Scope:**
- [ ] Unit tests:
  - [10-15 test cases covering core functionality]
  - [Edge cases]
  - [Validation]

- [ ] Integration tests:
  - [Multi-component interaction]
  - [With other tier X features]
  - [Offline scenarios]

- [ ] End-to-end test:
  - [Full workflow from start to finish]

- [ ] Stress tests:
  - [High volume of operations]
  - [Concurrent calls]
  - [Storage limits]

- [ ] Lint & typecheck:
  - `npm run lint` passes
  - `npm run typecheck` passes

**Create or update `docs/A Testing Guide/[Feature] Testing.md`:**
  - [ ] Manual test cases (appropriate number with detailed steps)
  - [ ] Test data setup (mocks, fixtures)
  - [ ] Platform testing notes (web/iOS/Android variations)
  - [ ] Success criteria (how to know tests passed)
```

### Phase 4 Tips

- **Unit tests:** Focus on individual functions/methods; mock dependencies
- **Integration tests:** Combine multiple modules; test real interactions
- **E2E tests:** Full workflow (e.g., record sample → restart app → baseline restored)
- **Stress tests:** Ensure no unbounded growth, handles 100x normal load
- **Lint check:** Must pass `npm run lint` (no Type errors)
- **For detailed testing guidance:** See [DETAILED_TESTING_GUIDE.md](.github/DETAILED_TESTING_GUIDE.md)

---

## Acceptance Criteria

**Goal:** Measurable, verifiable criteria for each phase.

## Acceptance Criteria

**Phase 1 (CODING)**
- [ ] Queue persists to SecureStorage
- [ ] FIFO overflow drops oldest (max 100)
- [ ] Validation prevents corrupted data
- [ ] Storage key uses STORAGE_KEYS constant

**Phase 2 (README):**
- [ ] README.md created
- [ ] Architecture diagram included
- [ ] API reference complete
- [ ] Examples provided

**Phase 3 (Guides):**
- [ ] USAGE_GUIDE.md created
- [ ] Success criteria quantified

**Phase 4 (Tests):**
- [ ] Unit tests: 80%+ coverage
- [ ] Integration tests passing
- [ ] E2E test passing
- [ ] Lint and typecheck passing

---

## Dependencies & Notes

**Goal:** Clarify relationships to other issues and document assumptions.

### Format

```markdown
## Dependencies

- `lib/module/` — [What this depends on and why]
- #XXX (Feature Name) — [Why this must complete first]
- Feature flags system — [Which flags control this feature]

---

## Notes

- **Design principle:** [Why this approach was chosen]
- **Important caveat:** [What could go wrong, how to avoid]
- **Future work:** [Extensions or improvements for later]
- **Pre-release stance:** [No backwards compatibility, breaking changes OK]
- **Builds on:** [References to earlier patterns]
```

# General Tips

### Acceptance Criteria Tips

- **Per-phase:** Each phase has its own criteria
- **Measurable:** Use specific numbers (100 events, 5 retries, <10ms latency)
- **Verifiable:** Each criterion can be checked (not subjective)
- **Checkboxes:** Format as `- [ ]` for tracking

### Dependencies Tips

- **Reference actual issue numbers:** #206, not "offline queue"
- **List both code modules and feature IDs:** Make discoverable from either angle
- **Explain the dependency:** Not just "depends on X", but "uses #206's queue pattern for consistency"

### Notes Tips

- **Design principle:** Justify why this approach (thread-safety, extensibility, performance)
- **Important caveats:** What assumptions does this make? (e.g., "assumes #206 complete")
- **Future work:** Plan for next iterations (don't over-design now)
- **Pre-release note:** "No backwards compatibility; breaking changes welcome" (saves tokens)

---

## Formatting Conventions

| Element | Format | Example |
|---------|--------|---------|
| **Filenames** | Backticks | `lib/analytics/consent.ts` |
| **Class names** | Backticks | `AnalyticsConsentManager` |
| **Function names** | Backticks | `recordSample(label, duration)` |
| **Type names** | Backticks | `ConsentLevel` |
| **Feature flags** | Single quotes | flag `'track-performance-baseline'` |
| **Storage keys** | Backticks | `STORAGE_KEYS.ANALYTICS_CONSENT` |
| **Issue references** | Hash + number | #206, #181 |
| **Code blocks** | Triple backticks + language | \`\`\`typescript ... \`\`\` |
| **Emphasis** | **bold** for important terms, *italics* for emphasis | `**critical**`, *non-blocking* |

### Conventions

- **Track/Phase headers** are commit titles: "Create queue structure" not "Track A+B: Create..."
- **Checkboxes** for all task lists: `- [ ] Task name`
- **Subheadings** use `##` for phase/track-level, `###` for task-level
- **Inline code** for all technical terms (files, types, flags)
- **Specific over vague:** "Queue breadcrumbs to SecureStorage (max 500)" not "Add offline support"
- **Active voice:** "The queue drops oldest events" not "Oldest events are dropped"

---

## Quick Checklist

Use this before submitting an issue:

### Issue Structure
- [ ] Header present (Status, Impact, Depends on, Integrates with)
- [ ] Config `Impacts` checkbox expanded — `appsettings.json`, `appsettings.dev.json`, loader, `expected-differences.json`
- [ ] Problem statement has 3-4 bullet points
- [ ] Codebase Status split into "Implemented" and "Gaps"
- [ ] Phases listed: 0, 1 (Tracks), 2, 3, 4
- [ ] Phase 0 has 5 Key Questions
- [ ] Track 0 included if this is an update issue
- [ ] Phase 1 tracks listed: A+B (always), C (always), D (if migrating), E (recommended), F (always before PR)
- [ ] Track F completed — all applicable items checked or marked N/A
- [ ] Each track has a clear ✅ Exit criteria
- [ ] Phase 2 is README creation
- [ ] Phase 3 is USAGE_GUIDE + Testing.md
- [ ] Phase 4 is comprehensive tests

### Content Quality
- [ ] All file paths use backticks (`lib/module/file.ts`)
- [ ] All class/function names use backticks
- [ ] Issue references use #XXX format
- [ ] Code examples are TypeScript (not pseudocode)
- [ ] Each track has ✅ Exit criteria
- [ ] Acceptance criteria are per-track and measurable
- [ ] Dependencies section explains WHY, not just lists
- [ ] Notes section includes design principles + future work

### Research
- [ ] Read 3+ related source files (actual codebase)
- [ ] Referenced actual issue numbers (#206, #179)
- [ ] Checked for existing implementations (not reinventing)
- [ ] Identified actual storage keys/constants used
- [ ] Noted feature flags that might control this

### Phase 0 Specific
- [ ] 5 Key Questions tailored to THIS issue (not generic)
- [ ] 5-8 edge cases listed
- [ ] Draft PR body included (markdown code block)
- [ ] Draft body includes: Features, Key Decisions, Tracks, Success Criteria

---

## Template (Copy-Paste Ready)

Create a new issue file with this structure:

```markdown
# Issue #XXX: [Feature Name]

**Status:** Tier 4 (Category)  
**Impact:** LARGE — [Impact summary]  
**Depends on:** #ABC (Feature X), #DEF (Feature Y)  
**Integrates with:** `lib/module`, `lib/other-module`

## Problem

[3-4 bullets describing what's broken, specific examples]

Result: [1-2 sentence business impact]

## Codebase Status

**Currently Implemented:**
- ✅ [Module] — [What exists]

**Gap Analysis:**
- ⚠️ **[Missing piece]** — [Why needed]

## Solution

Build [architecture/pattern description]:

1. **Phase 0** — Understand scope
2. **Track A+B** — [Core files + barrel exports]
3. **Track C** — [Runtime integration]
4. **Track D** — [Adoption, if migrating]
5. **Track E** — [Hardening — logging, warnings, edge cases]
6. **Track F** — Codebase Checklist
7. **Phase 2** — Documentation
8. **Phase 3** — Guides
9. **Phase 4** — Testing

---

## Phase 0: Understand scope and draft PR body

**Scope:**
- [ ] Read issue thoroughly
- [ ] Discuss with author:
  - **Key Q1:** [Question?]
  - **Key Q2:** [Question?]
  - **Key Q3:** [Question?]
  - **Key Q4:** [Question?]
  - **Key Q5:** [Question?]
- [ ] Clarify edge cases
- [ ] Confirm acceptance criteria
- [ ] Draft PR body:

\`\`\`markdown
## [Feature] #XXX

[Summary]

### Features
- [Feature 1]

### Key Decisions
- [Decision 1]

### Tracks
- Track A+B: [Core files + barrel exports]
- Track C: [Runtime integration]
- Track D: [Adoption/migration, if applicable]
- Track E: [Hardening — logging, warnings, edge cases]
- Phase 2-4: [Docs, tests]

### Success Criteria
- [Criterion 1]
\`\`\`

---

## Track A+B: [Core + Surface title]

**Scope:**
- [ ] Create `lib/module/file.ts` — [types, class, logic]
- [ ] Barrel export in `lib/module/index.ts`

✅ Exit: [What to verify before Track C]

---

## Track C: [Integration title]

**Scope:**
- [ ] [Provider/hook/bootstrap task]
- [ ] Config: `appsettings.json`, `appsettings.dev.json`, loader, `expected-differences.json` (if applicable)

✅ Exit: [Feature exercisable from app]

---

## Track D: [Adoption title] *(only if migrating)*

**Scope:**
- [ ] Update: [list impacted modules]
- [ ] Remove old: [what to delete]

✅ Exit: No half-old/half-new behavior remains

---

## Track E: Hardening

**Scope:**
- [ ] [Logging, warnings, edge cases]

✅ Exit: `npm run lint` passes, no TypeScript errors, no console noise

---

## Track F: Codebase Checklist

- [ ] **PII Safety** — [tick or N/A]
- [ ] **Analytics Consent Gate** — [tick or N/A]
- [ ] **Safe Mode / Degradation** — [tick or N/A]
- [ ] **Network Resilience** — [tick or N/A]
- [ ] **Adaptive Payload** — [tick or N/A]
- [ ] **Background Jobs** — [tick or N/A]
- [ ] **Feature Flag Gating** — [tick or N/A]
- [ ] **Cache Invalidation** — [tick or N/A]
- [ ] **Performance Baseline** — [tick or N/A]
- [ ] **Config Support** — [tick or N/A]
- [ ] **Error Handling** — [tick or N/A]

✅ Exit: All applicable items checked. Skipped items noted as N/A.

---

## Phase 2: Create lib/module/README.md

**Scope:**
- [ ] Create README.md with sections

---

## Phase 3: Create usage guide and test guide

**Scope:**

**Create `docs/issues/.../USAGE_GUIDE.md`:**
- [ ] Integration checklist
- [ ] Code examples
- [ ] Debugging section

**Create `docs/A Testing Guide/[Feature] Testing.md`:**
- [ ] 14+ manual test cases
- [ ] Test data setup
- [ ] Success criteria

---

## Phase 4: Comprehensive tests

**Scope:**
- [ ] Unit tests
- [ ] Integration tests
- [ ] E2E test
- [ ] Stress tests
- [ ] Lint & typecheck

---

## Acceptance Criteria

**Track A+B:**
- [ ] [Criterion 1]

**Track C:**
- [ ] [Criterion 1]

**Track D:** *(if applicable)*
- [ ] [Criterion 1]

**Track E:**
- [ ] lint passes, no TypeScript errors

**Track F (Codebase Checklist):**
- [ ] All applicable items checked or marked N/A

**Phase 2-4:****
- [ ] [Criterion 1]

---

## Dependencies

- `lib/module` — [Dependency explanation]
- #XXX (Feature) — [Why needed first]

---

## Notes

- **Design principle:** [Why this approach]
- **Important caveat:** [What to watch for]
- **Pre-release:** [No backwards compatibility]
```

---

## Further Resources

- **Reference issues:** #70, #179, #178, #180, #181 (all follow this pattern)
- **Tier 3 pattern:** #054-#228 (smaller, feature-flag focused)
- **Tier 2 issues:** Codebase docs, storage layer, auth (look for examples in `docs/issues/`)
- **.github/copilot-instructions.md** — Repo philosophy and patterns

---

## Last Tips

1. **Write the issue as if 3 months have passed:** Be detailed enough that someone unfamiliar with the context can understand
2. **Assume earlier issues are done:** This is forward-looking documentation
3. **Link everything:** Use issue numbers, file paths, module references liberally
4. **Show your work:** Concrete examples (code snippets, interfaces, config JSON) > abstract descriptions
5. **Test your writing:** Can someone actually implement from this? Can they pass acceptance criteria?

---
