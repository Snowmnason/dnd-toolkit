import { logger } from '@/lib/utils/logger';

/**
 * Deferred invalidation entry.
 */
interface DeferredEntry {
  id: string;
  patterns: string[];
  timeoutId: ReturnType<typeof setTimeout>;
  scheduledAt: number;
  delayMs: number;
}

/**
 * Result of scheduling a deferred invalidation.
 */
export interface DeferredScheduleResult {
  id: string;
  patterns: string[];
  delayMs: number;
  cancelFn: () => boolean;
}

/**
 * Result of executing deferred invalidations.
 */
export interface DeferredExecutionResult {
  invalidatedCount: number;
  errors: { pattern: string; error: Error }[];
}

/**
 * Callback for executing invalidations.
 */
export type DeferredInvalidationExecutor = (patterns: string[]) => Promise<DeferredExecutionResult>;

/**
 * Manages deferred (scheduled) cache invalidations.
 * Allows scheduling invalidations with a delay, useful for debouncing rapid updates.
 */
class DeferredQueueImpl {
  private queue = new Map<string, DeferredEntry>();
  private nextId = 1;

  /**
   * Schedule cache invalidations to execute after a delay.
   * Useful for debouncing rapid updates (e.g., user typing).
   *
   * @param delayMs - Milliseconds to delay before execution
   * @param patterns - Cache key patterns to invalidate
   * @param executor - Callback to execute the actual invalidations
   * @returns Result with ID for cancellation and convenience cancel function
   */
  invalidateAfter(
    delayMs: number,
    patterns: string[],
    executor: DeferredInvalidationExecutor
  ): DeferredScheduleResult {
    // Generate unique ID
    const id = `deferred_${this.nextId++}`;

    // Schedule timeout
    const timeoutId = setTimeout(() => {
      this.executeDeferred(id, patterns, executor);
    }, delayMs);

    // Store entry
    const entry: DeferredEntry = {
      id,
      patterns,
      timeoutId,
      scheduledAt: typeof performance !== 'undefined' ? performance.now() : Date.now(),
      delayMs,
    };

    this.queue.set(id, entry);

    logger.category('storage').debug('Deferred invalidation scheduled', {
      id,
      patterns,
      delayMs,
      queueSize: this.queue.size,
    });

    // Return result with convenience cancel function
    return {
      id,
      patterns,
      delayMs,
      cancelFn: () => this.cancel(id),
    };
  }

  /**
   * Cancel a pending deferred invalidation by ID.
   * Prevents execution if not yet scheduled.
   *
   * @param id - Deferred invalidation ID to cancel
   * @returns true if cancelled, false if already executed or not found
   */
  cancel(id: string): boolean {
    const entry = this.queue.get(id);
    if (!entry) {
      logger.category('storage').debug('Deferred invalidation not found for cancellation', { id });
      return false;
    }

    // Clear the timeout
    clearTimeout(entry.timeoutId);
    this.queue.delete(id);

    logger.category('storage').debug('Deferred invalidation cancelled', {
      id,
      patterns: entry.patterns,
      delayMs: entry.delayMs,
      queueSize: this.queue.size,
    });

    return true;
  }

  /**
   * Get list of pending deferred invalidations (for debugging).
   */
  getPending(): { id: string; patterns: string[]; delayMs: number; age: number }[] {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    return Array.from(this.queue.values()).map((entry) => ({
      id: entry.id,
      patterns: entry.patterns,
      delayMs: entry.delayMs,
      age: now - entry.scheduledAt,
    }));
  }

  /**
   * Cancel all pending deferred invalidations.
   * Used during cleanup (e.g., app shutdown).
   */
  cancelAll(): number {
    const count = this.queue.size;
    for (const entry of this.queue.values()) {
      clearTimeout(entry.timeoutId);
    }
    this.queue.clear();

    if (count > 0) {
      logger.category('storage').debug('All deferred invalidations cancelled', { count });
    }

    return count;
  }

  /**
   * Execute a deferred invalidation.
   * @private
   */
  private async executeDeferred(
    id: string,
    patterns: string[],
    executor: DeferredInvalidationExecutor
  ): Promise<void> {
    try {
      logger.category('storage').debug('Executing deferred invalidation', {
        id,
        patterns,
        queueSize: this.queue.size,
      });

      const result = await executor(patterns);

      logger.category('storage').debug('Deferred invalidation executed', {
        id,
        patterns,
        invalidatedCount: result.invalidatedCount,
        errorCount: result.errors.length,
      });

      if (result.errors.length > 0) {
        logger.category('storage').warn('Deferred invalidation had errors', {
          id,
          patterns,
          errorCount: result.errors.length,
          errors: result.errors.map((e) => ({ pattern: e.pattern, message: e.error.message })),
        });
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.category('storage').error('Fatal error executing deferred invalidation', {
        id,
        patterns,
        error: err.message,
      });
    } finally {
      // Clean up from queue
      this.queue.delete(id);
    }
  }
}

/**
 * Singleton instance of the deferred queue.
 */
export const DeferredQueue = new DeferredQueueImpl();
