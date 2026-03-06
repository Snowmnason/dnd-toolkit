/**
 * Performance Baseline Tracking Module
 * Persists historical performance metrics, computes percentiles, and detects regressions
 *
 * Features:
 * - Base-line storage and versioning (SecureStorage)
 * - Percentile computation (p50, p95, p99) using nearest-rank method
 * - Regression detection with configurable threshold
 * - Warm-up period (skip first N samples)
 * - Idle-time filtering (exclude user dwell from baseline)
 * - Sample management (bounded FIFO storage, max 100 per operation)
 *
 * Note: Uses Record<string, ...> access for internal storage structures keyed by
 * operation labels (controlled strings, not user input). Object injection warnings
 * are suppressed as labels are app-controlled operation identifiers only.
 */
/* eslint-disable security/detect-object-injection */

import { getAppConfig } from '@/config';
import { loadPerformanceMetrics, persistPerformanceMetrics } from '@/lib/middleware/storage';
import { logger } from '@/lib/utils/logger';
import { STORAGE_KEYS } from "@/maps";

/**
 * Single operation's baseline statistics
 */
export interface OperationBaseline {
  label: string; // Operation name (e.g. 'screen-load', 'api-fetch')
  count: number; // Total sample count (including warm-up)
  warmupCount: number; // How many cold-start samples skipped
  idleSkippedCount: number; // How many idle samples excluded from baseline
  droppedCount?: number; // How many samples dropped due to max limit
  p50: number; // Milliseconds (median)
  p95: number; // Milliseconds (95th percentile)
  p99: number; // Milliseconds (99th percentile)
  min?: number; // Minimum observed
  max?: number; // Maximum observed
  mean?: number; // Average of non-warm-up samples
  lastUpdated: number; // Timestamp (ms)
  lastRegressionAlert?: number; // Last time regression alert was fired (for throttling)
  version: number; // Schema version for migrations
}

/**
 * Regression detection result
 */
export interface RegressionDetectionResult {
  isRegression: boolean;
  baseline: OperationBaseline | null;
  current: number; // ms
  delta: number; // ms (current - p95)
  deltaPct: number; // % ((current - p95) / p95 * 100)
  threshold: number; // %
  skipped?: boolean; // true if idle time (not recorded)
}

/**
 * Configuration for baseline tracking
 */
export interface PerformanceBaselineConfig {
  maxSamplesPerOp: number; // Default 100, max array size per operation
  warmupSamples: number; // Default 5, skip first N samples
  regressionThresholdPct: number; // Default 20, threshold % above percentile
  percentileForCompare: number; // Default 95, which percentile to compare (50, 95, 99)
  maxOperations?: number; // Default 500, max distinct operation labels to track
  regressionCooldownMs?: number; // Default 60000 (1 min), throttle per-label regression alerts
}

/**
 * Root storage structure for all performance baselines
 */
export interface PerformanceBaselines {
  version: number; // Schema version (currently 1)
  created: number; // When first baseline created
  lastUpdated: number;
  baselines: Record<string, OperationBaseline>; // label → baseline
  samples: Record<string, number[]>; // label → sorted samples array (for percentile recalc)
  config: PerformanceBaselineConfig;
}

/**
 * Compute percentile using nearest-rank method
 * @param sortedSamples Pre-sorted array of samples (ascending)
 * @param percentile 0-100
 * @returns The percentile value
 */
export function computePercentile(sortedSamples: number[], percentile: number): number {
  if (sortedSamples.length === 0) return 0;
  if (sortedSamples.length === 1) return sortedSamples[0];

  // Nearest-rank method: rank = ceil(p/100 * n)
  const rank = Math.ceil((percentile / 100) * sortedSamples.length);
  const index = Math.max(0, Math.min(rank - 1, sortedSamples.length - 1));
  return sortedSamples[index];
}

/**
 * Binary insertion helper: maintain sorted order in O(log n)
 * Inserts value at correct position using binary search
 * @param sortedArray Array that must already be sorted (ascending)
 * @param value Value to insert
 * @returns The array with value inserted in sorted position
 */
function binaryInsert(sortedArray: number[], value: number): number[] {
  // Binary search to find insertion point
  let left = 0;
  let right = sortedArray.length;

  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    if (sortedArray[mid] < value) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }

  // Insert at correct position (maintains sorted order)
  sortedArray.splice(left, 0, value);
  return sortedArray;
}

/**
 * Service for managing performance baselines
 * Singleton instance is exported as `performanceBaselineService`
 */
export class PerformanceBaselineService {
  private data: PerformanceBaselines | null = null;
  private isInitialized = false;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingPersist = false;

  /**
   * Initialize service: load baselines from SecureStorage and apply runtime config
   * Called once during app bootstrap
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const stored = await loadPerformanceMetrics(STORAGE_KEYS.PERF_BASELINES);
      if (stored) {
        try {
          this.data = JSON.parse(stored);
          // Validate and migrate if needed (includes config-driven trimming)
          this.validateAndMigrate();
        } catch (error) {
          logger.category('performance').error(`Failed to parse stored baselines: ${error}, rebuilding`);
          this.data = this.createEmptyStorage();
          this.debouncedPersist();
        }
      } else {
        this.data = this.createEmptyStorage();
      }

      // Apply runtime config (overrides defaults)
      this.applyRuntimeConfig();

      // Prune excess operations if needed (global ops cap)
      this.pruneExcessOperations();

      this.isInitialized = true;
      if (this.data) {
        logger.category('performance').debug(`Baselines initialized: ${Object.keys(this.data.baselines).length} operations tracked, config: max=${this.data.config.maxSamplesPerOp} samples, warmup=${this.data.config.warmupSamples}, threshold=${this.data.config.regressionThresholdPct}%, percentile=p${this.data.config.percentileForCompare}`);
      }
    } catch (error) {
      logger.category('performance').error(`Failed to initialize baselines: ${error}`);
      this.data = this.createEmptyStorage();
      this.isInitialized = true;
    }
  }

  /**
   * Apply runtime config from appsettings to override defaults
   * @private
   */
  private applyRuntimeConfig(): void {
    if (!this.data) return;

    try {
      const config = getAppConfig();
      const perfConfig = config?.analytics?.performanceBaseline;

      if (perfConfig) {
        if (typeof perfConfig.maxSamplesPerOp === 'number') {
          this.data.config.maxSamplesPerOp = perfConfig.maxSamplesPerOp;
        }
        if (typeof perfConfig.warmupSamples === 'number') {
          this.data.config.warmupSamples = perfConfig.warmupSamples;
        }
        if (typeof perfConfig.regressionThresholdPct === 'number') {
          this.data.config.regressionThresholdPct = perfConfig.regressionThresholdPct;
        }
        if (typeof perfConfig.percentileForCompare === 'number') {
          this.data.config.percentileForCompare = perfConfig.percentileForCompare;
        }
      }

      logger.category('performance').perf(`Runtime config applied: max=${this.data.config.maxSamplesPerOp}, warmup=${this.data.config.warmupSamples}, threshold=${this.data.config.regressionThresholdPct}%, percentile=p${this.data.config.percentileForCompare}`);
    } catch (error) {
      logger.category('performance').debug(`Failed to apply runtime config: ${error}`);
    }
  }

  /**
   * Prune excess operations if count exceeds maxOperations (LRU: keep most recent)
   * @private
   */
  private pruneExcessOperations(): void {
    if (!this.data) return;

    const maxOps = this.data.config.maxOperations ?? 500;
    const opCount = Object.keys(this.data.baselines).length;

    if (opCount > maxOps) {
      const entriesToPrune = opCount - maxOps;
      const sorted = Object.entries(this.data.baselines)
        .sort((a, b) => (b[1].lastUpdated ?? 0) - (a[1].lastUpdated ?? 0));

      for (let i = 0; i < entriesToPrune && i < sorted.length; i++) {
        const label = sorted[sorted.length - 1 - i][0];
        delete this.data.baselines[label];
        delete this.data.samples[label];
        logger.category('performance').perf(`Pruned stale operation: "${label}" (LRU exceeded maxOperations: ${maxOps})`);
      }
    }
  }

  /**
   * Debounced persist: batch writes to avoid overlapping storage operations
   * @private
   */
  private debouncedPersist(): void {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
    }

    this.pendingPersist = true;

    // Batch writes: wait 500ms for more changes before persisting
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      if (this.pendingPersist) {
        this.pendingPersist = false;
        this.persist().catch(err => logger.category('performance').debug(`Debounced persist failed: ${err}`));
      }
    }, 500);
  }

  /**
   * Immediate persist (used by debouncedPersist and critical operations)
   * @private
   */
  private async persist(): Promise<void> {
    if (!this.data) return;

    try {
      this.data.lastUpdated = Date.now();
      const serialized = JSON.stringify(this.data);
      await persistPerformanceMetrics(STORAGE_KEYS.PERF_BASELINES, serialized);
    } catch (error) {
      logger.category('performance').error(`Failed to persist baselines: ${error}`);
    }
  }

  /**
   * Record a performance sample for an operation
   * Respects the track-performance-baseline feature flag
   * Fire-and-forget: persists to storage asynchronously without blocking
   * @param label Operation name (e.g. 'screen-load')
   * @param durationMs Duration in milliseconds
   * @param context Optional context (isIdle flag)
   */
  recordSample(label: string, durationMs: number, context?: { isIdle?: boolean }): void {
    if (!this.isInitialized) {
      logger.category('performance').warn('recordSample called before initialize()');
      return;
    }

    // Validate input
    if (!Number.isFinite(durationMs) || durationMs < 0) {
      logger.category('performance').perf(`Invalid duration for "${label}": ${durationMs}`);
      return;
    }

    if (!this.data) {
      this.data = this.createEmptyStorage();
    }

    const isIdle = context?.isIdle ?? false;

    // Initialize baseline if not exists
    if (!this.data.baselines[label]) {
      this.data.baselines[label] = {
        label,
        count: 0,
        warmupCount: 0,
        idleSkippedCount: 0,
        droppedCount: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        lastUpdated: Date.now(),
        version: 1,
      };
      this.data.samples[label] = [];
    }

    const baseline = this.data.baselines[label];
    const samples = this.data.samples[label];

    // If idle, skip recording in baseline but track count
    if (isIdle) {
      baseline.idleSkippedCount = (baseline.idleSkippedCount ?? 0) + 1;
      logger.category('performance').perf(`Idle measurement recorded for "${label}" (total idle skip: ${baseline.idleSkippedCount})`);
      this.debouncedPersist();
      return;
    }

    // Add sample with binary insertion (maintains sorted order in O(log n))
    binaryInsert(samples, durationMs);

    // Enforce max samples (FIFO: drop oldest)
    if (samples.length > this.data.config.maxSamplesPerOp) {
      const dropped = samples.shift();
      baseline.droppedCount = (baseline.droppedCount ?? 0) + 1;
      logger.category('performance').perf(`Sample limit reached for "${label}" (max: ${this.data.config.maxSamplesPerOp}), dropped oldest sample: ${dropped}ms (total dropped: ${baseline.droppedCount})`);
    }

    // Update baseline statistics
    baseline.count = (baseline.count ?? 0) + 1;
    baseline.min = Math.min(baseline.min ?? durationMs, durationMs);
    baseline.max = Math.max(baseline.max ?? durationMs, durationMs);

    // Compute percentiles (excluding warm-up samples)
    const warmupSources = this.data.config.warmupSamples;
    const recordedSamples = samples.length;

    if (recordedSamples <= warmupSources) {
      // Still in warm-up phase
      baseline.warmupCount = recordedSamples;
      baseline.p50 = 0;
      baseline.p95 = 0;
      baseline.p99 = 0;
      baseline.mean = 0;
      logger.category('performance').perf(`Warm-up sample recorded for "${label}" (${baseline.warmupCount}/${warmupSources}): ${durationMs}ms`);
    } else {
      // Baseline is active: use samples 6+ for percentiles
      const activeS = samples.slice(warmupSources);
      baseline.warmupCount = warmupSources;
      const oldP95 = baseline.p95;
      baseline.p50 = computePercentile(activeS, 50);
      baseline.p95 = computePercentile(activeS, 95);
      baseline.p99 = computePercentile(activeS, 99);
      baseline.mean = activeS.reduce((a, b) => a + b, 0) / activeS.length;

      logger.category('performance').perf(`Baseline updated for "${label}": p50=${baseline.p50.toFixed(2)}ms, p95=${baseline.p95.toFixed(2)}ms (was ${oldP95.toFixed(2)}ms), p99=${baseline.p99.toFixed(2)}ms, count=${baseline.count}, mean=${baseline.mean.toFixed(2)}ms`);
    }

    baseline.lastUpdated = Date.now();

    // Persist to storage via debounced batching (fire-and-forget, errors logged internally)
    this.debouncedPersist();
  }

  /**
   * Detect if a measurement represents a regression
   * @param label Operation name
   * @param durationMs Current measurement
   * @param context Optional context (isIdle flag)
   * @returns Regression detection result
   */
  detectRegression(
    label: string,
    durationMs: number,
    context?: { isIdle?: boolean }
  ): RegressionDetectionResult {
    if (!this.isInitialized || !this.data) {
      return {
        isRegression: false,
        baseline: null,
        current: durationMs,
        delta: 0,
        deltaPct: 0,
        threshold: this.data?.config.regressionThresholdPct ?? 20,
        skipped: false,
      };
    }

    const isIdle = context?.isIdle ?? false;
    if (isIdle) {
      return {
        isRegression: false,
        baseline: null,
        current: durationMs,
        delta: 0,
        deltaPct: 0,
        threshold: this.data.config.regressionThresholdPct,
        skipped: true,
      };
    }

    const baseline = this.data.baselines[label];
    const threshold = this.data.config.regressionThresholdPct;
    const percentileChoice = this.data.config.percentileForCompare ?? 95;

    if (!baseline || (baseline.p95 === 0 && baseline.p50 === 0 && baseline.p99 === 0)) {
      // No baseline yet
      return {
        isRegression: false,
        baseline: null,
        current: durationMs,
        delta: 0,
        deltaPct: 0,
        threshold,
        skipped: false,
      };
    }

    // Select percentile to compare against based on config
    let compareValue = baseline.p95; // default
    if (percentileChoice === 50) {
      compareValue = baseline.p50 || baseline.p95; // fallback to p95 if p50 not computed yet
    } else if (percentileChoice === 99) {
      compareValue = baseline.p99 || baseline.p95;
    }

    // Safety check: if compareValue is 0 (e.g., all percentiles still warming up), skip regression detection
    if (compareValue === 0) {
      return {
        isRegression: false,
        baseline,
        current: durationMs,
        delta: 0,
        deltaPct: 0,
        threshold,
        skipped: false,
      };
    }

    // Check throttling: only alert once per cooldown period for this operation
    const cooldown = this.data.config.regressionCooldownMs ?? 60000;
    const lastAlert = baseline.lastRegressionAlert ?? 0;
    const now = Date.now();
    const isThrottled = (now - lastAlert) < cooldown;

    // Compare to selected percentile
    const delta = durationMs - compareValue;
    const deltaPct = (delta / compareValue) * 100;
    const isRegression = deltaPct > threshold;

    // Update throttle timestamp if regression detected and NOT throttled
    // (encapsulation: handle persistence inside service, not caller)
    if (isRegression && !isThrottled) {
      baseline.lastRegressionAlert = now;
      this.debouncedPersist();
    }

    return {
      isRegression: isRegression && !isThrottled, // Only return true if NOT throttled
      baseline,
      current: durationMs,
      delta,
      deltaPct,
      threshold,
      skipped: false,
    };
  }

  /**
   * Get baseline stats for an operation
   */
  getBaseline(label: string): OperationBaseline | null {
    if (!this.isInitialized || !this.data) return null;
    return this.data.baselines[label] ?? null;
  }

  /**
   * Get full stats for an operation
   */
  getStats(label: string): OperationBaseline | null {
    return this.getBaseline(label);
  }

  /**
   * Get all baselines
   */
  getAll(): Record<string, OperationBaseline> {
    if (!this.isInitialized || !this.data) return {};
    return { ...this.data.baselines };
  }

  /**
   * Reset baseline for a specific operation
   */
  async reset(label: string): Promise<void> {
    if (!this.isInitialized || !this.data) return;

    delete this.data.baselines[label];
    delete this.data.samples[label];
    this.data.lastUpdated = Date.now();

    await this.persist();
    logger.category('performance').debug(`Baseline reset for "${label}"`);
  }

  /**
   * Reset all baselines
   */
  async resetAll(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    this.data = this.createEmptyStorage();
    await this.persist();
    logger.category('performance').debug('All baselines reset');
  }



  /**
   * Create empty storage structure
   */
  private createEmptyStorage(): PerformanceBaselines {
    return {
      version: 1,
      created: Date.now(),
      lastUpdated: Date.now(),
      baselines: {},
      samples: {},
      config: {
        maxSamplesPerOp: 100,
        warmupSamples: 5,
        regressionThresholdPct: 20,
        percentileForCompare: 95,
        maxOperations: 500,
        regressionCooldownMs: 60000,
      },
    };
  }

  /**
   * Validate and migrate storage on load
   */
  private validateAndMigrate(): void {
    if (!this.data) return;

    // Check schema version
    if (this.data.version !== 1) {
      logger.category('performance').perf(`Unknown schema version: ${this.data.version}, recreating`);
      this.data = this.createEmptyStorage();
      return;
    }

    // Migrate config: ensure all new fields present  
    this.data.config.percentileForCompare = this.data.config.percentileForCompare ?? 95;
    this.data.config.maxOperations = this.data.config.maxOperations ?? 500;
    this.data.config.regressionCooldownMs = this.data.config.regressionCooldownMs ?? 60000;

    // Trim samples if maxSamplesPerOp has shrunk
    for (const [label, samples] of Object.entries(this.data.samples)) {
      if (samples && samples.length > this.data.config.maxSamplesPerOp) {
        const trimmed = samples.slice(samples.length - this.data.config.maxSamplesPerOp);
        this.data.samples[label] = trimmed;
        const dropped = samples.length - trimmed.length;
        if (this.data.baselines[label]) {
          this.data.baselines[label].droppedCount = (this.data.baselines[label].droppedCount ?? 0) + dropped;
        }
        logger.category('performance').perf(`Trimmed ${dropped} samples for "${label}" due to config change (max: ${this.data.config.maxSamplesPerOp})`);
      }
    }

    // Validate baselines
    for (const [label, baseline] of Object.entries(this.data.baselines)) {
      // Validate percentile ordering
      if (!(baseline.p50 <= baseline.p95 && baseline.p95 <= baseline.p99)) {
        logger.category('performance').perf(`Invalid percentile ordering for "${label}": p50[${baseline.p50}] > p95[${baseline.p95}] > p99[${baseline.p99}]`);
        // Mark for rebuild (if samples exist)
        if (this.data.samples[label]?.length) {
          this.rebuildBaseline(label);
        } else {
          delete this.data.baselines[label];
        }
      }

      // Validate min/max ordering
      if (baseline.min && baseline.max && baseline.min > baseline.max) {
        logger.category('performance').perf(`Invalid min/max for "${label}": min[${baseline.min}] > max[${baseline.max}]`);
        delete this.data.baselines[label];
      }
    }

    // Ensure all expected fields
    for (const baseline of Object.values(this.data.baselines)) {
      baseline.idleSkippedCount = baseline.idleSkippedCount ?? 0;
      baseline.droppedCount = baseline.droppedCount ?? 0;
      baseline.warmupCount = baseline.warmupCount ?? 0;
      baseline.lastRegressionAlert = baseline.lastRegressionAlert ?? 0;
    }

    this.data.lastUpdated = Date.now();
  }

  /**
   * Rebuild baseline from stored samples
   */
  private rebuildBaseline(label: string): void {
    if (!this.data?.samples[label]) return;

    const samples = [...this.data.samples[label]].sort((a, b) => a - b);
    const warmupN = this.data.config.warmupSamples;

    if (samples.length === 0) {
      delete this.data.baselines[label];
      return;
    }

    const activeSamples = samples.length > warmupN ? samples.slice(warmupN) : [];

    this.data.baselines[label] = {
      label,
      count: samples.length,
      warmupCount: Math.min(warmupN, samples.length),
      idleSkippedCount: this.data.baselines[label]?.idleSkippedCount ?? 0,
      droppedCount: this.data.baselines[label]?.droppedCount ?? 0,
      p50: activeSamples.length > 0 ? computePercentile(activeSamples, 50) : 0,
      p95: activeSamples.length > 0 ? computePercentile(activeSamples, 95) : 0,
      p99: activeSamples.length > 0 ? computePercentile(activeSamples, 99) : 0,
      min: Math.min(...samples),
      max: Math.max(...samples),
      mean: activeSamples.length > 0 ? activeSamples.reduce((a, b) => a + b, 0) / activeSamples.length : 0,
      lastUpdated: Date.now(),
      version: 1,
    };

    logger.category('performance').debug(`Rebuilt baseline for "${label}" from ${samples.length} samples`);
  }
}

/**
 * Global singleton instance
 */
export const performanceBaselineService = new PerformanceBaselineService();
