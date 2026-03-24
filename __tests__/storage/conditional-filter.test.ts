import { ConditionalFilter } from '@/system/Storage';
import { describe, expect, it, vi } from 'vitest';

describe('ConditionalFilter', () => {
  it('invalidates keys matching pattern and predicate', async () => {
    const stats = { entries: [{ key: 'world:1' }, { key: 'user:1' }, { key: 'world:2' }] };

    const getCacheStats = () => stats as any;

    const invalidated: string[] = [];
    const invalidate = async (keys: string[]) => {
      invalidated.push(...keys);
      return { invalidatedCount: keys.length, errors: [] };
    };

    const res = await ConditionalFilter.invalidateIfMatches('world:*', (key) => key.startsWith('world'), getCacheStats, invalidate);
    expect(res.scannedCount).toBe(3);
    expect(res.invalidatedCount).toBe(2);
    expect(invalidated).toEqual(expect.arrayContaining(['world:1', 'world:2']));
  });

  it('continues when predicate throws for one entry', async () => {
    const stats = { entries: [{ key: 'k1' }, { key: 'k2' }] };
    const getCacheStats = () => stats as any;
    const invalidate = vi.fn(async (keys: string[]) => ({ invalidatedCount: keys.length, errors: [] }));

    const res = await ConditionalFilter.invalidateIfMatches('*', (k) => { if (k === 'k1') throw new Error('boom'); return true; }, getCacheStats, invalidate);
    expect(res.scannedCount).toBe(2);
    expect(res.errors.length).toBeGreaterThanOrEqual(1);
  });
});
