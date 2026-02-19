# Performance Baseline Testing (QA Guide)

This guide lists tests and checks for the Performance Baseline feature (percentiles, warm-up, idle filtering, storage).

Scope
- Unit tests: percentile accuracy, warm-up behavior, FIFO/sample management
- Integration: recordSample → storage, detectRegression → exporter queue
- E2E: record many samples, trigger regression, verify export

Quick checklist
- [ ] Percentile computation (nearest-rank) — p50, p95, p99
- [ ] Warm-up skips first N non-idle samples
- [ ] Idle samples excluded from baseline
- [ ] FIFO drops oldest when buffer > maxSamples
- [ ] Regression detection compares to p95 + threshold
- [ ] Offline regression events queued and flushed when online
- [ ] SecureStorage persists baselines and recovers corrupted data

Notes
- The unit tests in `__tests__/analytics/performance-baseline.unit.test.ts` are useful reference implementations for percentile and sample handling.
- The integration test scaffold will attempt to import `lib/analytics/performance-baseline` if present; if not, it is a no-op.

How to run
Run the full test suite with Vitest:

```bash
npx vitest --run
```

Acceptance
- Tests verify percentiles, warm-up, idle filtering, and storage behavior as listed above.
