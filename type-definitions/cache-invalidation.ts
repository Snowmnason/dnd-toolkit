/**
 * Cache Invalidation Type Definitions
 *
 * Shared types for cache invalidation patterns:
 * - Cascading (parent → child dependencies)
 * - Conditional (predicate-based filtering)
 * - Transactional (atomic batch operations)
 * - Deferred (scheduled with debouncing)
 * - LRU eviction (capacity management)
 */

// ===== Cascading Invalidation =====

export interface CascadeMapping {
  parentPattern: string;
  childPatterns: string[];
}

// ===== Conditional Invalidation =====

export interface ConditionalInvalidationResult {
  invalidatedCount: number;
  scannedCount: number;
  errors: { key: string; error: Error }[];
}

export type ConditionalPredicate = (key: string, entry: unknown) => boolean;

// ===== Transactional Invalidation =====

export interface CacheSnapshot {
  entries: Map<string, unknown>;
  size: number;
  timestamp: number;
}

export interface TransactionContext {
  invalidate(key: string): void;
  invalidateMany(keys: string[]): void;
  getQueuedInvalidations(): string[];
  isQueued(key: string): boolean;
}

export interface TransactionResult {
  success: boolean;
  invalidatedCount: number;
  invalidationErrors: { key: string; error: Error }[];
  snapshotRestored: boolean;
  durationMs: number;
  message?: string;
}

// ===== Deferred Invalidation =====

export interface DeferredScheduleResult {
  id: string;
  patterns: string[];
  delayMs: number;
  cancelFn: () => void;
}

export interface DeferredExecutionResult {
  invalidatedCount: number;
  errors: { pattern: string; error: Error }[];
}

// ===== LRU Eviction =====

export interface LRUCapacityConfig {
  hardMaxBytes: number;
  softThreshold: number; // 0.9 = 90%
  targetAfterEviction: number; // 0.7 = 70%
}

export interface LRUEntry {
  key: string;
  sizeBytes: number;
  lastAccessTime: number;
}

export interface EvictionResult {
  evictedCount: number;
  freedBytes: number;
  currentSize: number;
  durationMs: number;
}

// ===== Error Handling =====

export class CacheInvalidationError extends Error {
  constructor(
    public readonly code: 'INVALID_PARAMS' | 'EXECUTION_FAILED' | 'VALIDATION_FAILED',
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'CacheInvalidationError';
  }
}
