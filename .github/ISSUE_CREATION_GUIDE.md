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
6. [Implementation Tracks](#implementation-tracks)
7. [Acceptance Criteria](#acceptance-criteria)
8. [Dependencies & Notes](#dependencies--notes)
9. [Formatting Conventions](#formatting-conventions)
10. [Quick Checklist](#quick-checklist)

---

## Overview

### Track-Based Implementation Methodology

Each issue follows a **single implementation phase** broken into **focused tracks** (A, B, C, etc.), with documentation and testing tracked separately in Acceptance Criteria:

| Section | Purpose | Scope | Deliverable |
|---------|---------|-------|-------------|
| **Header + Problem + Status** | Context & understanding | Already discussed in conversation | Clear scope definition |
| **Implementation Tracks** | Building the feature | Isolated tracks, each independently reviewable | Working code per track, zero regressions |
| **Acceptance Criteria** | Code quality, docs, tests | Checklists (not phases) | Code quality checklist + mandatory docs + optional docs + tests |

### Why This Structure?

- **Conversation replaces Phase 0** — You (as author) discuss scope upfront with the developer; the issue itself is ready to code
- **Tracks are ordered, independent units** — Each track is a separate review unit (e.g., "Create cascade manager" is reviewable in isolation from "Add logging")
- **Track order varies by issue type:**
  - **New features:** Create files → Integrate → Optimize → Verify (checklist)
  - **Refactors/updates:** Define intent → Create new → Delete old → Migrate call sites → Verify (checklist)
- **Acceptance Criteria are checklists, not phases** — No "Phase 2 Docs" or "Phase 3 Tests"; instead, a final comprehensive checklist covering code quality, mandatory docs (USAGE_GUIDE.md + IMPLEMENTATION.md), optional docs (as needed), and tests (unit/integration + testing guide if visually testable)

> **Key principle:** Tracks are for **development** (writing code). Documentation and testing are tracked as acceptance criteria and can be handled by separate workflows once code is approved.

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
- **Track titles are commit titles:** "Create cascade manager and shared types" NOT "Track A+B: Create..."
- **Track order varies:** See section below for new features vs. updates/refactors
- **Each track is independently reviewable** — do not mix concerns across tracks

---

## Implementation Tracks

**Goal:** Build and wire the feature in isolated, reviewable increments.

Tracks are the core of implementation. Each track is a separate commit-ready unit of work. **Track order, scope, and naming vary by issue type.**

### Track Structure by Issue Type

| Issue Type | Track Order | Example |
|-----------|------------|---------|
| **New Feature** | A (Create) → B (Create more/Integrate) → C (Integrate full) → D (Optimize) → [Final: Verify] | Create files, integrate into providers/hooks, optimize implementation, verify PII/analytics |
| **Refactor/Update** | 0 (Intent) → A (Create new) → B (Delete old) → C (Migrate) → D (Optimize) → [Final: Verify] | Define what's changing, create new version, delete obsolete code, update call sites, verify |
| **Simple Addition** | A (Create) → [Final: Verify] | Skip intermediate steps if uncomplicated |

**Final Track (verification):** Always end with a verification track for:
- PII safety, analytics consent gates
- Centralized systems (Network, Storage, Cache, Jobs)
- App practices (theming, navigation, error handling)

Name it whatever makes sense (F, G, H, etc. — the name doesn't matter, you're just verifying best practices).

---

### Track Naming & Format

**Track names should be descriptive commit titles**, not generic "Track A" labels:
- ✅ `Track A: Create cascade manager and shared types`
- ✅ `Track B: Integrate into QueryCache and bootstrap`
- ✅ `Track C: Delete old invalidation logic and migrate call sites`
- ❌ `Track A+B: Core + Surface`
- ❌ `Track C: Integration`

**Each track format:**

## Track [Letter]: [Descriptive Title]

**Scope:**
- [ ] [Task 1 with details]
- [ ] [Task 2 with details]

**Files Changed:**
- `lib/module/file.ts` (new/updated)
- `config/appsettings.json` (updated, if applicable)

✅ Exit: [What to verify before moving to next track]

---

### When to Use Sub-Tracks

If a single track has **2+ independent concerns** that could be reviewed separately, break it into **Sub-tracks**:

## Track A: [Main Goal]

**Scope — Sub-track 1: [First independent concern]**
- [ ] [Task 1]
- [ ] [Task 2]

✅ Exit: [Specific exit criteria for sub-track 1]

---

**Scope — Sub-track 2: [Second independent concern]**
- [ ] [Task 3]
- [ ] [Task 4]

✅ Exit: [Specific exit criteria for sub-track 2 and full track]

Use sub-tracks when:
- Each concern is 3+ tasks
- Each could be reviewed/tested independently
- Overall track count stays manageable (5-7 tracks total)

**Do NOT use sub-tracks when:**
- Track is already small (3-5 tasks total) — avoid over-organizing
- Tasks are sequential and depend on each other

---

### Track Patterns & Examples

#### Example: New Feature Tracks (Create → Integrate → Optimize → Verify)

```
Track A: Create cascade manager and shared types
  - Create lib/storage/cache/cascade-manager.ts
  - Create type-definitions/cache-invalidation.ts
  - Barrel export

Track B: Add transaction coordinator and filters
  - Create lib/storage/cache/transaction-coordinator.ts
  - Create lib/storage/cache/conditional-filter.ts
  - Barrel export

Track C: Integrate into QueryCache and bootstrap
  - Update system/storage/cache/query-cache.ts (add methods)
  - Update lib/kernel/bootstrap.ts (initialize capacity)
  - Update config/appsettings.json

Track D: Optimize and add deferred invalidation
  - Create lib/storage/cache/lru-eviction.ts
  - Create lib/storage/cache/deferred-queue.ts
  - Performance validation

Track F: Verify PII, Analytics, Centralized Systems
  - Checklist: PII in logs? Analytics gates? Using Storage/Cache/Network correctly?
```

#### Example: Refactor Tracks (Define Intent → Create New → Delete Old → Migrate → Verify)

```
Track 0: Define Intent + Impact
  - What is changing? (behavior, API, data shape)
  - Breaking changes? Migration plan?
  - List of modules to update

Track A: Create new [system] alongside existing
  - New files, new API
  - Work independently of old system

Track B: Delete old [system]
  - Remove deprecated files
  - Remove old utilities

Track C: Migrate call sites
  - Update all impacted modules to use new system
  - Update tests
  - Verify no regressions

Track D: Optimize new implementation
  - Performance tuning
  - Edge case handling

Track F: Verify PII, Analytics, Centralized Systems
  - Final checklist
```

---

### Track Tips

- **Track isolation:** Each track should be independently reviewable and mergeable (with proper commit message context)
- **Track order:** Follow the pattern for your issue type (new vs. refactor) — don't shuffle tasks randomly
- **Final verification track:** Always include a final track (F, G, H, whatever) for PII/analytics/centralized systems checklist
- **Config in one place:** All `appsettings.json`, `appsettings.dev.json`, config loader edits go in one track (usually Track C or its own early track)
- **Sub-tracks for clarity:** If a single track has 2+ independent concerns (e.g., local storage + database persistence), break into sub-tracks
- **Specific over vague:** Include TypeScript interfaces, method signatures, config JSON snippets
- **Track titles are commit titles:** "Create cascade manager and shared types" is a good commit message; use it as your track title

---

### Track 0 — Intent + Impact (update/refactor issues only)

If refactoring or updating an existing system, **start with Track 0** to define scope before coding:

## Track 0: Define Intent + Impact

**Scope:**
- [ ] **What is changing?** — behavior, signature, data shape, side effects
  - Example: "Auth flow now uses new OAuth provider + token refresh strategy"
- [ ] **Is it breaking?** — yes/no + migration plan or feature flag scope
  - Example: "Breaking API change; use feature flag 'useNewAuth' during transition"
- [ ] **Impacted modules list** — even if incomplete (prevents "forgot to update X" PR churn)
  - Example: "lib/auth, lib/network, hooks/auth, Screens/login, component/TopBar"
- [ ] **Rollout plan** — feature flag / adapter / direct swap
  - Example: "Feature flag 'useNewAuth' defaults to false; progressively roll out"

✅ Exit: Reviewer can see exactly what's changing and which modules will be touched before code is written.

---

## Documentation & Testing Workflows

**Important:** Phases 2 (Documentation), 3 (Guides), and 4 (Testing) are **NOT part of the issue narrative**. Instead, they are tracked in [Acceptance Criteria](#acceptance-criteria) as checklists and handled by **separate specialized agent workflows** to avoid context-switching.

**Why separate workflows?**
- Developers focus on Phase 0 (discussion) + Phase 1 (code implementation) without distraction
- Documentation (README, usage guides) goes to a dedicated documentation agent
- Testing is handled by a testing/QA agent
- Each workflow can be parallelized independently

This keeps issues lean and focused on technical decision-making and implementation.

---

## Acceptance Criteria

**Goal:** Measurable, verifiable criteria including code implementation AND accompanying documentation/tests.

### Format

Simple checklists — hand these to separate agent workflows for documentation and testing.

 
## Acceptance Criteria

**Phase 1 (Implementation):**
- [ ] [Specific code criterion]
- [ ] [Integration criterion]
- [ ] [Config/setup criterion]

**Phase 2 (README):**
- [ ] `lib/[module]/README.md` with architecture, API reference, examples
- [ ] All public exports documented
- [ ] Integration points with other modules clearly explained

**Phase 3 (Guides):**
- [ ] `docs/issues/MileStone X/[Feature]/USAGE_GUIDE.md` with integration checklist, examples, common patterns, debugging
- [ ] `docs/issues/MileStone X/[Feature]/IMPLEMENTATION_GUIDE.md` with architecture overview, file structure, integration points

**Phase 4 (Tests):**
- [ ] Unit tests (80%+ coverage) for core logic
- [ ] Integration tests for module interactions
- [ ] E2E test for full workflow
- [ ] `npm run lint` and `npm run typecheck` passing
- [ ] `docs/A Testing Guide/[Feature] Testing.md` with manual test cases and success criteria
 

### Acceptance Criteria Tips

- **Phase 1:** Focus on WHAT the code does (not HOW it's tested). Checkboxes for each deliverable.
- **Phase 2-4:** Simple checklists of WHAT to document/test. No descriptions of implementation.
- **Measurable:** Use specific targets (80%+ coverage, 5-8 manual test cases)
- **Verifiable:** Each criterion can be objectively checked
- **Separate workflows:** Don't mix implementation details with doc/test requirements — they're delegated independently

---

## Dependencies & Notes

**Goal:** Clarify relationships to other issues and document assumptions.

### Format

 
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

### ⚠️ Critical Guidelines (Non-Negotiable)

For **all lib/[module] issues**, these are mandatory:

- [ ] **Module README:** One `lib/[module]/README.md` at module root ONLY. Includes all 10 required sections.
- [ ] **Mandatory Docs:** Exactly 2 files in `docs/issues/...` → `USAGE_GUIDE.md` + `IMPLEMENTATION.md`
- [ ] **Optional Docs:** Created ONLY if the feature genuinely warrants them (use the table above for guidance)
- [ ] **Testing Guide:** Created ONLY for visually testable features (UI, navigation, real-time behavior)
- [ ] **Test Files:** ALL tests in `lib/[module]/__tests__/` ONLY. Never scatter like `lib/[module]/auth.test.ts`.

### Issue Structure
- [ ] Header present (Status, Impact, Depends on, Integrates with, Impacts checkboxes)
- [ ] Problem statement has 3-4 specific bullet points + result summary
- [ ] Codebase Status split into "Implemented" and "Gaps" (5-8 gaps is appropriate)
- [ ] Solution describes architecture/pattern + lists out-of-scope items
- [ ] Implementation Tracks section with A-[N] tracks (no Phase 0 in the issue itself)
- [ ] Track 0 included if this is an update/refactor issue
- [ ] Each track has 3-8 specific tasks
- [ ] Each track has ✅ clear Exit criteria
- [ ] Use sub-tracks for large tracks with 2+ independent concerns
- [ ] Final track includes codebase checklist (PII, analytics, centralized systems, etc.)
- [ ] Acceptance Criteria has 4 sections: Code / Docs Mandatory / Docs Optional / Testing

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

1. **Phase 0** — Understand scope and discussion
2. **Phase 1 - Track A+B** — Core implementation + barrel exports
3. **Phase 1 - Track C** — Runtime integration
4. **Phase 1 - Track D** — Adoption/migration (if applicable)
5. **Phase 1 - Track E** — Hardening (logging, warnings, edge cases)
6. **Phase 1 - Track F** — Codebase checklist
7. **Acceptance Criteria** — Phase 2 (README), Phase 3 (Guides), Phase 4 (Tests)

---

## Acceptance Criteria

Acceptance criteria are organized into 4 sections: **Code Quality** (non-negotiable), **Mandatory Documentation** (required for all lib/[module] issues), **Optional Documentation** (as needed), and **Testing** (unit/integration tests + testing guides only if visually testable).

This is the final approval checklist for code review.

---

### Code Quality Criteria

These apply to **all** issues before PR:

- [ ] **TypeScript strict** — No `any` types without justification. All return types explicit.
- [ ] **ESLint passes** — `npm run lint` returns no errors or warnings
- [ ] **No console noise** — No console.log, console.warn, console.error unless intentional (debugging)
- [ ] **Imports correct** — Validate architecture layers:
  - `system/` imports external packages only (no `lib/`, no `hooks/`)
  - `lib/` imports from `system/`, `/validation`, `/type-definitions`, `/maps`, `/config`, `/pure-algo-immutables` only
  - `hooks/` imports from `lib/`, contexts, theme, config (types only)
  - Components import from `hooks/`, components, theme, providers only
- [ ] **No PII in logs** — User data, email, IDs sanitized before logging
- [ ] **No hardcoded storage keys** — Always use `STORAGE_KEYS` from `/maps/storage-keys.ts`
- [ ] **Documentation strings** — Complex functions/types have JSDoc comments explaining purpose + params
- [ ] **Error handling complete** — Errors typed, user-visible messages defined, recovery path clear

---

### Mandatory Documentation for lib/[module] Issues

Every new issue that adds code to `lib/[module]` requires these 2 + 1 file structure:

#### File 1: Module README

**Location:** `lib/[module]/README.md` (one file, at module root only)

**Required Sections:**
- [ ] **When to Use This Module** — Suitable vs. unsuitable use cases (1-2 paragraphs)
- [ ] **Architecture & Data Flow** — High-level description (1-2 paragraphs or diagram)
- [ ] **API Reference** — All exports with type signatures + 1-2 usage examples per export
- [ ] **Dependencies** — External packages and internal lib/ dependencies (list)
- [ ] **Error Handling & Edge Cases** — Known limitations, error types, recovery strategies
- [ ] **Performance Notes** — Caching, overhead, optimization tradeoffs
- [ ] **Related Modules** — Links to connected lib/\* modules
- [ ] **File Breakdown** — What each file does (table: Filename | Purpose)
- [ ] **Testing** — Link to test guide if it exists or manual testing tips
- [ ] **Future Enhancements** — Planned improvements or tech debt

**Example location:** `lib/analytics/README.md` (NOT `lib/analytics/consent/README.md`)

#### File 2 + 3: Issue Documentation

**Location:** `docs/issues/MileStone X/Tier Y/NNN - Feature Name/`

**Mandatory File 1: USAGE_GUIDE.md**
- [ ] How to use the feature with 3-5 concrete examples
- [ ] Common patterns and best practices
- [ ] Troubleshooting section (common mistakes + fixes)
- [ ] API reference (what each function/method does, parameters, return values)

**Mandatory File 2: IMPLEMENTATION.md**
- [ ] What files were created or modified (list + brief description)
- [ ] Design decisions and why they were made
- [ ] Architecture diagrams (if non-trivial)
- [ ] Integration points (where code wires in)

**Example issue folder:** `docs/issues/MileStone 2/Tier 6/189 - Advanced Cache Invalidation/`

---

### Optional Documentation

**Create these ONLY if the feature genuinely warrants them** (don't pad unnecessarily):

| File Name | When to Create |
|-----------|----------------|
| `ARCHITECTURE.md` | Feature has non-trivial data flow or system design worth separate explanation |
| `EXAMPLES.md` | Usage Guide would get too long with all examples inline |
| `LIMITS.md` | Feature has important constraints, quotas, or known boundaries |
| `MISSING.md` or `GAPS.md` | Scope was intentionally cut; future dev needs to know what's not done |
| `[FEATURE]_VARIANT_TRACKING.md` | Feature-specific A/B test variant tracking guide |
| Custom guide | Any other module-specific doc that would reduce future developer confusion |

**Rule:** Only create extra files when genuinely useful; never pad the folder.  
**Rule:** Never name any file `README.md` inside an issue folder — that's reserved for module READMEs.

---

### Testing Criteria

#### Unit & Integration Tests (All Issues)

- [ ] Unit tests created for all new public functions/classes
- [ ] Integration tests verify composed features (e.g., cascade + transaction together)
- [ ] All tests pass: `npm run test` (or specific test suite)
- [ ] Test files located in `lib/[module]/__tests__/` folder only
  - ✅ `lib/analytics/__tests__/consent.test.ts`
  - ❌ `lib/analytics/consent.test.ts`
  - ❌ `lib/analytics/consent/__tests__/consent.test.ts`

#### Testing Guide (Only if Visually Testable)

**Create a testing guide ONLY if:**
- Feature has UI components that need to be visually tested
- Feature changes navigation or routing flow
- Feature has real-time observable behavior (something a QA tester can verify by using the app)

**Do NOT create a testing guide for:**
- Pure backend/logic features (cache invalidation, offline queue, persistence logic)
- Features tested entirely by unit/integration tests
- Internal utilities and managers

**If creating a testing guide:**

**Location:** `docs/A Testing Guide/[Feature Name] Testing.md`

**Required Format:**
- [ ] **Test Environment** — Prerequisites, feature flags to enable, data setup
- [ ] **Test Cases** — Minimum 14+ manual test cases (format: checkbox + description + expected behavior + optional screenshot note)
- [ ] **Screenshots** — Mark in test cases where visual validation is needed
- [ ] **Console Logs** — Note expected log output to validate logging is working
- [ ] **Failure Scenarios** — Offline + low battery + high latency behavior

**Example:** `docs/A Testing Guide/Sign In Flow Testing.md` (YES, visible behavior)  
**Counter-example:** `docs/A Testing Guide/Advanced Cache Invalidation Testing.md` (NO, invisible backend logic)

---

### Acceptance Criteria Format

When writing an issue, structure the Acceptance Criteria section like this:

```markdown
## Acceptance Criteria

### Code Quality
- [ ] TypeScript strict (no `any`), ESLint passes
- [ ] No console noise, no hardcoded strings
- [ ] All imports follow architecture boundaries
- [ ] Error handling complete + typed

### Documentation — Mandatory
- [ ] `lib/[module]/README.md` with all required sections
- [ ] `docs/issues/.../USAGE_GUIDE.md` with examples + troubleshooting
- [ ] `docs/issues/.../IMPLEMENTATION.md` with files changed + design decisions

### Documentation — Optional
- [ ] `ARCHITECTURE.md` (if non-trivial data flow)
- [ ] `LIMITS.md` (if constraints/quotas exist)

### Testing
- [ ] Unit tests for all new functions
- [ ] Integration tests for composed features
- [ ] No console errors or warnings
- [ ] `docs/A Testing Guide/[Feature].md` (only if visually testable)
```

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
- **Subheadings** use `##` for section-level, `###` for subsection-level
- **Inline code** for all technical terms (files, types, flags)
- **Specific over vague:** "Queue breadcrumbs to SecureStorage (max 500)" not "Add offline support"
- **Active voice:** "The queue drops oldest events" not "Oldest events are dropped"

---

## Quick Checklist

Use this before submitting an issue:

### ⚠️ Critical Guidelines (Non-Negotiable)

For **all lib/[module] issues**, these are mandatory:

- [ ] **Module README:** One `lib/[module]/README.md` at module root ONLY. Includes all 10 required sections.
- [ ] **Mandatory Docs:** Exactly 2 files in `docs/issues/...` → `USAGE_GUIDE.md` + `IMPLEMENTATION.md`
- [ ] **Optional Docs:** Created ONLY if the feature genuinely warrants them (use the table above for guidance)
- [ ] **Testing Guide:** Created ONLY for visually testable features (UI, navigation, real-time behavior)
- [ ] **Test Files:** ALL tests in `lib/[module]/__tests__/` ONLY. Never scatter like `lib/[module]/auth.test.ts`.

### Issue Structure
- [ ] Header present (Status, Impact, Depends on, Integrates with, Impacts checkboxes)
- [ ] Problem statement has 3-4 specific bullet points + result summary
- [ ] Codebase Status split into "Implemented" and "Gaps" (5-8 gaps is appropriate)
- [ ] Solution describes architecture/pattern + lists out-of-scope items
- [ ] Implementation Tracks section with A-[N] tracks (no Phase 0 in the issue itself)
- [ ] Track 0 included if this is an update/refactor issue
- [ ] Each track has 3-8 specific tasks
- [ ] Each track has ✅ clear Exit criteria
- [ ] Use sub-tracks for large tracks with 2+ independent concerns
- [ ] Final track includes codebase checklist (PII, analytics, centralized systems, etc.)
- [ ] Acceptance Criteria has 4 sections: Code / Docs Mandatory / Docs Optional / Testing

### Content Quality
- [ ] All file paths use backticks (`lib/module/file.ts`)
- [ ] All class/function names use backticks
- [ ] Issue references use #XXX format
- [ ] Code examples are TypeScript (or actual code, not pseudocode)
- [ ] Each track has ✅ Exit criteria
- [ ] Acceptance criteria are measurable and testable
- [ ] Dependencies section explains WHY, not just lists
- [ ] Notes section includes design principles + future work

### Research
- [ ] Read 3+ related source files (actual codebase, not docs)
- [ ] Referenced actual issue numbers (#206, #179, etc.)
- [ ] Checked for existing implementations (not reinventing)
- [ ] Identified actual storage keys/constants used
- [ ] Noted feature flags that might control this

### Pre-Review
- [ ] Searched for similar issues (avoid duplicates)
- [ ] Issue is self-contained (not blocked by unclear dependencies)
- [ ] Tracks are appropriately sized (not 20+ items per track)
- [ ] No track is purely documentation or testing (those are Acceptance Criteria)

---

## Template (Copy-Paste Ready)

```markdown
# Issue #XXX: [Feature Name]

**Type**: Feature Enhancement / Refactor / Bug Fix  
**Milestone**: 2  
**Tier**: 6 (Category)  
**Priority**: Medium  
**Status**: Specification  
**Related**: #190 (Compression), #191 (Revalidation Strategies)

---

## Problem Statement

### Current Gaps

- ❌ [Gap 1]: [Why needed]
- ❌ [Gap 2]: [Why needed]

### User Impact

**Scenario:** [Concrete example of user impact]

**Solution needed:** [1-2 sentence summary of what will fix this]

---

## Solution Architecture

### Pattern/Approach

[1-2 paragraph description of the solution]

### Out of Scope

- [What is NOT being addressed]

---

## Implementation Tracks

### Track A: [Descriptive Title — Commit Message]

**Scope:**
- [ ] [Task 1 with specifics]
- [ ] [Task 2 with file names]

**Files Changed:**
- `lib/module/file.ts` (new)
- `lib/module/index.ts` (updated)

✅ Exit: [What to verify before next track]

---

### Track B+C: [Descriptive Title]

**Scope:**
- [ ] [Task]

✅ Exit: [What to verify]

---

### Track [Final]: Verify PII, Analytics, Centralized Systems

- [ ] **PII Safety** — [Check or N/A]
- [ ] **Analytics Consent** — [Check or N/A]
- [ ] **Storage/Cache Usage** — Using SecureStorage, QueryCache correctly
- [ ] **Network/Jobs** — Using RequestManager, JobQueue as needed
- [ ] **Logging** — Using proper logger categories
- [ ] **Error Handling** — Errors typed, messages user-facing

✅ Exit: All applicable items checked. Skipped items noted.

---

## Acceptance Criteria

### Code Quality
- [ ] TypeScript strict, ESLint passes
- [ ] No console noise, proper imports
- [ ] Error handling complete

### Documentation — Mandatory
- [ ] `lib/[module]/README.md` with 10 required sections
- [ ] `docs/issues/...` folder with USAGE_GUIDE.md + IMPLEMENTATION.md

### Documentation — Optional
- [ ] [Only if feature warrants — list specific files]

### Testing
- [ ] Unit tests + integration tests
- [ ] All tests pass
- [ ] `docs/A Testing Guide/[Feature].md` (only if visually testable)

---

## Dependencies

- #XXX (Feature) — [Why needed]

---

## Notes

- **Design principle:** [Why this approach]
- **Pre-release:** [No backwards compatibility]
```

---

## Further Resources

- **Reference issues:** #189 (Advanced Cache Invalidation), #190 (Compression), #191 (Revalidation) — all follow this new pattern
- **Architecture guide:** `.github/copilot-instructions.md`
- **README style:** `.github/README_STYLE_GUIDE.md` (if exists; otherwise use module README template)
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
