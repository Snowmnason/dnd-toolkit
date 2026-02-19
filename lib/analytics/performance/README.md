# Performance Baseline Tracking

Track historical performance metrics, compute percentiles, and detect regressions over time. Distinguishes between app load time (performance) and user dwell time (behavior).

## When to Use This Module

**Use this module if you need to:**

- Monitor performance regressions across app versions or deployments
- Track typical vs worst-case performance for operations
- Alert when current performance exceeds historical baselines
- Exclude user idle time from performance baselines
- Persist baselines across app restarts/sessions

**Do NOT use this module for:**

- Real-time performance monitoring (use existing `withTiming()` or `useScreenDuration()`)
- One-off performance measurements (use `Performance.startMeasure()` / `endMeasure()`)
- General telemetry logging (use `logger.category('performance')`)

## How It Works

```
recordSample("screen-load", 1200ms)
        ↓
Add to sorted samples array [100,200,300,...,1200]
        ↓
Recompute percentiles: p50=550ms, p95=1150ms, p99=1190ms
        ↓
detectRegression("screen-load", 1400ms)
        ↓
Compare 1400ms > 1150ms * 1.2 (threshold 20%) → Regression detected!
        ↓
Emit regression event via #178 exporters + log warning
```

**Key Concepts:**

- **Baseline:** Historical p50/p95/p99 percentiles for an operation
- **Percentile:** p50=median (50% faster/slower), p95=95th slowest, p99=99th slowest
- **Regression:** Current measurement > baseline percentile + threshold%
- **Warm-up:** Skip first N samples to avoid cold-start skew
- **Idle filtering:** Exclude measurements when app is backgrounded or user idle

## API Reference

### `PerformanceBaselineService`

Singleton service managing all baselines. Initialize once during app bootstrap.

#### `initialize(): Promise<void>`

Load baselines from SecureStorage and apply runtime config. Call during app startup.

```typescript
await performanceBaselineService.initialize();
```

#### `recordSample(label: string, durationMs: number, context?: { isIdle?: boolean }): void`

Record a performance measurement for an operation.

- **label:** Operation identifier (e.g. `'screen-load'`, `'api-fetch-users'`)
- **durationMs:** Duration in milliseconds
- **context.isIdle:** If true, measurement is excluded from baseline (user dwell time)

```typescript
// Record screen load time
performanceBaselineService.recordSample('screen-home', 1200);

// Exclude idle time (app backgrounded)
performanceBaselineService.recordSample('screen-home', 30000, { isIdle: true });
```

#### `getBaseline(label: string): OperationBaseline | null`

Get current baseline statistics for an operation.

```typescript
const baseline = performanceBaselineService.getBaseline('screen-home');
if (baseline) {
  console.log(`p95: ${baseline.p95}ms, samples: ${baseline.count}`);
}
```

#### `detectRegression(label: string, durationMs: number, context?: { isIdle?: boolean }): RegressionDetectionResult`

Check if current measurement indicates a performance regression.

Returns:
- `isRegression`: true if exceeds threshold
- `baseline`: current baseline or null
- `delta`: difference from baseline (ms)
- `deltaPct`: difference percentage
- `threshold`: configured threshold %
- `skipped`: true if idle measurement

```typescript
const result = performanceBaselineService.detectRegression('api-fetch', 2500);
if (result.isRegression) {
  console.warn(`Regression: ${result.deltaPct}% slower than baseline`);
}
```

#### `reset(label: string): Promise<void>`

Clear baseline for a specific operation.

```typescript
await performanceBaselineService.reset('screen-home');
```

#### `resetAll(): Promise<void>`

Clear all baselines.

```typescript
await performanceBaselineService.resetAll();
```

### Types

#### `OperationBaseline`

```typescript
interface OperationBaseline {
  label: string; // Operation name
  count: number; // Total samples recorded
  warmupCount: number; // Samples skipped during warm-up
  idleSkippedCount: number; // Samples excluded due to idle time
  p50: number; // Median (ms)
  p95: number; // 95th percentile (ms)
  p99: number; // 99th percentile (ms)
  min?: number; // Minimum observed
  max?: number; // Maximum observed
  mean?: number; // Average of non-warm-up samples
  lastUpdated: number; // Timestamp
  version: number; // Schema version
}
```

#### `RegressionDetectionResult`

```typescript
interface RegressionDetectionResult {
  isRegression: boolean;
  baseline: OperationBaseline | null;
  current: number; // Current measurement (ms)
  delta: number; // Difference from baseline (ms)
  deltaPct: number; // Difference percentage
  threshold: number; // Configured threshold %
  skipped?: boolean; // True if idle measurement
}
```

## Key Concepts

### Percentiles

- **p50 (median):** Typical performance - 50% of measurements are faster, 50% slower
- **p95:** Slow case - 95% of measurements are faster, 5% slower (good for SLOs)
- **p99:** Very slow case - 99% of measurements are faster, 1% slower (outliers)

### Regression Detection

Compares current measurement against configured percentile (default p95):

```
if current > baseline.p95 * (1 + threshold/100)
  → Regression detected
```

Example: p95=1000ms, threshold=20% → alert if current >1200ms

### Warm-up Period

Skips first N samples (default 5) to prevent cold-start, slow network, or cache miss from skewing baseline.

### Idle Time Filtering

Excludes measurements when:
- App is backgrounded (`AppState` inactive/paused)
- User hasn't interacted for >60s (dwell time vs load time)

## Feature Flag Integration

Controlled by `track-performance-baseline` feature flag:

- **Enabled:** Records samples, detects regressions, persists baselines
- **Disabled:** Skips recording, allows queries (comparison still works)

Config via `appsettings.json`:

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

## Integration Points

- **#70 Analytics Buffer:** Queues regression events offline
- **#178 Custom Exporters:** Dispatches regression events to backend/dashboard
- **#208 Network Telemetry:** Logging infrastructure
- **Performance Hooks:** `usePerformance()`, `endMeasure()` call `recordSample()`
- **App State:** Detects background/idle via `react-native`'s `AppState`

## Error Handling

- **Invalid duration:** Negative/NaN values rejected with warning
- **Corrupted storage:** Rebuilds baseline from samples or discards
- **Storage full:** Drops oldest samples, logs warning
- **Feature disabled:** No recording, queries still work

## Privacy and Consent

- Baselines contain only timings (no sensitive data)
- Respects analytics consent (won't export if disabled)
- No PII in stored baselines

## Storage and Versioning

- **Key:** `dnd:performance:baselines` (SecureStorage)
- **Schema version:** Tracks for migrations
- **Size:** ~1KB per operation (100 samples × 10 bytes/sample)
- **Encryption:** All data encrypted via SecureStorage

## Performance Notes

- **Recording:** O(log n) (sorted insert, n ≤ 100)
- **Percentile calc:** O(n) linear scan
- **Regression check:** O(1) comparison
- **Storage:** Async debounced persistence (non-blocking)

## Future Enhancements

- Separate baselines per platform (web/ios/android)
- Separate cold/warm cache baselines
- ML-based anomaly detection
- Adaptive thresholds
- Baseline segments by user cohort