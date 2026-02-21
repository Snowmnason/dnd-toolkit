# Performance Regression Detection and Baseline Tracking - Usage Guide

Tracks historical performance metrics, computes percentiles, and detects regressions over time. Distinguishes between app load time (performance) and user dwell time (behavior).

## Overview

**Use this feature if you need to:**
- Monitor performance regressions across app versions or deployments
- Track typical vs worst-case performance for operations
- Alert when current performance exceeds historical baselines
- Exclude user idle time from performance baselines
- Persist baselines across app restarts/sessions

**Do NOT use this feature for:**
- Real-time performance monitoring (use existing `withTiming()` or `useScreenDuration()`)
- One-off performance measurements (use `Performance.startMeasure()` / `endMeasure()`)
- General telemetry logging (use `logger.category('performance')`)

## How It Works

### Baseline Computation
```
recordSample("screen-load", 1200ms)
        ↓
Add to sorted samples array [100,200,300,...,1200]
        ↓
Recompute percentiles: p50=550ms, p95=1150ms, p99=1190ms
```

### Regression Detection
```
detectRegression("screen-load", 1400ms)
        ↓
Compare 1400ms > 1150ms * 1.2 (threshold 20%) → Regression detected!
        ↓
Emit regression event via #178 exporters + log warning
```

### Idle-Time Filtering
- **App backgrounded:** Skip recording if `AppState` inactive/paused
- **User dwell time:** Exclude measurements when user hasn't interacted for >60s
- **Load vs behavior:** Distinguishes app performance from user reading time

## Basic Usage

1. **Initialize the service** during app startup:
   ```typescript
   import { performanceBaselineService } from '@/lib/analytics';

   // In AppKernel or main app component
   await performanceBaselineService.initialize();
   ```

2. **Record performance measurements** at key points:
   ```typescript
   // Screen load time
   performanceBaselineService.recordSample('screen-home', 1200);

   // API call latency
   performanceBaselineService.recordSample('api-fetch-users', 350);

   // With idle context (app backgrounded)
   performanceBaselineService.recordSample('screen-home', 30000, { isIdle: true });
   ```

3. **Check for regressions** after measurements:
   ```typescript
   const result = performanceBaselineService.detectRegression('api-fetch', 2500);
   if (result.isRegression) {
     console.warn(`Regression: ${result.deltaPct}% slower than baseline`);
     // Event automatically exported via #178 exporters
   }
   ```

4. **Query baseline statistics** for debugging:
   ```typescript
   const baseline = performanceBaselineService.getBaseline('screen-home');
   if (baseline) {
     console.log(`p95: ${baseline.p95}ms, samples: ${baseline.count}`);
   }
   ```

## PerformanceBaselineService.recordSample

Records a performance measurement for an operation.

**Parameters:**
- `label: string` - Operation identifier (e.g. `'screen-load'`, `'api-fetch-users'`)
- `durationMs: number` - Duration in milliseconds
- `context?: { isIdle?: boolean }` - Optional context (idle flag)

```typescript
performanceBaselineService.recordSample('api-call', 500);
performanceBaselineService.recordSample('screen-load', 1200, { isIdle: false });
```

## PerformanceBaselineService.detectRegression

Checks if current measurement indicates a performance regression.

**Parameters:**
- `label: string` - Operation identifier
- `durationMs: number` - Current measurement in milliseconds
- `context?: { isIdle?: boolean }` - Optional context (idle flag)

**Returns:** `RegressionDetectionResult`
- `isRegression: boolean` - True if exceeds threshold
- `baseline: OperationBaseline | null` - Current baseline
- `current: number` - Current measurement (ms)
- `delta: number` - Difference from baseline (ms)
- `deltaPct: number` - Difference percentage
- `threshold: number` - Configured threshold %
- `skipped?: boolean` - True if idle measurement

```typescript
const result = performanceBaselineService.detectRegression('api-call', 2500);
if (result.isRegression) {
  // Handle regression
}
```

## PerformanceBaselineService.getBaseline

Gets current baseline statistics for an operation.

**Parameters:**
- `label: string` - Operation identifier

**Returns:** `OperationBaseline | null`

```typescript
const baseline = performanceBaselineService.getBaseline('screen-home');
// Returns: { p50: 450, p95: 890, count: 25, ... }
```

## PerformanceBaselineService.reset

Clears baseline for a specific operation.

**Parameters:**
- `label: string` - Operation identifier

```typescript
await performanceBaselineService.reset('screen-home');
```

## PerformanceBaselineService.resetAll

Clears all baselines.

```typescript
await performanceBaselineService.resetAll();
```

## Configuration

### Feature Flag

Enable baseline tracking via `appsettings.json`:

```json
{
  "featureFlags": {
    "track-performance-baseline": true
  }
}
```

### Performance Baseline Settings

Configure thresholds and limits in `appsettings.json`:

```json
{
  "analytics": {
    "performanceBaseline": {
      "enabled": true,
      "maxSamplesPerOp": 100,
      "warmupSamples": 5,
      "regressionThresholdPct": 20,
      "percentileForCompare": 95
    }
  }
}
```

**Settings:**
- `enabled`: Master enable/disable
- `maxSamplesPerOp`: Maximum samples per operation (rolling window)
- `warmupSamples`: Samples to skip before baseline becomes active
- `regressionThresholdPct`: Alert threshold (% above baseline)
- `percentileForCompare`: Which percentile to compare against (50, 95, 99)

## Troubleshooting

### Baselines Not Recording
- Ensure `performanceBaselineService.initialize()` called during app startup
- Verify `durationMs` is positive finite number
- Idle samples (`isIdle: true`) are tracked but excluded from baseline

### Regressions Not Detected
- Need at least 6 samples (5 warm-up + 1) for baseline to be active
- Check `regressionThresholdPct` in config (default 20%)
- Verify `percentileForCompare` setting (default 95)
- Idle samples don't affect baseline

### Regression Events Not Exported
- Ensure exporters registered with `exporterRegistry.register()`
- Check exporter handles `'performance'` events
- Events may be queued offline, check #70 buffer status

### Storage Corrupted
- Invalid baselines are discarded and rebuilt
- Use `resetAll()` to clear corrupted data

### Inconsistent Baselines
- Currently single baseline across platforms
- Baselines reflect real-world mixed conditions (cold + warm loads, network variability)