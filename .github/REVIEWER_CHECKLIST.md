# Code Review & Correction Process

## Quick Checklist
- [ ] **Step 1:** Apply all corrections from review
- [ ] **Step 2:** Merger check (cross-reference & cascading issues)
- [ ] **Step 3:** Suggest missed improvements
- [ ] **Step 4:** Run validation suite (tests, typecheck, lint, config validator)

---

## Detailed Steps

### Step 1: Apply All Corrections from Review
**Purpose:** Batch all requested fixes together before validation.

- Extract all corrections requested in the review
- Apply fixes to affected files
- Ensure each fix addresses the exact issue raised
- Do NOT run tests yet—batch work first

### Step 2: Merger Check (Cascading Impact)
**Purpose:** Catch integration issues before validation.

When a review requests a correction, verify:

1. **Related files/references:**
   - If fixing a function/export, check all imports and usages
   - If changing schema/types, check dependent code
   - If modifying docs, check cross-references in other docs
   - If renaming things, search for hardcoded strings or comments that reference the old name

2. **Documentation alignment:**
   - Does the correction align with existing README files?
   - Are there related docs in `docs/` that need updates?
   - Do module-level comments reflect the change?

3. **Type safety:**
   - Are TypeScript types consistent after the change?
   - Could the fix introduce type errors elsewhere?

4. **Test impact:**
   - Do existing tests still match the corrected code?
   - Could the fix break test assertions?

### Step 3: Suggest Missed Improvements
**Purpose:** Surface additional improvements the review may have missed.

- Patterns: Similar issues in nearby code that should also be fixed
- Consistency: Code that uses the same pattern but wasn't flagged
- Completeness: Related functionality that should be included
- Documentation: Additional docs that would help context
- Performance/security: Edge cases or optimizations
- Testing: Missing test cases the fix enables

**Output format:** List each suggestion with context and rationale.

### Step 4: Run Validation Suite
**Purpose:** Ensure all corrections work together without breaking existing functionality.

```bash
npm run typecheck                                           # TypeScript type checking
npm run lint                                                # ESLint validation
npm run test                                                # Unit/integration tests
npm run config:validate                                     # Config validation
```

**If any validation fails:**
- Check which file/test failed
- Trace back to the correction that caused it
- Reassess the merger check for that file
- Fix and re-run validation

---

## Key Principles

- **Batch corrections:** Apply all fixes before any validation
- **Unbiased review:** Focus on logical issues, not just the review's scope
- **Cascading awareness:** One fix may impact 3+ files
- **Documentation matters:** Corrections without doc updates are incomplete
- **Single validation pass:** Run all checks together at the end

---

## Anti-Patterns to Avoid

- ❌ Testing after each individual fix (inefficient)
- ❌ Overlooking related files/references (fragmented fixes)
- ❌ Assuming the review caught everything (incomplete corrections)
- ❌ Skipping merger check (hidden integration issues surface later)
- ❌ Document-only changes without code review (or vice versa)

---

### Evolving Review Patterns

- **Privacy & Data Safety:** Watch for logging, telemetry, or error payloads that may expose user data; prefer conservative defaults and explicit opt-ins.
- **Tests & Mocks:** Ensure external services are mocked in tests; add tests for new behavior and edge cases introduced by changes.
- **Docs & Changelogs:** Update module READMEs and the PR summary when behavior or public APIs change so reviewers and stakeholders can triage.
- **Type & API Safety:** Favor explicit types and validate external SDK/API usage; run typecheck immediately after edits.
- **Cross-file Impact:** When modifying exports or shared constants, search for all imports/usages to avoid runtime breakage.
- **Config & Feature Flags:** Verify behavior under both dev and production config variants; mock configs in tests as needed.
- **Error Handling & Sanitization:** Sanitize errors and logs to avoid leaking sensitive values to telemetry or logs.
- **CI Guardrails:** Add deterministic tests or CI checks for recurring issues (schema changes, mapping coverage, config drift).
- **Performance Awareness:** Look for blocking operations or missing awaits that could drop telemetry or delay shutdowns.

_This list is intentionally general and will be extended as recurring patterns are observed in future reviews._

