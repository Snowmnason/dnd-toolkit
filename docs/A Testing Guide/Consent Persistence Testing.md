# Consent Persistence Testing (QA Guide)

This guide covers manual and unit/integration tests for the Analytics Consent feature (persist analytics consent across app restarts).

Quick checklist
- [ ] Default is `basic` on first launch
- [ ] `setLevel()` persists to SecureStorage
- [ ] `initialize()` restores persisted level
- [ ] `isAllowed()` gates analytics categories correctly
- [ ] Storage errors do not crash the app (fallback to `basic`)
- [ ] Settings toggle UI persists change and survives restart

Unit tests (automated)
- See `__tests__/analytics/consent.unit.test.ts` for examples.
- Run single file:

```bash
npx vitest __tests__/analytics/consent.unit.test.ts --run
```

Manual test steps
1. Fresh install (no stored consent)
   - Clear storage key `dnd:analytics:consent` via app debug or device storage
   - Launch app → Expect default consent = `basic`
2. Toggle to `full` in Settings
   - Change consent to `full` via UI toggle
   - Restart app → Expect persisted consent = `full`
3. Toggle back to `basic` and verify buffer behavior
   - Change to `basic` → Confirm buffer clears or gated events stop being emitted
4. Simulate storage failure
   - Mock or force storage write error (platform-specific) → ensure app continues and consent falls back to `basic`

Notes
- The unit tests mock `SecureStorage` and verify that `initialize()` and `setLevel()` behave correctly even when storage fails.
- If you change the storage key name or storage API, update `docs/A Testing Guide/Consent Persistence Testing.md` accordingly.
