import { TransactionCoordinator } from '@/system/Storage';
import { describe, expect, it, vi } from 'vitest';

describe('TransactionCoordinator', () => {
  it('executes transaction and calls executor with queued keys', async () => {
    const entries = new Map<string, unknown>([['a', 1]]);
    const snapshot = { entries, size: 1, timestamp: Date.now() } as any;

    const getSnapshot = () => snapshot;
    const executeInvalidations = vi.fn(async (keys: string[]) => ({ invalidatedCount: keys.length, errors: [] }));
    const restoreSnapshot = vi.fn(async (_s: any) => {});

    const res = await TransactionCoordinator.transaction(async (tx) => {
      tx.invalidate('k1');
      tx.invalidateMany(['k2', 'k3']);
    }, { getSnapshot, executeInvalidations, restoreSnapshot });

    expect(res.success).toBe(true);
    expect(executeInvalidations).toHaveBeenCalled();
    expect(res.invalidatedCount).toBe(3);
  });

  it('restores snapshot when executor fails', async () => {
    const snapshot = { entries: new Map(), size: 0, timestamp: Date.now() } as any;
    const getSnapshot = () => snapshot;
    const executeInvalidations = vi.fn(async (_: string[]) => { throw new Error('exec fail'); });
    const restoreSnapshot = vi.fn(async (_s: any) => {});

    const res = await TransactionCoordinator.transaction(async (tx) => tx.invalidate('k1'), { getSnapshot, executeInvalidations, restoreSnapshot });

    expect(res.success).toBe(false);
    expect(res.snapshotRestored).toBe(true);
    expect(restoreSnapshot).toHaveBeenCalled();
  });
});
