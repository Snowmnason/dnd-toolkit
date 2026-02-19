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

import { getAppConfig } from '@/lib/config/loader';
import { SecureStorage, STORAGE_KEYS } from '@/lib/storage';
import { logger } from '@/lib/utils/logger';

/**
 * Single operation's baseline statistics
 */
export interface OperationBaseline {
  label: string; // Operation name (e.g. 'screen-load', 'api-fetch')
  count: number; // Total sample count (including warm-up)
  warmupCount: number; // How many cold-start samples skipped
  idleSkippedCount: number; // How many idle samples excluded from baseline
  p50: number; // Milliseconds (median)
  p95: number; // Milliseconds (95th percentile)
  p99: number; // Milliseconds (99th percentile)
  min?: number; // Minimum observed
  max?: number; // Maximum observed
  mean?: number; // Average of non-warm-up samples
  lastUpdated: number; // Timestamp (ms)
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
  maxSamplesPerOp: number; // Default 100
  warmupSamples: number; // Default 5
  regressionThresholdPct: number; // Default 20
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
function computePercentile(sortedSamples: number[], percentile: number): number {
  if (sortedSamples.length === 0) return 0;
  if (sortedSamples.length === 1) return sortedSamples[0];

  // Nearest-rank method: rank = ceil(p/100 * n)
  const rank = Math.ceil((percentile / 100) * sortedSamples.length);
  const index = Math.max(0, Math.min(rank - 1, sortedSamples.length - 1));
  return sortedSamples[index];
}

/**
 * Service for managing performance baselines
 * Singleton instance is exported as `performanceBaselineService`
 */
export class PerformanceBaselineService {
  private data: PerformanceBaselines | null = null;
  private isInitialized = false;

  /**
   * Initialize service: load baselines from SecureStorage
   * Called once during app bootstrap
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const stored = await SecureStorage.getItem(STORAGE_KEYS.PERF_BASELINES);
      if (stored) {
        try {
          this.data = JSON.parse(stored);
          // Validate and migrate if needed
          this.validateAndMigrate();
        } catch (error) {
          logger.error('performance', `Failed to parse stored baselines: ${error}, rebuilding`);
          this.data = this.createEmptyStorage();
          await this.persist();
        }
      } else {
        this.data = this.createEmptyStorage();
      }

      this.isInitialized = true;
      if (this.data) {
        logger.debug('performance', `Baselines initialized: ${Object.keys(this.data.baselines).length} operations tracked`);
      }
    } catch (error) {
      logger.error('performance', `Failed to initialize baselines: ${error}`);
      this.data = this.createEmptyStorage();
      this.isInitialized = true;
    }
  }

  /**
   * Record a performance sample for an operation
   * Respects the track-performance-baseline feature flag
   * @param label Operation name (e.g. 'screen-load')
   * @param durationMs Duration in milliseconds
   * @param context Optional context (isIdle flag)
   */
  async recordSample(label: string, durationMs: number, context?: { isIdle?: boolean }): Promise<void> {
    if (!this.isInitialized) {
      logger.warn('performance', 'recordSample called before initialize()');
      return;
    }

    // Check if baseline tracking is enabled via feature flag
    // If disabled, skip recording but allow queries (comparison still works)
    const isTrackingEnabled = this.isBaselineTrackingEnabled();
    if (!isTrackingEnabled) {
      return;
    }

    // Validate input
    if (!Number.isFinite(durationMs) || durationMs < 0) {
      logger.warn('performance', `Invalid duration for "${label}": ${durationMs}`);
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
      await this.persist();
      return;
    }

    // Add sample and keep sorted
    samples.push(durationMs);
    samples.sort((a, b) => a - b);

    // Enforce max samples (FIFO: drop oldest)
    if (samples.length > this.data.config.maxSamplesPerOp) {
      samples.shift();
      logger.debug('performance', `Sample limit reached for "${label}", dropped oldest`);
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
    } else {
      // Baseline is active: use samples 6+ for percentiles
      const activeS = samples.slice(warmupSources);
      baseline.warmupCount = warmupSources;
      baseline.p50 = computePercentile(activeS, 50);
      baseline.p95 = computePercentile(activeS, 95);
      baseline.p99 = computePercentile(activeS, 99);
      baseline.mean = activeS.reduce((a, b) => a + b, 0) / activeS.length;
    }

    baseline.lastUpdated = Date.now();

    // Persist to storage
    await this.persist();
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

    if (!baseline || baseline.p95 === 0) {
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

    // Compare to p95
    const delta = durationMs - baseline.p95;
    const deltaPct = (delta / baseline.p95) * 100;
    const isRegression = deltaPct > threshold;

    return {
      isRegression,
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
    logger.debug('performance', `Baseline reset for "${label}"`);
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
    logger.debug('performance', 'All baselines reset');
  }

  /**
   * Check if baseline tracking is enabled via feature flag
   * @private
   */
  private isBaselineTrackingEnabled(): boolean {
    try {
      const config = getAppConfig();
      
      // Check feature flag: track-performance-baseline
      // For now, we'll check the config features object with a loose access
      // Default to true (enabled) if not explicitly disabled
      const features = config?.features as Record<string, unknown>;
      // Cast to Record<string, unknown> to access dynamic keys safely
      const trackingEnabled = features?.['track-performance-baseline'];
      
      // If explicitly set to false, disable; otherwise default to enabled
      return trackingEnabled !== false;
    } catch (error) {
      // If config can't be read, default to enabled
      logger.debug('performance', `Failed to check feature flag: ${error}, defaulting to enabled`);
      return true;
    }
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
      logger.warn('performance', `Unknown schema version: ${this.data.version}, recreating`);
      this.data = this.createEmptyStorage();
      return;
    }

    // Validate baselines
    for (const [label, baseline] of Object.entries(this.data.baselines)) {
      // Validate percentile ordering
      if (!(baseline.p50 <= baseline.p95 && baseline.p95 <= baseline.p99)) {
        logger.warn(
          'performance',
          `Invalid percentile ordering for "${label}": p50[${baseline.p50}] > p95[${baseline.p95}] > p99[${baseline.p99}]`
        );
        // Mark for rebuild (if samples exist)
        if (this.data.samples[label]?.length) {
          this.rebuildBaseline(label);
        } else {
          delete this.data.baselines[label];
        }
      }

      // Validate min/max ordering
      if (baseline.min && baseline.max && baseline.min > baseline.max) {
        logger.warn('performance', `Invalid min/max for "${label}": min[${baseline.min}] > max[${baseline.max}]`);
        delete this.data.baselines[label];
      }
    }

    // Ensure all expected fields
    for (const baseline of Object.values(this.data.baselines)) {
      baseline.idleSkippedCount = baseline.idleSkippedCount ?? 0;
      baseline.warmupCount = baseline.warmupCount ?? 0;
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
      p50: activeSamples.length > 0 ? computePercentile(activeSamples, 50) : 0,
      p95: activeSamples.length > 0 ? computePercentile(activeSamples, 95) : 0,
      p99: activeSamples.length > 0 ? computePercentile(activeSamples, 99) : 0,
      min: Math.min(...samples),
      max: Math.max(...samples),
      mean: activeSamples.length > 0 ? activeSamples.reduce((a, b) => a + b, 0) / activeSamples.length : 0,
      lastUpdated: Date.now(),
      version: 1,
    };

    logger.debug('performance', `Rebuilt baseline for "${label}" from ${samples.length} samples`);
  }

  /**
   * Persist storage to SecureStorage
   */
  private async persist(): Promise<void> {
    if (!this.data) return;

    try {
      this.data.lastUpdated = Date.now();
      const serialized = JSON.stringify(this.data);
      await SecureStorage.setItem(STORAGE_KEYS.PERF_BASELINES, serialized);
    } catch (error) {
      logger.error('performance', `Failed to persist baselines: ${error}`);
    }
  }

  /**
   * Ensure storage key is in STORAGE_KEYS constant
   */
  private static ensureStorageKey(): void {
    if (!STORAGE_KEYS.PERF_BASELINES) {
      logger.warn('performance', 'STORAGE_KEYS.PERF_BASELINES not defined, using fallback key');
    }
  }
}

/**
 * Global singleton instance
 */
export const performanceBaselineService = new PerformanceBaselineService();
