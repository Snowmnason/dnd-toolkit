/**
 * Transaction Runner
 *
 * Manages the lifecycle of a single navigation transaction:
 * - Unique transaction ID (UUID)
 * - From/to route tracking
 * - Timeout and cancellation logic
 * - Latency tracking
 *
 * App-agnostic: no hardcoded values, works with any routing system.
 */

/**
 * Generate a UUID v4
 * @returns UUID string
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * NavigationTransactionState - Internal state of a transaction
 */
interface NavigationTransactionState {
  id: string;
  startTimeMs: number;
  fromRoute: string;
  toRoute: string;
  triggeredBy: 'push' | 'replace' | 'back' | 'dismiss' | 'deep-link' | 'url-edit';
  cancelled: boolean;
  cancelReason?: string;
}

/**
 * TransactionRunner - Manages a single navigation transaction lifecycle
 *
 * Tracks timing, cancellation, and metadata throughout the navigation pipeline.
 */
export class TransactionRunner {
  private state: NavigationTransactionState;

  /**
   * Create a new transaction
   * @param fromRoute Starting route
   * @param toRoute Target route
   * @param triggeredBy Source of navigation (push, replace, back, etc.)
   */
  constructor(
    fromRoute: string,
    toRoute: string,
    triggeredBy: 'push' | 'replace' | 'back' | 'dismiss' | 'deep-link' | 'url-edit'
  ) {
    this.state = {
      id: generateUUID(),
      startTimeMs: Date.now(),
      fromRoute,
      toRoute,
      triggeredBy,
      cancelled: false,
    };
  }

  /**
   * Get the transaction ID
   */
  getId(): string {
    return this.state.id;
  }

  /**
   * Get the from route
   */
  getFromRoute(): string {
    return this.state.fromRoute;
  }

  /**
   * Get the to route
   */
  getToRoute(): string {
    return this.state.toRoute;
  }

  /**
   * Get the trigger source
   */
  getTriggeredBy(): 'push' | 'replace' | 'back' | 'dismiss' | 'deep-link' | 'url-edit' {
    return this.state.triggeredBy;
  }

  /**
   * Request cancellation of this transaction
   * @param reason Why the transaction is being cancelled
   * @returns true if cancelled successfully, false if already cancelled
   */
  requestCancellation(reason: string): boolean {
    if (this.state.cancelled) {
      return false;
    }
    this.state.cancelled = true;
    this.state.cancelReason = reason;
    return true;
  }

  /**
   * Check if this transaction has been cancelled
   */
  isCancelled(): boolean {
    return this.state.cancelled;
  }

  /**
   * Get the cancellation reason (if cancelled)
   */
  getCancelReason(): string | undefined {
    return this.state.cancelReason;
  }

  /**
   * Get the elapsed time in milliseconds since transaction start
   */
  getElapsedMs(): number {
    return Date.now() - this.state.startTimeMs;
  }

  /**
   * Create a timeout promise that rejects after `timeoutMs`
   * @param timeoutMs Timeout in milliseconds
   * @returns Promise that rejects if timeout is exceeded
   */
  createTimeoutPromise(timeoutMs: number): Promise<void> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        if (!this.state.cancelled) {
          reject(
            new Error(
              `Navigation transaction ${this.state.id} exceeded timeout of ${timeoutMs}ms`
            )
          );
        }
      }, timeoutMs);
    });
  }

  /**
   * Snapshot the current transaction state for recording
   * @returns Transaction snapshot for audit/analytics
   */
  snapshot() {
    return {
      id: this.state.id,
      fromRoute: this.state.fromRoute,
      toRoute: this.state.toRoute,
      triggeredBy: this.state.triggeredBy,
      cancelled: this.state.cancelled,
      cancelReason: this.state.cancelReason,
      elapsedMs: this.getElapsedMs(),
      timestamp: new Date(),
    };
  }
}
