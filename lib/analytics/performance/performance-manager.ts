import Constants from "expo-constants";
import { useEffect } from "react";
import { Platform } from "react-native";
import { isAppIdle } from "../../../hooks/utils/use-app-state";
import { logger } from "../../utils/logger";
import { Analytics } from "../analytics-manager";
import { createExportContext, dispatchEvent } from "../exporters/exporter-registry";
import { getThreshold, sanitizeError } from "../utils";
import { performanceBaselineService } from "./performance-baseline";

function withTiming<T>(
  label: string,
  fn: () => Promise<T> | T,
  warnMs?: number,
): Promise<T> | T {
  const start = Date.now();
  const slowScreenThreshold = warnMs ?? getThreshold("slowScreenMs");

  const finish = (ok: boolean, extra?: any) => {
    const duration_ms = Date.now() - start;
    if (duration_ms > slowScreenThreshold) {
      logger.category("performance").warn("Slow operation detected", {
          operation: label,
          duration_ms,
          threshold: slowScreenThreshold,
        });
    }
    
    // Record baseline sample with idle-time context (app backgrounded = idle measurement)
    const context = { isIdle: isAppIdle() };
    performanceBaselineService.recordSample(label, duration_ms, context);
    const result = performanceBaselineService.detectRegression(label, duration_ms, context);
    
    if (result.isRegression) {
      logger.category('performance').perf(
        `Performance regression detected for '${label}': ${result.current}ms vs baseline ${result.baseline?.p95}ms (threshold: ${result.threshold}%, delta: ${result.deltaPct?.toFixed(1)}%, samples: ${result.baseline?.count ?? 0}, app_version: ${Constants.expoConfig?.version ?? 'unknown'}, platform: ${Platform.OS})`
      );
      
      // Emit regression event via #178 exporters (fire-and-forget) with rich context
      // dispatchEvent() gates by consent; no need to check here
      const regressionEvent = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        type: 'performance' as const,
        name: 'regression_detected',
        properties: {
          operation: label,
          current_ms: result.current,
          baseline_p50_ms: result.baseline?.p50,
          baseline_p95_ms: result.baseline?.p95,
          baseline_p99_ms: result.baseline?.p99,
          baseline_mean_ms: result.baseline?.mean,
          baseline_count: result.baseline?.count,
          threshold_pct: result.threshold,
          delta_ms: result.delta,
          delta_pct: result.deltaPct,
          warmup_skipped: result.baseline?.warmupCount,
          idle_skipped: result.baseline?.idleSkippedCount,
          samples_dropped: result.baseline?.droppedCount,
          app_version: Constants.expoConfig?.version ?? 'unknown',
          platform: Platform.OS,
        },
      };
      const exportContext = createExportContext();
      dispatchEvent(regressionEvent, exportContext);
    }
  };

  try {
    const r = fn();
    if (r instanceof Promise) {
      return r
        .then((val) => {
          finish(true);
          return val;
        })
        .catch((err) => {
          const error = sanitizeError(err);
          finish(false, error ? { error } : undefined);
          throw err;
        });
    } else {
      finish(true);
      return r;
    }
  } catch (err) {
    const error = sanitizeError(err);
    finish(false, error ? { error } : undefined);
    throw err;
  }
}

export const Performance = {
  marks: new Map<string, number>(),
  // Maximum age for marks (5 minutes) to prevent memory leaks from abandoned measurements
  MAX_MARK_AGE_MS: 5 * 60 * 1000,

  /**
   * Start a performance measurement
   * If a mark with this label already exists, logs a warning and overwrites it
   * to prevent incorrect measurements from reused labels
   */
  startMeasure(label: string) {
    const existing = this.marks.get(label);
    if (existing) {
      logger.category('performance').warn(`Mark '${label}' already exists, overwriting (potential duplicate measurement)`);
    }
    this.marks.set(label, Date.now());
    this.cleanupOldMarks();
  },

  endMeasure(label: string, warnMs?: number) {
    const start = this.marks.get(label);
    if (!start) return;
    const duration = Date.now() - start;
    const slowScreenThreshold = warnMs ?? getThreshold("slowScreenMs");
    this.marks.delete(label);
    Analytics.track("performance_measure", { label, duration_ms: duration });
    if (duration > slowScreenThreshold)
      logger.category('performance').perf(`Slow operation: ${label} took ${duration}ms`);
    
    // Record baseline sample with idle-time context (app backgrounded = idle measurement)
    const context = { isIdle: isAppIdle() };
    performanceBaselineService.recordSample(label, duration, context);
    const result = performanceBaselineService.detectRegression(label, duration, context);
    if (result.isRegression) {
      logger.category('performance').perf(`Performance regression detected for '${label}': ${result.current}ms vs p95 ${result.baseline?.p95}ms (threshold: ${result.threshold}%, delta: ${result.deltaPct?.toFixed(1)}%)`);
      // Emit regression event via #178 exporters (fire-and-forget)
      // dispatchEvent() gates by consent; no need to check here
      const regressionEvent = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        type: 'performance' as const,
        name: 'regression_detected',
        properties: {
          operation: label,
          current_ms: result.current,
          baseline_p50_ms: result.baseline?.p50,
          baseline_p95_ms: result.baseline?.p95,
          baseline_p99_ms: result.baseline?.p99,
          baseline_mean_ms: result.baseline?.mean,
          baseline_count: result.baseline?.count,
          threshold_pct: result.threshold,
          delta_ms: result.delta,
          delta_pct: result.deltaPct,
          warmup_skipped: result.baseline?.warmupCount,
          idle_skipped: result.baseline?.idleSkippedCount,
          samples_dropped: result.baseline?.droppedCount,
          app_version: Constants.expoConfig?.version ?? 'unknown',
          platform: Platform.OS,
        },
      };
      const exportContext = createExportContext();
      dispatchEvent(regressionEvent, exportContext);
      // Don't await — fire-and-forget pattern for exporter failures
    }
  },

  /**
   * Clean up marks older than MAX_MARK_AGE_MS to prevent memory leaks
   * from abandoned measurements (e.g., unmounted components, errors)
   */
  cleanupOldMarks() {
    const now = Date.now();
    const staleLabels: string[] = [];

    this.marks.forEach((timestamp, label) => {
      if (now - timestamp > this.MAX_MARK_AGE_MS) {
        staleLabels.push(label);
      }
    });

    staleLabels.forEach((label) => {
      logger.category('performance').debug(`Removing stale mark: ${label}`);
      this.marks.delete(label);
    });
  },

  useScreenDuration(screenName: string) {
    useEffect(() => {
      const label = `screen_load:${screenName}`;
      Performance.startMeasure(label);
      return () => Performance.endMeasure(label);
    }, [screenName]);
  },
};

export { withTiming };

