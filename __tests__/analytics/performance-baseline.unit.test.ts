import { describe, expect, it } from 'vitest';

// Local helper: nearest-rank percentile (matches design doc)
function nearestRankPercentile(samples: number[], percentile: number) {
  if (!Array.isArray(samples) || samples.length === 0) return NaN;
  const arr = samples.slice().sort((a, b) => a - b);
  const n = arr.length;
  const rank = Math.ceil((percentile / 100) * n);
  return arr[Math.max(0, Math.min(rank - 1, n - 1))];
}

describe('Percentile computations (nearest-rank)', () => {
  it('computes p50/p95/p99 for 10-sample sequence', () => {
    const samples = [1,2,3,4,5,6,7,8,9,10];
    expect(nearestRankPercentile(samples, 50)).toBe(5);
    expect(nearestRankPercentile(samples, 95)).toBe(10);
    expect(nearestRankPercentile(samples, 99)).toBe(10);
  });

  it('handles small arrays and edges', () => {
    expect(nearestRankPercentile([100], 50)).toBe(100);
    expect(Number.isNaN(nearestRankPercentile([], 50))).toBe(true);
  });

  it('matches example with warm-up skipped', () => {
    // original 1..10, skip first 5 => [6,7,8,9,10]
    const warm = [6,7,8,9,10];
    expect(nearestRankPercentile(warm, 50)).toBe(8);
  });

  it('supports fractional median expectations for even-length arrays via nearest-rank', () => {
    const arr = [1,2,3,4];
    // nearest-rank p50 => rank = ceil(0.5*4)=2 -> arr[1]=2
    expect(nearestRankPercentile(arr, 50)).toBe(2);
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
