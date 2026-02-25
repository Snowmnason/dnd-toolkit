/**
 * Feature Flags Telemetry & Monitoring (Phase 3)
 *
 * Tracks and reports:
 * - Condition evaluation failures and performance
 * - Cache hit/miss rates and patterns
 * - Flag usage frequency
 * - Dependency resolution performance
 * - Admin operations and overrides
 */

import { logger } from "@/lib/utils/logger";

// ==========================================
// Telemetry Types
// ==========================================

export interface ConditionEvaluationMetric {
  flagName: string;
  success: boolean;
  evaluationTimeMs: number;
  hasAdvancedLogic: boolean;
  hasConditions: boolean;
  hasDependencies: boolean;
  errorMessage?: string;
  timestamp: number;
}

export interface CacheMetric {
  operation: "hit" | "miss" | "invalidation" | "clear";
  flagName?: string;
  role?: string;
  timestamp: number;
}

export interface FeatureFlagUsageMetric {
  flagName: string;
  checked: number;
  enabled: number;
  disabled: number;
  timestamp: number;
}

export interface DependencyResolutionMetric {
  flagName: string;
  chainLength: number;
  resolutionTimeMs: number;
  success: boolean;
  circularDependencyDetected: boolean;
  timestamp: number;
}

// ==========================================
// Telemetry Aggregator
// ==========================================

/**
 * In-memory telemetry collector for monitoring
 */
export class FeatureFlagsTelemetry {
  private conditionEvaluations: Map<string, ConditionEvaluationMetric[]> = new Map();
  private cacheMetrics: CacheMetric[] = [];
  private usageMetrics: Map<string, FeatureFlagUsageMetric> = new Map();
  private dependencyMetrics: DependencyResolutionMetric[] = [];

  private maxStoredMetrics = 1000; // Prevent unbounded growth
  private collectionEnabled = true;

  /**
   * Record condition evaluation metric
   */
  recordConditionEvaluation(metric: ConditionEvaluationMetric): void {
    if (!this.collectionEnabled) return;

    if (!this.conditionEvaluations.has(metric.flagName)) {
      this.conditionEvaluations.set(metric.flagName, []);
    }

    const metrics = this.conditionEvaluations.get(metric.flagName)!;
    metrics.push(metric);

    // Trim old metrics to prevent memory leak
    if (metrics.length > this.maxStoredMetrics) {
      metrics.splice(0, metrics.length - this.maxStoredMetrics);
    }

    // Log failures immediately
    if (!metric.success) {
      logger.category("feature_flags").error(
        `Condition evaluation failed for "${metric.flagName}": ${metric.errorMessage}`,
      );
    }
  }

  /**
   * Record cache operation metric
   */
  recordCacheOperation(metric: CacheMetric): void {
    if (!this.collectionEnabled) return;

    this.cacheMetrics.push(metric);

    if (this.cacheMetrics.length > this.maxStoredMetrics) {
      this.cacheMetrics.splice(0, this.cacheMetrics.length - this.maxStoredMetrics);
    }
  }

  /**
   * Record flag usage
   */
  recordFlagUsage(flagName: string, result: boolean): void {
    if (!this.collectionEnabled) return;

    if (!this.usageMetrics.has(flagName)) {
      this.usageMetrics.set(flagName, {
        flagName,
        checked: 0,
        enabled: 0,
        disabled: 0,
        timestamp: Date.now(),
      });
    }

    const metric = this.usageMetrics.get(flagName)!;
    metric.checked++;
    if (result) {
      metric.enabled++;
    } else {
      metric.disabled++;
    }
    metric.timestamp = Date.now();
  }

  /**
   * Record dependency resolution metric
   */
  recordDependencyResolution(metric: DependencyResolutionMetric): void {
    if (!this.collectionEnabled) return;

    this.dependencyMetrics.push(metric);

    if (this.dependencyMetrics.length > this.maxStoredMetrics) {
      this.dependencyMetrics.splice(
        0,
        this.dependencyMetrics.length - this.maxStoredMetrics,
      );
    }
  }

  /**
   * Get aggregate statistics for a flag
   */
  getFlagStats(flagName: string) {
    const conditions = this.conditionEvaluations.get(flagName) ?? [];
    const usage = this.usageMetrics.get(flagName);

    const avgConditionTime =
      conditions.length > 0
        ? conditions.reduce((sum, m) => sum + m.evaluationTimeMs, 0) /
          conditions.length
        : 0;

    const failureRate =
      conditions.length > 0
        ? conditions.filter((m) => !m.success).length / conditions.length
        : 0;

    return {
      flagName,
      conditionEvaluations: conditions.length,
      avgEvaluationTimeMs: avgConditionTime,
      failureRate,
      usage: usage
        ? {
            checked: usage.checked,
            enabledCount: usage.enabled,
            disabledCount: usage.disabled,
            enableRate: usage.checked > 0 ? usage.enabled / usage.checked : 0,
          }
        : null,
    };
  }

  /**
   * Get cache metrics summary
   */
  getCacheStats() {
    const hits = this.cacheMetrics.filter((m) => m.operation === "hit").length;
    const misses = this.cacheMetrics.filter((m) => m.operation === "miss").length;
    const invalidations = this.cacheMetrics.filter(
      (m) => m.operation === "invalidation",
    ).length;
    const clears = this.cacheMetrics.filter((m) => m.operation === "clear").length;

    const totalRequests = hits + misses;

    return {
      hits,
      misses,
      hitRate: totalRequests > 0 ? hits / totalRequests : 0,
      invalidations,
      clears,
      totalMetricsRecorded: this.cacheMetrics.length,
    };
  }

  /**
   * Get dependency resolution metrics
   */
  getDependencyStats() {
    const successful = this.dependencyMetrics.filter(
      (m) => m.success,
    ).length;
    const failed = this.dependencyMetrics.length - successful;
    const withCircular = this.dependencyMetrics.filter(
      (m) => m.circularDependencyDetected,
    ).length;

    const avgResolutionTime =
      this.dependencyMetrics.length > 0
        ? this.dependencyMetrics.reduce((sum, m) => sum + m.resolutionTimeMs, 0) /
          this.dependencyMetrics.length
        : 0;

    const maxChainLength =
      this.dependencyMetrics.length > 0
        ? Math.max(...this.dependencyMetrics.map((m) => m.chainLength))
        : 0;

    return {
      successful,
      failed,
      circularDependenciesDetected: withCircular,
      avgResolutionTimeMs: avgResolutionTime,
      maxChainLength,
      totalResolutions: this.dependencyMetrics.length,
    };
  }

  /**
   * Generate telemetry report
   */
  generateReport() {
    const flagStats = Array.from(this.usageMetrics.keys()).map((flagName) =>
      this.getFlagStats(flagName),
    );

    return {
      timestamp: Date.now(),
      flags: {
        total: flagStats.length,
        byFlag: flagStats.sort((a, b) => (b.usage?.checked ?? 0) - (a.usage?.checked ?? 0)),
      },
      cache: this.getCacheStats(),
      dependencies: this.getDependencyStats(),
      metricsStorageBytes: this.estimateMemoryUsage(),
    };
  }

  /**
   * Clear all metrics (for testing or reset)
   */
  clear(): void {
    this.conditionEvaluations.clear();
    this.cacheMetrics = [];
    this.usageMetrics.clear();
    this.dependencyMetrics = [];
  }

  /**
   * Enable/disable telemetry collection
   */
  setCollectionEnabled(enabled: boolean): void {
    this.collectionEnabled = enabled;
  }

  /**
   * Estimate memory usage (rough estimate)
   */
  private estimateMemoryUsage(): number {
    let bytes = 0;

    for (const metrics of this.conditionEvaluations.values()) {
      bytes += metrics.length * 200; // Rough estimate: ~200 bytes per metric
    }

    bytes += this.cacheMetrics.length * 100;
    bytes += this.usageMetrics.size * 150;
    bytes += this.dependencyMetrics.length * 180;

    return bytes;
  }
}

/**
 * Global telemetry instance
 */
export const featureFlagsTelemetry = new FeatureFlagsTelemetry();

// ==========================================
// Diagnostic Tools
// ==========================================

export interface HealthCheckResult {
  healthy: boolean;
  issues: string[];
  warnings: string[];
  suggestions: string[];
}

/**
 * Health check for feature flags system
 */
export function performHealthCheck(): HealthCheckResult {
  const issues: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  const stats = featureFlagsTelemetry.getDependencyStats();

  // Check for resolution failures
  if (stats.failed > 0) {
    issues.push(`${stats.failed} dependency resolution failures`);
  }

  // Check for circular dependencies
  if (stats.circularDependenciesDetected > 0) {
    warnings.push(
      `${stats.circularDependenciesDetected} circular dependencies detected`,
    );
    suggestions.push("Review flag dependency graph and refactor");
  }

  // Check chain depth
  if (stats.maxChainLength > 5) {
    warnings.push(
      `High dependency chain depth: ${stats.maxChainLength} (>5 is complex)`,
    );
    suggestions.push("Consider flattening dependency tree");
  }

  // Check resolution performance
  if (stats.avgResolutionTimeMs > 5) {
    warnings.push(`Slow dependency resolution: ${stats.avgResolutionTimeMs.toFixed(1)}ms`);
    suggestions.push("Profile flag dependencies and optimize conditions");
  }

  return {
    healthy: issues.length === 0 && warnings.length === 0,
    issues,
    warnings,
    suggestions,
  };
}

/**
 * Export telemetry as JSON (for logging services)
 */
export function exportTelemetryJSON(): string {
  const report = featureFlagsTelemetry.generateReport();
  return JSON.stringify(report, null, 2);
}
