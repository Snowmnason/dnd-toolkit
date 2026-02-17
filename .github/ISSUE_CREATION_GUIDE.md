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
7. [Phase 1a/1b/1c: Implementation](#phase-1a1b1c-implementation)
8. [Phase 2: Documentation](#phase-2-documentation)
9. [Phase 3: Usage Guides](#phase-3-usage-guides)
10. [Phase 4: Testing](#phase-4-testing)
11. [Acceptance Criteria](#acceptance-criteria)
12. [Dependencies & Notes](#dependencies--notes)
13. [Research Tips](#research-tips)
14. [Writing Style](#writing-style)
15. [Quick Checklist](#quick-checklist)

---

## Overview

### 5-Phase Methodology

Each comprehensive issue follows a 5-phase structure:

| Phase | Purpose | Scope | Deliverable |
|-------|---------|-------|-------------|
| **Phase 0** | Understanding & Planning | Discussion, clarifying questions, draft PR body | Shared understanding of scope |
| **Phase 1a/1b/1c** | Implementation | Core feature, split into 3 focused sub-phases | Working code with <10-word commit titles |
| **Phase 2** | Documentation | Module README, API reference, architecture | lib/[module]/README.md |
| **Phase 3** | Guides & Testing | Usage guide, test guide with manual cases | docs/issues/MileStone/... |
| **Phase 4** | Testing | Unit, integration, E2E, stress tests | Test coverage verified |

### Why This Structure?

- **Phase 0:** Ensures both developer and user understand scope before code starts (prevents rework)
- **Phase 1a/1b/1c:** Splits large features into logically independent parts (easier review, smaller PRs)
- **Phase 2:** Ensures API is documented as it's built (not retrofit)
- **Phase 3:** Creates reusable guides for future developers
- **Phase 4:** Guarantees quality (unit + integration + E2E + stress)

---

## Issue Header

Start every issue with a header block:

```markdown
# Issue #XXX: [Feature Name]

**Status:** Tier 4 (Category)  
**Impact:** LARGE / MEDIUM / SMALL — [1-2 sentence impact summary]  
**Depends on:** #ABC (Feature X), #DEF (Feature Y)  
**Integrates with:** `lib/module`, `lib/other-module`, Component/Hook name, Feature flags

## Problem
...
```

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

```markdown
## Problem

[Current broken behavior with 2-3 concrete examples]

- **Issue 1** — What's missing or wrong
- **Issue 2** — Consequence of issue 1
- **Issue 3** — Real-world impact on users/developers

Result: [1-2 sentence summary of impact]
```

### Example

```markdown
## Problem

Analytics consent is reset on app restart:

- **Lost consent** — User opts into 'full' tracking → app restarts → consent resets to 'basic'
- **Friction & friction** — Users must re-consent every session (poor UX)
- **GDPR risk** — Without persistent consent, tracking may not be legally compliant
- **Silent tracking** — App may emit events without user's current consent level

Result: Consent is not reliably persisted, creating compliance risk and UX friction.
```

### Problem Writing Tips

- **Be specific:** "Consent is lost" is vague; "consent resets from 'full' to 'basic'" is concrete
- **Lead with user impact:** GDPR risk → UX friction → operational issue
- **Use bullet points:** Easy to scan, easy to verify as complete
- **End with business impact:** Why should this issue be prioritized?

---

## Codebase Status

**Goal:** Show what exists and what's missing, grounded in actual code.

### Format

```markdown
## Codebase Status

**Currently Implemented:**
- ✅ [Module/file] — [What it does, why it's relevant]
- ✅ [Earlier issue] implementation — [Key classes/functions]

**Gap Analysis:**
- ⚠️ **[Missing piece 1]** — [Why needed, impact]
- ⚠️ **[Missing piece 2]** — [Example: no API exists, code tightly coupled]
- ⚠️ **[Missing piece 3]** — [Volume of work: "No README", "No test guide"]
```

### Example

```markdown
## Codebase Status

**Currently Implemented:**
- ✅ `lib/offline/mutation-queue.ts` — Offline queue pattern (FIFO, SecureStorage, retry backoff)
- ✅ `lib/network/network-detection.ts` — Online/offline detection
- ✅ #70 implementation — Analytics Buffer exists

**Gap Analysis:**
- ⚠️ **No Sentry breadcrumb persistence** — Breadcrumbs lost when app restarts
- ⚠️ **No integration with Sentry transport** — Queue exists but doesn't sync with Sentry
- ⚠️ **No README** for offline Sentry module
```

### Gap Analysis Best Practices

- **Research first:** Read 2-3 relevant files to understand current state
- **Be specific:** "No persistence" is vague; "Breadcrumbs stored in memory only" is concrete
- **List volume:** "No README" is one issue, "No integration with #70" is another
- **Count gaps:** 5-8 gaps is appropriate; more = the issue is too large
- **Reference code:** Use actual filenames and class names

---

## Solution & Phases

**Goal:** Show how to fix the problem, broken into phases.

### Format

```markdown
## Solution

[1-2 sentence summary: what will be built]

1. **Phase 0** — Understand scope and draft PR body
2. **Phase 1a** — [Specific sub-feature]
3. **Phase 1b** — [Next sub-feature, builds on 1a]
4. **Phase 1c** — [Final sub-feature, completes core]
5. **Phase 2** — Documentation
6. **Phase 3** — Usage guides
7. **Phase 4** — Testing

---

## Phase 0: Understand scope and draft PR body

[See Phase 0 section below]

---

## Phase 1a: [Specific title]

[See Phase 1a section below]

... (1b, 1c follow)
```

### Solution Tips

- **Lead with big picture:** One sentence saying what architecture/pattern you're using
- **3 sub-phases:** Break Phase 1 into a, b, c (manageable 1-2 week chunks)
- **Sub-phase progression:** Each builds on previous (1b uses output of 1a, etc.)
- **Phase names are commit titles:** "Implement percentile computation and regression detection" NOT "Phase 1b: Implement..."

---

## Phase 0: Discussion

**Goal:** Ensure developer and stakeholder agree on scope BEFORE any code is written.

### Format

```markdown
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

\`\`\`markdown
## [Feature Name] #XXX

[1-2 line summary]

### Features
- [Feature 1]
- [Feature 2]

### Key Decisions
- [Design decision 1]
- [Design decision 2]

### Phases
- Phase 1a: [What's built]
- Phase 1b: [What's built]
- Phase 1c: [What's built]
- Phase 2-4: [Docs, tests]

### Success Criteria
- [Criterion 1]
- [Criterion 2]
\`\`\`
```

### Phase 0 Tips

- **5 Key Questions:** Tailor each to the specific issue (not generic)
- **Edge cases:** List 5-8 realistic edge cases (app crash, quota exceeded, platform differences, etc.)
- **Draft PR body:** This is reference documentation (NOT a GitHub PR yet); it's a shared understanding
- **Clear acceptance criteria:** Make sure 3-5 success criteria are non-ambiguous

### Example Key Questions (per issue type)

**For persistence features (#181 consent):**
- What if storage is full? — Drop? Block?
- How to recover from corruption? — Validate on load, migrate if needed?
- First-time user defaults? — GDPR-safe 'basic' or ask?

**For queueing features (#70 analytics buffer):**
- Max queue size? — How many events before dropping?
- Retry strategy? — Exponential backoff or fixed delays?
- Deduplication? — How to prevent duplicate events?

**For multi-backend features (#178 exporters):**
- Error isolation? — One exporter fails, should others run?
- Async or sync? — Block dispatch or non-blocking?
- Feature flag control? — How to enable/disable per exporter?

---

## Phase 1a/1b/1c: Implementation

**Goal:** Detailed implementation guidance for 3 focused sub-phases.

### Format for Each Phase

```markdown
## Phase 1a: [Specific title]

**Scope:**
- [ ] Create `lib/module/file.ts`:
  - [Interface/type definition]
  - [Class with methods]
  - [Helper functions]
  - [Error handling approach]
  - [Config via appsettings]

- [ ] [Specific second task]
  - Implementation details
  - Integration point
  
- [ ] [Third task if needed]

**Verification only (no server changes yet):**
- [What to verify before moving to Phase 1b]

---

## Phase 1b: [Next logical feature]

**Scope:**
- [ ] [Task 1 with details]
- [ ] [Task 2]

**Testing (Phase 4):**
- [Early testing hints to keep in mind]

---

## Phase 1c: [Final sub-phase]

**Scope:**
- [ ] [Summary scope]

**Testing (Phase 4):**
- [Verification points]
```

### Implementation Phase Tips

- **Be VERY specific:** Include example TypeScript interfaces, method signatures
- **Sub-phase independence:** Each can be code-reviewed separately
- **Testing hints:** Add what to test for each sub-phase (full tests in Phase 4)
- **Configuration:** Show appsettings config JSON
- **Integration:** Mention how this connects to other systems (#70, #208, etc.)
- **Commit titles:** Phase headers ARE commit titles (no "Commit title:" prefix)

### Example Scope Item (Detailed)

```markdown
- [ ] Create `lib/analytics/performance-baseline.ts`:
  - `OperationBaseline` type:
    ```typescript
    {
      label: string;
      p50: number;
      p95: number;
      p99: number;
      lastUpdated: number;
      version: number;
    }
    ```
  - `PerformanceBaselineService` class:
    - `initialize()` → Load from SecureStorage
    - `recordSample(label, duration)` → Add + persist
    - `getBaseline(label)` → Return p50/p95/p99
  - Storage key: `dnd:performance:baselines` (use STORAGE_KEYS)
  - Validation: Ensure p50 ≤ p95 ≤ p99
```

---

## Phase 2: Documentation

**Goal:** Module README documenting architecture, API, integration points.

### Format

```markdown
## Phase 2: Create lib/[module]/README.md

**Scope:**

**Create or update `lib/[module]/README.md`:**
- [ ] "When to use" section (suitable vs unsuitable use cases)
- [ ] Architecture diagram or flow chart
- [ ] API reference:
  - All public functions/classes
  - Type signatures
  - Inline code examples
- [ ] Integration points (modules this depends on, systems this plugs into)
- [ ] Error handling guide
- [ ] Performance notes (if applicable)
- [ ] Future enhancements section
- [ ] Related modules
```

### Phase 2 Tips

- **Focus on developer experience:** This is for FUTURE developers using this module
- **Code examples:** Show common usage patterns (best case, error case)
- **Architecture diagrams:** ASCII or brief mermaid (help visualize data flow)
- **Don't document implementation:** Document the API and intent, not internal details
- **Link to other modules:** Make it easy to discover related functionality

### Example README Structure

```markdown
# Performance Baseline Module

## When to Use This Module

Use this module when you need to:
- Track performance metrics over time
- Detect regressions (e.g., screen got 20% slower)
- Monitor baselines (p50, p95, p99 percentiles)

Do NOT use this module for:
- Real-time dashboards (use raw metrics instead)
- Single-sample measurements (need historical context)

## Architecture

recordSample(duration) → update percentiles → compare to baseline → emit regression event

## API Reference

### recordSample(label: string, durationMs: number): void
Add a measurement to baseline for named operation.

```
const baseline = new PerformanceBaselineService();
baseline.recordSample('screen-load', 500);
```

## Integration Points

- #70 (Analytics Buffer) — Queue regression events offline
- #178 (Custom Exporters) — Export regression to backend
- #208 (Network Telemetry) — Log via category('performance')
```

---

## Phase 3: Usage Guides

**Goal:** Real-world integration guide + test guide for manual testing.

### Format

```markdown
## Phase 3: Create usage guide and test guide

**Scope:**

**Create `docs/issues/MileStone X/XXX - [Feature]/USAGE_GUIDE.md`:**
- [ ] Integration checklist (step-by-step how to add to app)
- [ ] Code examples (all common use cases)
- [ ] Common patterns (recommended ways to use)
- [ ] Debugging section (how to identify issues)
- [ ] Troubleshooting (common problems + solutions)

**Create `docs/A Testing Guide/[Feature] Testing.md`:**
- [ ] Manual test cases (14+ cases with detailed steps)
- [ ] Test data setup (mocks, fixtures)
- [ ] Platform testing notes (web/iOS/Android variations)
- [ ] Success criteria (how to know tests passed)
```

### Phase 3 Tips

- **Integration checklist:** Step-by-step ([ ] for each step), not prose
- **Code examples:** Minimal but complete (copy-paste ready)
- **Test cases:** Format:
  ```markdown
  - [ ] Case: [What is being tested]
    - Setup: [Prerequisites]
    - Steps: 1. ... 2. ... 3. ...
    - Expected: [What should happen]
    - Platform: web, iOS, Android (list applicable)
  ```
- **14+ test cases:** Covers happy path, errors, edge cases, offline scenarios
- **Success criteria:** Quantifiable (not "seems good", but "100% events delivered")

### Example Test Case

```markdown
- [ ] Breadcrumb offline → queued to SecureStorage
  - Setup: AnalyticsConsent initialized, network offline
  - Steps:
    1. Call Sentry.addBreadcrumb({message: 'test'})
    2. Verify SecureStorage has `dnd:sentry:breadcrumb_queue`
    3. Check queue contains 1 breadcrumb with correct message
  - Expected: Breadcrumb persisted, Sentry not called (offline)
  - Platform: web, iOS, Android
```

---

## Phase 4: Testing

**Goal:** Comprehensive test coverage (unit, integration, E2E, stress).

### Format

```markdown
## Phase 4: Comprehensive tests

**Scope:**
- [ ] Unit tests (`lib/module/file.test.ts`):
  - [10-15 test cases covering core functionality]
  - [Edge cases]
  - [Validation]

- [ ] Integration tests:
  - [Multi-component interaction]
  - [With other tier 4 features]
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
```

### Phase 4 Tips

- **Unit tests:** Focus on individual functions/methods; mock dependencies
- **Integration tests:** Combine multiple modules; test real interactions
- **E2E tests:** Full workflow (e.g., record sample → restart app → baseline restored)
- **Stress tests:** Ensure no unbounded growth, handles 100x normal load
- **Lint check:** Must pass `npm run lint` (no Type errors)

---

## Acceptance Criteria

**Goal:** Measurable, verifiable criteria for each phase.

### Format

```markdown
## Acceptance Criteria

**Phase 1a (Queue Structure):**
- [ ] Queue persists to SecureStorage
- [ ] FIFO overflow drops oldest (max 100)
- [ ] Validation prevents corrupted data
- [ ] Storage key uses STORAGE_KEYS constant

**Phase 1b (Integration):**
- [ ] NetworkDetection triggers flush on online
- [ ] Batch size respected (25 per request)
- [ ] Non-blocking (async)
- [ ] Success (200-299): Events removed
- [ ] Failure (5xx): Events stay in queue

**Phase 1c (Retry Logic):**
- [ ] Exponential backoff (1s, 2s, 4s, 8s, 16s)
- [ ] Max retries = 5; exceeds = discard
- [ ] Logging works

**Phase 2 (README):**
- [ ] README.md created
- [ ] Architecture diagram included
- [ ] API reference complete
- [ ] Examples provided

**Phase 3 (Guides):**
- [ ] USAGE_GUIDE.md created
- [ ] Testing.md created
- [ ] 14+ test cases documented
- [ ] Success criteria quantified

**Phase 4 (Tests):**
- [ ] Unit tests: 80%+ coverage
- [ ] Integration tests passing
- [ ] E2E test passing
- [ ] Lint and typecheck passing
```

### Acceptance Criteria Tips

- **Per-phase:** Each phase has its own criteria
- **Measurable:** Use specific numbers (100 events, 5 retries, <10ms latency)
- **Verifiable:** Each criterion can be checked (not subjective)
- **Checkboxes:** Format as `- [ ]` for tracking

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

## Research Tips

### Files to Read Before Writing Issue

1. **Related implementation files:**
   ```
   lib/offline/mutation-queue.ts (if queueing feature)
   lib/network/network-detection.ts (if network-dependent)
   lib/storage/SecureStorage.ts (if persistence needed)
   lib/analytics/ (if analytics-related)
   ```

2. **Previous Tier issues (to understand patterns):**
   - Tier 3 issues #054-#228 (feature flags system)
   - Tier 4 issues #206-#181 (offline & analytics)

3. **Dependencies:**
   - Check if feature flags exist (`lib/feature-flags.ts`)
   - Check storage layer (`lib/storage/index.ts` for STORAGE_KEYS)
   - Check logging (`lib/utils/logger.ts` for categories)

### Genealogy Search

```bash
# Find existing references to feature
grep -r "breadcrumb" lib/  # Find Sentry-related code
grep -r "SecureStorage" lib/ # Find persistence patterns
grep -r "NetworkDetection" lib/ # Find network-dependent code

# Check recent changes
git log --oneline lib/analytics/ | head -20
git log --oneline docs/issues/
```

### Gap Analysis Research Strategy

1. **Search for related code:** Is there 50% of what we need already?
2. **Check tests:** Do tests exist? If not, feature likely not complete
3. **Check README:** If no lib/module/README.md, API is likely undocumented
4. **Check coverage:** Missing test guide? Missing usage guide? = gaps
5. **Check integration:** Is this connected to other modules or standalone?

---

## Writing Style

### Tone & Voice

- **Technical but accessible:** Write for engineers who know the codebase
- **Specific over vague:** "Queue breadcrumbs to SecureStorage" not "Add offline support"
- **Active voice:** "The queue drops oldest events" not "Oldest events are dropped"
- **Concrete examples:** Show TypeScript, not pseudocode (where possible)

### Formatting Conventions

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

### Section Conventions

- **Phase headers** are commit titles: "Create queue structure" not "Phase 1a: Create..."
- **Checkboxes** for all task lists: `- [ ] Task name`
- **Subheadings** use ## for phase-level, ### for task-level
- **Inline code** for all technical terms (files, types, flags)
- **Links** to related resources: `(see #206 offline queue pattern)`

### Length Guidelines

| Section | Target length | Why |
|---------|---------------|-----|
| Problem | 150-250 words | Specific, grounded (not too abstract) |
| Codebase Status | 100-200 words | Quick scan of current state |
| Phase 0 | 300-400 words | Sets up discussion, prevents rework |
| Phase 1a | 500-700 words | Detailed implementation guidance |
| Phase 1b | 400-600 words | Builds on Phase 1a, adds specifics |
| Phase 1c | 400-600 words | Completes core feature |
| Phase 2 | 500-800 words | Comprehensive API docs |
| Phase 3 | 1000-1500 words | Usage guide + test guide both included |
| Phase 4 | 600-900 words | Test coverage details |
| **Total** | **4000-6000 words** | Comprehensive but focused |

### Specificity Examples

| ❌ Vague | ✅ Specific |
|----------|----------|
| "Add offline support" | "Queue analytics events when offline, flush when online via #206 queue pattern" |
| "Improve performance" | "Compute p50/p95/p99 percentiles, detect regression if current > p95 + 20%" |
| "Handle errors" | "Corrupted consent: validate on load, migrate schema, fallback to default 'basic'" |
| "Make it work offline" | "Breadcrumbs queued to SecureStorage (max 500), synced via Sentry transport when online" |

---

## Quick Checklist

Use this before submitting an issue:

### Issue Structure
- [ ] Header present (Status, Impact, Depends on, Integrates with)
- [ ] Problem statement has 3-4 bullet points
- [ ] Codebase Status split into "Implemented" and "Gaps"
- [ ] 5-7 phases listed (0, 1a, 1b, 1c, 2, 3, 4)
- [ ] Phase 0 has 5 Key Questions
- [ ] Phases 1a/1b/1c each have detailed Scope
- [ ] Phase 2 is README creation
- [ ] Phase 3 is USAGE_GUIDE + Testing.md
- [ ] Phase 4 is comprehensive tests

### Content Quality
- [ ] All file paths use backticks (`lib/module/file.ts`)
- [ ] All class/function names use backticks
- [ ] Issue references use #XXX format
- [ ] Code examples are TypeScript (not pseudocode)
- [ ] Each phase has verification or testing hints
- [ ] Acceptance criteria are per-phase and measurable
- [ ] Dependencies section explains WHY, not just lists
- [ ] Notes section includes design principles + future work

### Research
- [ ] Read 3+ related source files (actual codebase)
- [ ] Referenced actual issue numbers (#206, #179)
- [ ] Checked for existing implementations (not reinventing)
- [ ] Identified actual storage keys/constants used
- [ ] Noted feature flags that might control this

### Writing
- [ ] 4000-6000 words total (comprehensive but focused)
- [ ] No jargon without explanation
- [ ] Specific examples (not generic "this will improve...")
- [ ] Active voice mostly (not passive)
- [ ] Bold for key terms, code formatting for technical terms
- [ ] Emoji and exclamation points avoided (professional tone)

### Phase 0 Specific
- [ ] 5 Key Questions tailored to THIS issue (not generic)
- [ ] 5-8 edge cases listed
- [ ] Draft PR body included (markdown code block)
- [ ] Draft body includes: Features, Key Decisions, Phases, Success Criteria

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
2. **Phase 1a** — [Core feature 1]
3. **Phase 1b** — [Core feature 2]
4. **Phase 1c** — [Core feature 3]
5. **Phase 2** — Documentation
6. **Phase 3** — Guides
7. **Phase 4** — Testing

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

### Phases
- Phase 1a: [What]
- Phase 1b: [What]
- Phase 1c: [What]
- Phase 2-4: [Coverage]

### Success Criteria
- [Criterion 1]
\`\`\`

---

## Phase 1a: [Title]

**Scope:**
- [ ] [Task with details]

**Verification only:**
- [What to verify]

---

## Phase 1b: [Title]

**Scope:**
- [ ] [Task]

---

## Phase 1c: [Title]

**Scope:**
- [ ] [Task]

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

**Phase 1a:**
- [ ] [Criterion 1]

**Phase 1b:**
- [ ] [Criterion 1]

**Phase 1c:**
- [ ] [Criterion 1]

**Phase 2-4:**
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

**Happy issue writing! 🚀**
