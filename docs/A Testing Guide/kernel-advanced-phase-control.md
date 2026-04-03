# Kernel Advanced Phase Control — Test Guide

## Overview

- **Purpose:** Verify kernel bootstrap phase sequencing, adaptive timeouts, error classification, and graceful degradation during app startup.
- **What we're testing:** phase ordering and dependencies, network multiplier/timeouts, error classification (timeout/unreachable/non-recoverable), phase progress messages, degrade/safe-mode triggers, and registration-phase behavior.

## Environments

- App (Desktop / Mobile / Both)
- Web (browser) — for web-specific timeout/parallelism checks

## Prerequisites

- Test account(s) with basic world access
- Developer/dev-build of the app with debug logging enabled
- Device/emulator with network throttling (or browser DevTools network throttling)
- Access to console logs or remote logging for bootstrap trace output
- `appsettings.dev.json` available (dev multipliers) and ability to toggle kernel config if needed

## How It Works (short)

- The kernel executes a sequenced list of phases. Each phase has a base timeout (baseMs) multiplied by a network multiplier detected during the network phase.
- The dependency graph enforces ordering (e.g., `network` → `services` → `auth` → `featureFlags` → `registration` → `ready`).
- Errors are classified (unreachable, timeout, non-recoverable). Skippable phases degrade; non-recoverable failures should trigger safe mode/crash pathways.
- PHASE_MESSAGES provide user-facing progress text; progress labels use `completed/total` counters.

## Manual Test Checklist

- [ ] Network detection correctly identifies all six network types:
  - cellular-2G, cellular-3G, cellular-4G, wifi-2G, wifi-3G, wifi-4G
  - Steps: Use device/emulator or browser DevTools to throttle network; bootstrap app; inspect bootstrap logs or kernel debug output for detected network type.
  - Expected: Kernel detects an appropriate type and uses corresponding multiplier.

- [ ] Bootstrap on prod-like wifi-4G uses baseline timeouts
  - Steps: Set network to wifi-4G, start app
  - Expected: Services phase timeout ~= configured base (e.g., ~3000ms) and bootstrap completes within expected window.

- [ ] Bootstrap on cellular-4G increases timeout by ~1.5x
  - Steps: Throttle to cellular-4G, start app
  - Expected: Effective timeout ≈ baseMs × 1.5; app either completes or degrades gracefully.

- [ ] Bootstrap on cellular-2G increases timeout significantly (e.g., ×3.5)
  - Steps: Throttle to cellular-2G, start app
  - Expected: Effective timeout ≈ baseMs × 3.5; app should not crash due to multiplier misuse.

- [ ] Simulate network timeout: kernel skips/degrades network-dependent phases
  - Steps: Simulate a network outage or extremely slow connection so network calls time out; observe bootstrap flow
  - Expected: Network phase classified as timeout/unreachable, dependent skippable phases degrade, app still proceeds where allowed.

- [ ] Simulate unreachable network: app falls back to offline mode
  - Steps: Disable network before bootstrap; start app
  - Expected: Kernel recognizes unreachable state; feature flags and services use local fallbacks; app enters offline mode when applicable.

- [ ] Simulate services timeout: services phase marks as skipped/degraded; auth/featureFlags respect fallback rules
  - Steps: Make service endpoints unreachable during services phase
  - Expected: Services phase is logged as degraded; subsequent phases behave with fallbacks and do not crash unless non-recoverable.

- [ ] Simulate storage failure: triggers safe mode / crash pathway
  - Steps: Corrupt or block access to persistent storage during bootstrap
  - Expected: Kernel treats storage failure as critical and surfaces safe-mode UI (or equivalent crash behavior as configured).

- [ ] Verify dependency ordering enforcement
  - Steps: Introduce a fake early-success in dependent phase and verify dependent phases didn't run early
  - Expected: Auth never runs before network; other dependencies respected.

- [ ] featureFlags seeds fallback values when remote provider unavailable
  - Steps: Block featureFlags remote endpoint; bootstrap
  - Expected: App seeds feature flags from local/hardcoded defaults and continues.

- [ ] Error classification correctness
  - Steps: Trigger ENOTFOUND and ETIMEDOUT style errors in network calls during phases
  - Expected: ENOTFOUND → classified as unreachable; ETIMEDOUT → timeout. Kernel decision (skip/crash) follows classifier.

- [ ] Phase progress messages and counters
  - Steps: Bootstrap with logging enabled; capture progress labels shown/logged; ensure `completed/total` values and phase names are correct
  - Expected: Labels show `X/Y <PhaseName>...` with Y == total phases in PHASE_SEQUENCE; percent calculations valid (no NaN).

## How to Record Results

## How to Record Results

- For manual checklist items, mark pass/fail per test case and include:
  - Device / platform
  - Network throttle setting used
  - Screenshots and a copy of bootstrap logs (console)
  - Time measurements for phase timeouts where applicable

- Add passes/failures to `docs/A Testing Guide/TESTING_RESULTS.md` (use the template created earlier).

## Troubleshooting

- If network emulation isn't available on a device, use a browser build + DevTools network throttling.
- If progress percentages show `NaN`, check that the phase label includes the correct `completed/total` values; ensure code builds use the latest `PHASE_SEQUENCE`.
- For flakiness caused by randomness in messages, stub `Math.random()` in unit tests to make message selection deterministic.

## Success Criteria ✅

- Phase baseMs and network multipliers applied correctly across tested network types
- Dependency execution order enforced (network → services → auth → featureFlags → registration)
- Skippable phases degrade gracefully; non-recoverable phases trigger safe-mode/crash behavior per configuration
- PHASE_MESSAGES produce deterministic, user-friendly progress messages in deterministic tests
- Automated unit + integration tests pass on CI (green)

## Related Files

- `system/Kernel/app-kernel.ts`
- `system/Kernel/phase-helpers/phase-error-classifier.ts`
- `system/Kernel/phase-helpers/adaptive-phase-executor.ts`
- `system/Kernel/phase-helpers/phase-dependency-graph.ts`
- `localization/phase-messages.ts`
- `system/Degrade/app-degrade.ts`
- `lib/error/degrade/degrade-manager.ts`

---

If you'd like, I can also add a short test file template for one of the unit tests (e.g., `phase-error-classifier.test.ts`) to get the automated coverage started.