import { DeferredQueue } from '@/system/Storage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('DeferredQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    DeferredQueue.cancelAll();
  });

  it('schedules and executes deferred invalidation', async () => {
    const executed: string[][] = [];
    const executor = async (patterns: string[]) => {
      executed.push(patterns);
      return { invalidatedCount: patterns.length, errors: [] };
    };

    const scheduled = DeferredQueue.invalidateAfter(100, ['p1', 'p2'], executor);
    expect(typeof scheduled.id).toBe('string');

    // Fast-forward time
    vi.advanceTimersByTime(150);
    // allow pending promises to resolve
    await Promise.resolve();

    expect(executed.length).toBe(1);
    expect(executed[0]).toEqual(['p1', 'p2']);
  });

  it('cancels scheduled invalidation', () => {
    const executor = async (_: string[]) => ({ invalidatedCount: 0, errors: [] });
    const scheduled = DeferredQueue.invalidateAfter(100, ['x'], executor);
    const cancelled = scheduled.cancelFn();
    expect(cancelled).toBe(true);
  });
});
