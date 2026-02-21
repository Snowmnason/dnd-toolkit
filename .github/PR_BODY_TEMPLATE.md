# PR Body Template & Examples

**Purpose:** Standardized PR body format for all Tier 4 (and complex) issues.  
**Use this as:** Copy-paste template when opening a PR on GitHub.  
**Reference:** Issues that follow phases 1a/1b/1c should have a PR body in `docs/issues.md` ready to paste.

---

## Structure

Every PR body should include:

1. **Summary** — 2-3 lines: what changed and why
2. **What changed** — Bullet list of files/modules touched
3. **Goals & Rationale** — Brief explanation of design decisions
4. **Key behaviors** — Bullet list of what the feature does
5. **Files touched (high-level)** — Quick reference with file purpose
8. **How to validate quickly** — 3-5 manual steps to smoke-test
9. **Notes / Follow-ups** — What's pending for future PRs
10. **Status** — Current implementation phase completion

---

## Template (Copy & Paste)

```markdown
## [Issue #XXX: Feature Name]

**Summary**
[2-3 sentence description of what this PR does and why]

**What changed (high-level)**
- Generic module(s): `lib/<module>/...` (core logic, provider-agnostic where applicable)
- Interface/adapter: `lib/<module>/interfaces|adapters/...` (abstract types)
- Provider-specific implementation (if applicable): `lib/<module>/<provider>/...` (isolated)
- Config schema/loader updates: `lib/config/...` (update schema when adding config)
- Config files: `config/<file>.json` (update both prod and dev variants when applicable)
- Hooks/UX: `hooks/<module>/...` (optional debug/status hooks)

**Goals & Rationale**
- Keep core logic provider-agnostic and isolate provider-specific code in its own folder
- Respect provider constraints (rate limits, backoff, retries) where relevant
- Make behavior configurable via `appsettings` with sensible fallbacks
- Persist critical state with encrypted storage so behavior survives restarts

**Key behaviors (if applicable)**
- FIFO queue with overflow handling (drop oldest when exceeding configured threshold)
- Deduplication via client-side fingerprint or idempotency keys
- Batch delivery with spacing to avoid rate limits
- Provider responses classified as: success, retry (with backoff/Retry-After), or discard
- Auto-flush on network transition (online/offline) with debounce

**Files touched (examples — adapt to your change)**
- `lib/<module>/...` — Core module logic and public API
- `lib/<module>/adapters/...` — Provider-specific transport and mapping (isolated)
- `lib/config/...` — Loader/schema changes for new config keys
- `config/<file>.json` & `config/<file>.dev.json` — Prod/dev settings (keep in sync)
- `hooks/<module>/use-<feature>-status.ts` — Optional debug hook

**Notes / Follow-ups**
- Docs: Add `lib/<module>/README.md`, usage & implementation guides if feature is new
- Tests: Unit/integration/E2E suites (add after Phase 1 as Phase 4 work)

**Status**
All Phase 1 code (1a/1b/1c) implemented and type-checked (adjust as appropriate). Documentation and tests may follow in subsequent PRs.

---

## Best Practices

✅ **Do:**
- Keep summary to 2-3 lines (easy to scan)
- Include both `appsettings.json` AND `appsettings.dev.json` if config changes
- List specific files with purpose (not vague "multiple files")
- Provide copy-paste verification commands (typecheck, lint, specific tests)
- Be explicit about what's pending (tests, docs) and why
- Include quick validation steps (users, reviewers can smoke-test immediately)

❌ **Don't:**
- Write 10+ lines in summary (move detail to sections)
- Mention only one appsettings file (both must stay in sync)
- Say "See implementation" without specifying files
- Make verification commands ambiguous (`npm test` might run 100 tests)
- Leave "TODO" without explaining what and when

---

## When to Use This Template

- All Tier 4 multi-phase issues (Phases 1a/1b/1c → Phase 2/3/4)
- Any PR involving config changes (appsettings)
- Any PR involving storage/migration/PII
- Any PR integrating multiple modules

---

## Checklist for PR Authors

Before opening a PR on GitHub:

- [ ] Update both appsettings.json AND appsettings.dev.json (if config changes)
- [ ] Update lib/config/loader.ts schema (if config changes)
- [ ] Update config test (`__tests__/config/loader-integration.test.ts`)
- [ ] Run `npm run typecheck` locally
- [ ] Run `npm run lint` locally
- [ ] Copy PR body from `docs/issues.md` (already drafted in Phase 0)
- [ ] Personalize template for this specific feature (don't leave generic placeholders)
- [ ] Include 5+ manual validation steps (help reviewers)
- [ ] List what's pending (tests, docs, platforms) and when
