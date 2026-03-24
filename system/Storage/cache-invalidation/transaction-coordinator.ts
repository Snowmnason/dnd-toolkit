import { logger } from '@/lib/utils/logger';

/**
 * Represents a snapshot of cache state for rollback purposes.
 */
export interface CacheSnapshot {
  /**
   * Snapshot entries as a plain object (JSON-serializable, unlike Map).
   * Keys are cache keys; values are the raw stored entries.
   */
  entries: Record<string, unknown>;
  size: number;
  timestamp: number;
}

/**
 * Transaction context passed to the operation callback.
 * Provides methods to queue invalidations within the transaction.
 */
export interface TransactionContext {
  /**
   * Queue a cache key for invalidation during this transaction.
   * Does not immediately invalidate; collects keys for atomic execution.
   */
  invalidate(key: string): void;

  /**
   * Queue multiple cache keys for invalidation.
   */
  invalidateMany(keys: string[]): void;

  /**
   * Get current queued invalidations for inspection (debugging).
   */
  getQueuedInvalidations(): string[];

  /**
   * Check if a key is queued for invalidation.
   */
  isQueued(key: string): boolean;
}

/**
 * Result of a transaction execution.
 */
export interface TransactionResult {
  success: boolean;
  invalidatedCount: number;
  invalidationErrors: { key: string; error: Error }[];
  snapshotRestored: boolean;
  durationMs: number;
  message?: string;
}

/**
 * Callback for getting current cache snapshot.
 */
export type SnapshotProvider = () => CacheSnapshot;

/**
 * Callback for executing queued invalidations.
 */
export type InvalidationExecutor = (keys: string[]) => Promise<{ invalidatedCount: number; errors: { key: string; error: Error }[] }>;

/**
 * Callback for restoring cache from snapshot.
 */
export type SnapshotRestorer = (snapshot: CacheSnapshot) => Promise<void>;

/**
 * Manages transactional cache invalidations with atomic semantics.
 * Ensures all-or-nothing execution: either all queued invalidations succeed,
 * or the cache is restored to pre-transaction state.
 */
class TransactionCoordinatorImpl {
  /**
   * Execute a transaction with automatic rollback on failure.
   * Takes a snapshot before execution; if the transaction fails, restores the snapshot.
   *
   * @param operation - Async function that receives TransactionContext to queue invalidations
   * @param config - Configuration with snapshot provider, executor, and restorer
   * @returns TransactionResult with success status, metrics, and error details
   */
  async transaction(
    operation: (tx: TransactionContext) => Promise<void>,
    config: {
      getSnapshot: SnapshotProvider;
      executeInvalidations: InvalidationExecutor;
      restoreSnapshot: SnapshotRestorer;
    }
  ): Promise<TransactionResult> {
    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const result: TransactionResult = {
      success: false,
      invalidatedCount: 0,
      invalidationErrors: [],
      snapshotRestored: false,
      durationMs: 0,
    };

    let snapshot: CacheSnapshot | null = null;

    try {
      // Take snapshot before execution
      try {
        snapshot = config.getSnapshot();
        logger.category('storage').debug('Cache snapshot taken', {
          entriesSnapshotted: Object.keys(snapshot.entries).length,
          sizeBytes: snapshot.size,
        });
      } catch (snapshotError) {
        const err = snapshotError instanceof Error ? snapshotError : new Error(String(snapshotError));
        logger.category('storage').error('Failed to capture cache snapshot', {
          error: err.message,
        });
        result.message = `Snapshot failed: ${err.message}`;
        result.durationMs = typeof performance !== 'undefined' ? performance.now() - startTime : Date.now() - startTime;
        return result;
      }

      // Create transaction context
      const queuedKeys = new Set<string>();
      const context: TransactionContext = {
        invalidate: (key: string) => {
          if (key) {
            queuedKeys.add(key);
          }
        },
        invalidateMany: (keys: string[]) => {
          for (const key of keys) {
            if (key) {
              queuedKeys.add(key);
            }
          }
        },
        getQueuedInvalidations: () => Array.from(queuedKeys),
        isQueued: (key: string) => queuedKeys.has(key),
      };

      // Execute user operation
      try {
        await operation(context);
        logger.category('storage').debug('Transaction operation completed', {
          queuedInvalidations: queuedKeys.size,
        });
      } catch (operationError) {
        // Operation error = transaction failed. Restore snapshot immediately,
        // skip queued invalidations to preserve atomic semantics.
        const err = operationError instanceof Error ? operationError : new Error(String(operationError));
        logger.category('storage').warn('Transaction operation threw error, rolling back', {
          error: err.message,
          queuedInvalidations: queuedKeys.size,
        });
        result.message = `Operation failed: ${err.message}`;
        await this.restoreSnapshot(snapshot, config.restoreSnapshot, result);
        result.durationMs = typeof performance !== 'undefined' ? performance.now() - startTime : Date.now() - startTime;
        return result;
      }

      // Execute queued invalidations
      if (queuedKeys.size > 0) {
        try {
          const invalidationResult = await config.executeInvalidations(Array.from(queuedKeys));
          result.invalidatedCount = invalidationResult.invalidatedCount;
          result.invalidationErrors = invalidationResult.errors;

          if (invalidationResult.errors.length === 0) {
            result.success = true;
            logger.category('storage').debug('Transaction invalidations succeeded', {
              invalidatedCount: result.invalidatedCount,
            });
          } else {
            // Partial failure: some invalidations failed
            logger.category('storage').warn('Transaction invalidations partially failed', {
              invalidatedCount: result.invalidatedCount,
              failedCount: invalidationResult.errors.length,
            });
            // Restore snapshot on failure
            await this.restoreSnapshot(snapshot, config.restoreSnapshot, result);
          }
        } catch (invalidationError) {
          const err = invalidationError instanceof Error ? invalidationError : new Error(String(invalidationError));
          logger.category('storage').error('Transaction invalidation execution failed', {
            error: err.message,
            queuedInvalidations: queuedKeys.size,
          });
          result.invalidationErrors.push({ key: '[execution]', error: err });
          // Restore snapshot on error
          await this.restoreSnapshot(snapshot, config.restoreSnapshot, result);
        }
      } else {
        // No invalidations queued
        result.success = true;
        logger.category('storage').debug('Transaction completed with no invalidations queued');
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.category('storage').error('Fatal error in transaction', {
        error: err.message,
      });
      result.message = `Fatal error: ${err.message}`;
      // Attempt rollback
      if (snapshot) {
        await this.restoreSnapshot(snapshot, config.restoreSnapshot, result);
      }
    }

    result.durationMs = typeof performance !== 'undefined' ? performance.now() - startTime : Date.now() - startTime;
    return result;
  }

  /**
   * Restore cache from snapshot.
   * @private
   */
  private async restoreSnapshot(
    snapshot: CacheSnapshot,
    restorer: SnapshotRestorer,
    result: TransactionResult
  ): Promise<void> {
    try {
      await restorer(snapshot);
      result.snapshotRestored = true;
      logger.category('storage').info('Cache snapshot restored after transaction failure', {
        entriesRestored: Object.keys(snapshot.entries).length,
        sizeBytes: snapshot.size,
      });
    } catch (restoreError) {
      const err = restoreError instanceof Error ? restoreError : new Error(String(restoreError));
      logger.category('storage').error('Failed to restore cache snapshot', {
        error: err.message,
      });
      result.snapshotRestored = false;
    }
  }
}

/**
 * Singleton instance of the transaction coordinator.
 */
export const TransactionCoordinator = new TransactionCoordinatorImpl();
