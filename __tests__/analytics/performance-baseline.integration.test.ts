import { computePercentile, performanceBaselineService } from '@/lib/analytics/performance/performance-baseline';
import { describe, expect, it } from 'vitest';

describe('PerformanceBaseline integration', () => {
  it('initializes, records samples, computes percentiles and detects regressions', async () => {
    const label = '__integration_test__';

    // Ensure clean state
    await performanceBaselineService.resetAll();

    // Initialize service
    await performanceBaselineService.initialize();

    // Reduce warmup for faster test via internal data config (test-only access)
    const svcAny = performanceBaselineService as any;
    svcAny.data.config.warmupSamples = 2;
    svcAny.data.config.maxSamplesPerOp = 100;

    // Record ordered samples 1..10 (ms)
    const samples = [1,2,3,4,5,6,7,8,9,10];
    for (const s of samples) {
      performanceBaselineService.recordSample(label, s, { isIdle: false });
    }

    // Retrieve baseline and assert percentiles computed from active samples (skip warmup=2)
    const baseline = performanceBaselineService.getBaseline(label);
    expect(baseline).not.toBeNull();
    if (!baseline) return; // type-narrowing for TS

    const active = samples.slice(svcAny.data.config.warmupSamples).slice().sort((a,b)=>a-b);
    const expectedP50 = computePercentile(active, 50);
    const expectedP95 = computePercentile(active, 95);
    const expectedP99 = computePercentile(active, 99);

    expect(baseline.p50).toBe(expectedP50);
    expect(baseline.p95).toBe(expectedP95);
    expect(baseline.p99).toBe(expectedP99);

    // Detect regression: feed a value much larger than p95
    const large = Math.max( expectedP95 * 2, expectedP95 + 100 );
    const result = performanceBaselineService.detectRegression(label, large, { isIdle: false });
    expect(result.skipped).toBe(false);
    expect(result.isRegression).toBe(true);

    // Idle context should skip detection
    const idleResult = performanceBaselineService.detectRegression(label, large, { isIdle: true });
    expect(idleResult.skipped).toBe(true);
    expect(idleResult.isRegression).toBe(false);

    // Cleanup
    await performanceBaselineService.reset(label);
  });
});
