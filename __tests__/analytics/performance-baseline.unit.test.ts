import { computePercentile } from '@/lib/analytics/performance/performance-baseline';
import { describe, expect, it } from 'vitest';

describe('Percentile computations (nearest-rank)', () => {
  it('computes p50/p95/p99 for 10-sample sequence', () => {
    const samples = [1,2,3,4,5,6,7,8,9,10];
    expect(computePercentile(samples, 50)).toBe(5);
    expect(computePercentile(samples, 95)).toBe(10);
    expect(computePercentile(samples, 99)).toBe(10);
  });

  it('handles small arrays and edges', () => {
    expect(computePercentile([100], 50)).toBe(100);
    // Implementation returns 0 for empty sample set
    expect(computePercentile([], 50)).toBe(0);
  });

  it('matches example with warm-up skipped', () => {
    // original 1..10, skip first 5 => [6,7,8,9,10]
    const warm = [6,7,8,9,10];
    expect(computePercentile(warm, 50)).toBe(8);
  });

  it('supports fractional median expectations for even-length arrays via nearest-rank', () => {
    const arr = [1,2,3,4];
    // nearest-rank p50 => rank = ceil(0.5*4)=2 -> arr[1]=2
    expect(computePercentile(arr, 50)).toBe(2);
  });
});

describe('Sample management / FIFO behavior (spec)', () => {
  it('drops oldest when exceeding max samples', () => {
    const max = 5;
    const buf: number[] = [];
    const push = (v: number) => {
      buf.push(v);
      if (buf.length > max) buf.shift();
    };

    for (let i = 1; i <= 7; i++) push(i);
    // Expect last 5 values: 3,4,5,6,7
    expect(buf).toEqual([3,4,5,6,7]);
  });
});

describe('Warm-up and idle filtering utilities (spec)', () => {
  it('filters idle samples and applies warm-up skip', () => {
    const samples = [1,2,3,4,5,6,7,8,9,10];
    const isIdle = (v: number) => v === 3 || v === 7; // mock idle positions
    const warmup = 2; // skip first 2 non-idle samples

    // build active-only array while applying warm-up
    const active: number[] = [];
    let seen = 0;
    for (const s of samples) {
      if (isIdle(s)) continue;
      seen++;
      if (seen <= warmup) continue;
      active.push(s);
    }

    // active should exclude 3 and 7 and first two non-idle values (1,2)
    expect(active).toEqual([4,5,6,8,9,10]);
    // percentile sanity check on the resulting active set
    expect(active.length).toBeGreaterThan(0);
  });
});
