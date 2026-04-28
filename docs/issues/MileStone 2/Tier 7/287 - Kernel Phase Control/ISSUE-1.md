# Issue #287: Kernel Advanced Phase Control

**Status:** Specification (Updated after #286)  
**Tier:** 7 (Kernel & Initialization)  
**Impact:** SMALL-MEDIUM (deployment tuning, faster startup, cleaner offline/degraded modes)  
**Prerequisites:** #286 (Feature Flags & Entitlements Phase) completed; this issue builds on that foundation

---

## 1. Overview

**Problem:** Kernel startup is in much better shape after #286, but advanced phase control is still incomplete. The app now has a real `FEATURE_FLAGS` phase, 8 real startup phases, auth freshness handling, feature-flag snapshot freshness handling, and the old `SYNC` phase is gone. What remains is the shared control layer around those phases.

Current gaps:
- Targeted failure handling (different strategies for network vs. timeout vs. unreachable failures)
- Deployment-specific tuning (some phases should degrade differently instead of sharing one executor behavior)
- Graceful degradation by phase (network down → offline mode; auth slow → retry on-demand)
- Explicit dependency enforcement instead of implicit ordering assumptions
- Fast startup on degraded networks without more one-off phase-specific refactors

**Solution:** Add configurable phase control, explicit failure classification, and conditional phase execution.

**Already completed in #286 and out of scope for this issue:**
- `FEATURE_FLAGS` is already a real kernel phase.
- `SYNC` has already been removed.
- Auth fresh/stale/dead handling already exists.
- Feature-flag snapshot fresh/stale/dead handling already exists.
- Sync splash / deferred full-sync orchestration already exists.

**Performance Baseline (Latest Measured):**
```
Phase Timings (ms, recent measurements):
  config:       922    (5.9%)     ℹ️  Varies by app state
  preload:      1,913  (12.3%)    ✅ Acceptable (fonts/images)
  network:      1,542  (9.9%)     ✅ Network detection + speed classification
  storage:      484    (3.1%)     ✅ Secure storage init (fast)
  services:     3,238  (20.8%)    🔴 Bottleneck #1 (Supabase init + retries)
  registration: 3,215  (20.6%)    🔴 Bottleneck #2 (Server registry + job registration)
  jobSetup:     1,938  (12.4%)    ✅ Improved (was 3.6s, now 1.9s)
  authPhase:    888    (5.7%)     ✅ Auth state evaluation + deferred sync
  featureFlags: 1,412  (9.1%)     ✅ Hybrid sync + hardcoded fallback
  ────────────────────────────────────────────────────────────────────
  End-to-end:   ~15.6 seconds (sequential execution, good network)
```

**Anticipated SLO:** < 12 seconds total for mid-range mobile (good wifi/4G). Services + registration co-dominate startup; network multipliers tune for degraded conditions.

---

## 2. Terminology & Failure Classification

### Failure Types (Determined by Error Code)

**UNREACHABLE** — No retry window during session
- Error codes: `ENOTFOUND`, `EHOSTUNREACH`, `ECONNREFUSED`
- Detection: Airplane mode, network interface down
- Strategy: Skip phase, log as unreachable, no retry (save battery/resources)
- Examples: DNS resolution failed, host not accepting connections

**TIMEOUT** — Retriable on-demand
- Error codes: `ETIMEDOUT`, response timeout (>configured timeout)
- Strategy: Skip phase this session, but retry when:
  - User explicitly triggers a feature requiring that phase (e.g., attempts to sign in)
  - A timer fires (configurable; default: off, on-demand only)
- Examples: Slow network, slow server response

**NON-RECOVERABLE** — App fails immediately
- Phases: `storage`, `preload`, `jobSetup`
- Error types: Any unrecoverable error in these phases
- Strategy: Crash app with safe mode error screen
- Rationale: These phases represent core app state; failure means unsalvageable corruption

**PHASE-SPECIFIC RULES:**
- `jobSetup` — Non-recoverable: failure crashes the app (critical job infrastructure).
- `storage` — Non-recoverable: failure prevents safe startup.
- `preload` — Non-recoverable: failure prevents UI rendering.
- `registration` — Conditional-non-recoverable: verifies required server registrations and job handlers.
  - If any registration entry marked `critical` is missing (or if `kernel.registration.failOnMissingCritical` is enabled), treat the phase as non-recoverable and halt bootstrap.
  - If only non-critical registrations fail, mark the phase as degraded/skipped, emit telemetry, surface a lightweight UI banner about reduced functionality, and schedule background re-registration with exponential backoff.
  - Implementation note: add a `critical: boolean` flag to registry entries (jobs/subscriptions) and surface missing-registration telemetry.
- `network` — Unreachable/timeout → skip (enter offline mode; no network-dependent work).
- `services` — Unreachable/timeout → skip (degrade to offline-capable behavior where possible).
- `auth` — Unreachable/timeout → skip (degraded mode: use local auth state; defer remote sign-in flows to on-demand retries).
- `featureFlags` — Unreachable/timeout → degrade to cached/hardcoded flags and continue startup.
- `config` — Non-recoverable: local config load is foundational for bootstrap.

---

## 3. Phase Dependencies (Explicit Ordering)

```
① config
   └─ No dependencies (loads hardcoded app config; always runs first)

② network
   └─ No dependencies (can always run)

③ preload
   └─ No dependencies (can run in parallel with network)

④ storage
   └─ No dependencies (can run in parallel)

⑤ services
   ├─ Depends on: network (services init requires network check)
   └─ Can be skipped if network failed (→ offline mode)

⑥ jobSetup
   ├─ Depends on: storage, preload (jobs need app state initialized)
   └─ Cannot be skipped; failure = app crash

⑦ auth
  ├─ Depends on: network, services (current startup order)
  └─ Already has its own freshness/deferred-sync behavior from #286

⑧ featureFlags
  ├─ Depends on: network, storage, services, jobSetup, auth (current kernel order)
  ├─ Already uses hybrid sync+async + freshness-aware fallback from #286
  └─ Should remain a real phase even when remote provider is unavailable

⑨ registration (NEW)
  ├─ Depends on: services, jobSetup, auth, featureFlags (bootstraps after core phases)
  ├─ Purpose: Register servers and jobs, finalize bootstrap configuration
  └─ Cannot be skipped; failure = incomplete server registry

⑩ ready
   └─ Final phase after all dependencies complete
```

**Note on Config Phase:**
- Config phase loads `appsettings.json` / `appsettings.dev.json` from disk (zero network calls)
- Remote config is not the concern here; config phase remains local-only
- Registration phase runs after auth + featureFlags (after core phases, before ready)
- Config phase has no dependencies and should run first

---

# 4. Tracks

## **Track A: Configurable Phase Timeouts + Failure Classification**

**Goal:** Generalize phase control across the existing 8-phase kernel by adding per-phase timeout configuration + error classification.

**Files to Create/Modify:**

### SubTrack A-1

1. **`config/appsettings.json`** (production defaults; extend existing kernel config, do not replace it)
  ```json
  {
    "kernel": {
      "featureFlags": {
        "syncTimeoutMs": 2000
      },
      "networkConditions": {
        "description": "Timeout multipliers scale by network speed and type. Applied at runtime based on detected connection. Cellular connections are generally slower than WiFi equivalents.",
        "cellular-2G": 3.5,
        "cellular-3G": 2.5,
        "cellular-4G": 1.5,
        "wifi-2G": 2.5,
        "wifi-3G": 1.5,
        "wifi-4G": 1.0
      },
      "phaseTiming": {
        "config": { "baseMs": 700, "onFailure": "fail" },
        "preload": { "baseMs": 850, "onFailure": "fail" },
        "network": { "baseMs": 1750, "onFailure": "force-skip" },
        "storage": { "baseMs": 700, "onFailure": "fail" },
        "services": { "baseMs": 5500, "onFailure": "force-skip" },
        "jobSetup": { "baseMs": 1500, "onFailure": "fail" },
        "auth": { "baseMs": 3500, "onFailure": "force-skip" },
        "featureFlags": { "baseMs": 2200, "onFailure": "force-skip" },
        "registration": { "baseMs": 4000, "onFailure": "conditional-fail" }
      },
      "description": "Base timeout config (ms) + on-failure strategies. Effective timeout = baseMs * networkConditions[detectedSpeed]. 'fail' = app crash; 'force-skip' = continue without phase. This allows a single config to scale across 2G (slow, rural) to wifi (fast, office) without code changes."
    }
  }
  ```
  
  **Network Multiplier Examples:**
  - On WiFi 4G connection (multiplier 1.0):
    - services phase timeout = 5500ms
    - auth phase timeout = 3500ms
  - On cellular 4G connection (multiplier 1.5):
    - services phase timeout = 8250ms (1.5x slower, safer for cellular)
    - auth phase timeout = 5250ms
  - On cellular 2G connection (multiplier 3.5):
    - services phase timeout = 19250ms (3.5x slower, accommodates rural/slow cellular)
    - auth phase timeout = 12250ms
  - On WiFi 2G connection (multiplier 2.5):
    - services phase timeout = 13750ms
    - auth phase timeout = 8750ms
  - This adaptive approach prevents false timeouts across different network conditions without hardcoding per-platform defaults

2. **`config/appsettings.dev.json`** (dev overrides for faster iteration; merge with existing kernel settings)
  ```json
  {
    "kernel": {
      "networkConditions": {
        "description": "Dev uses higher multipliers for very generous debugging timeouts across all network types",
        "cellular-2G": 5.0,
        "cellular-3G": 4.0,
        "cellular-4G": 2.5,
        "wifi-2G": 4.0,
        "wifi-3G": 2.5,
        "wifi-4G": 1.5
      },
      "phaseTiming": {
        "config": { "baseMs": 500 },
        "preload": { "baseMs": 1500 },
        "network": { "baseMs": 3500 },
        "storage": { "baseMs": 1500 },
        "services": { "baseMs": 8000 },
        "jobSetup": { "baseMs": 3000 },
        "auth": { "baseMs": 5000 },
        "featureFlags": { "baseMs": 4000 },
        "registration": { "baseMs": 6000 }
      },
      "description": "Dev overrides: larger base timeouts + higher network multipliers = much more generous timeouts for easier debugging. Example: services on dev wifi = 8000 * 1.5 = 12000ms, vs. prod = 3000 * 1.0 = 3000ms"
    }
  }
  ```

3. **`config/core/loader.ts`** (config merging + type definition)
  ```typescript
  export interface PhaseTimingConfig {
    baseMs: number;  // Timeout in ms on good network (wifi multiplier 1.0)
    onFailure: 'fail' | 'force-skip';
  }

  export interface NetworkConditionsMultipliers {
    'cellular-2G': number;
    'cellular-3G': number;
    'cellular-4G': number;
    'wifi-2G': number;
    'wifi-3G': number;
    'wifi-4G': number;
  }

  export interface KernelConfig {
    networkConditions: NetworkConditionsMultipliers;
    phaseTiming: Record<string, PhaseTimingConfig>;
  }

  // Adaptive timeout calculation:
  export function getEffectiveTimeout(phaseBaseMs: number, detectedNetworkSpeed: string, multipliers: NetworkConditionsMultipliers): number {
    const multiplier = multipliers[detectedNetworkSpeed as keyof NetworkConditionsMultipliers] ?? 1.0;
    return Math.ceil(phaseBaseMs * multiplier);
  }

  // Merge logic:
  // Start with appsettings.json defaults
  // Override with appsettings.dev.json if dev environment
  // Validate all required phases present
  // Detect network speed at startup, apply multipliers to all phase timeouts
  ```

4. **`config/dev/tools/expected-differences.json`** (document dev vs. prod differences)
  ```json
  {
    "kernel.phaseTiming.*.timeoutMs": "Dev timeouts are 1.5-2x longer than production for easier local debugging"
  }
  ```

### SubTrack A-2: Adaptive Phase Timings Implementation

✅ **COMPLETED** — Adaptive phase scaling based on measured device performance

### Architecture Overview

**Adaptive Timeout Formula:**
```
finalTimeout = phaseTiming[phaseName].baseMs * deviceSlowdownFactor * networkMultiplier
```

Where:
- `phaseTiming[phaseName].baseMs` — Base timeout loaded from config (serves as both timeout AND baseline for slowdown calculation; same for prod+dev)
- `deviceSlowdownFactor` — Measured from config phase duration (e.g., 1.78x if config took 1950ms vs 700ms baseline)
- `networkMultiplier` — Detected network speed (e.g., 1.5x for cellular 4G)

**One-Way Information Flow (No Circular Dependency):**
1. Config phase executes with **hardcoded 3s timeout** (only hardcoded value; cannot load from config yet)
2. Config phase measures: `actualTime / phaseTiming.config.baseMs = deviceSlowdownFactor`
3. Config loads all config including `phaseTiming` (which contains baseMs for all phases)
4. App-kernel receives `deviceSlowdownFactor` and passes to remaining phases
5. Network phase detects network type and calculates `networkMultiplier`
6. All subsequent phases: `finalTimeout = phaseTiming[phaseName].baseMs * deviceSlowdownFactor * networkMultiplier`

### Files Created/Updated

5. **`system/Kernel/phase-executor-constants.ts`** (new file)
   - **`CONFIG_PHASE_TIMEOUT_MS = 3000`** — **ONLY hardcoded timeout value**
     - Why hardcoded: Config phase runs first and loads everything. Cannot load its own timeout from config (circular dependency).
     - Why 3 seconds: Generous for local JSON file load + parsing; allows 3 retries at 2s each for total 6s recovery window.
   - **Everything else loads from config:**
     - `phaseTiming[phaseName].baseMs` for all other phases
     - `phaseTiming[phaseName].baseMs` also serves as baseline for slowdown calculation
     - `networkConditions` multipliers
     - All tuneable without code changes

6. **`system/Kernel/phase-error-classifier.ts`** (new file)
   - Exports `classifyPhaseError(error: unknown): FailureType`
   - Maps error codes to failure types: `'unreachable' | 'timeout' | 'non-recoverable'`
   - Exports `isSkippable(failureType)` and `isTimeout(failureType)` helpers
   - Error classification:
     - **Unreachable:** ENOTFOUND, EHOSTUNREACH, ECONNREFUSED, ENETUNREACH, ECONNRESET
     - **Timeout:** ETIMEDOUT, DEADLINE_EXCEEDED
     - **Non-recoverable:** Everything else (EACCES, ENOSPC, EMFILE, etc.)

7. **`system/Kernel/adaptive-phase-executor.ts`** (new file)
   - Exports `calculateSlowdownFactor(actualDurationMs, baselineMs): number`
     - Example: `(1950 - 700) / 700 = 1.78x` (device took 1.78x longer than baseline)
   - Exports `calculateEffectiveTimeout(phaseName, deviceSlowdown, networkMultiplier): number`
     - Loads `phaseTiming[phaseName].baseMs` from config, applies multipliers
   - Exports `executePhaseWithTimeout(phaseName, fn, deviceSlowdown, networkMultiplier): Promise<PhaseState>`
     - Wraps phase execution with timeout + error classification
     - Returns `PhaseState` with status, reason, retriable flag

8. **`config/appsettings.json` + `config/appsettings.dev.json`** (updated)
   - `kernel.phaseTiming[phaseName].baseMs` serves dual purpose:
     - **Baseline:** Used to calculate device slowdown (actualTime / baseMs)
     - **Timeout:** Multiplied by slowdown + network factors to get final timeout
   - Example values (rounded-up from current baselines for conservative safety margin):
     - config: 700ms, preload: 850ms, network: 1750ms, storage: 700ms
     - services: 5500ms, jobSetup: 1500ms, auth: 3500ms, featureFlags: 2200ms, registration: 4000ms
   - Dev env overrides only `networkConditions` multipliers (1.5-5.0x), NOT baseMs (keeps baseMs consistent with prod)
   - Future tuning: Run app multiple times to average actual times, update baseMs values if needed

9. **`type-definitions/kernel-types.ts`** (updated)
   - Added `PhaseState` interface with adaptive fields:
     ```typescript
     export interface PhaseState {
       status: 'pending' | 'running' | 'success' | 'skipped' | 'failed';
       reason?: 'unreachable' | 'timeout' | 'non-recoverable';
       retriable?: boolean;  // true if timeout (can retry on-demand)
       durationMs?: number;
       error?: Error | string;
     }
     ```

### Adaptive Scaling Logic (App-Kernel Integration)

**To be implemented in `system/Kernel/app-kernel.ts`:**

1. After config phase completes:
   ```typescript
   const configResult = await executePhaseWithTimeout('config', configPhase, 1.0, 1.0);
   const actualConfigDuration = configResult.durationMs;
   const configBaseline = getAppConfig().kernel.phaseTiming.config.baseMs; // e.g., 700
   const deviceSlowdown = calculateSlowdownFactor(actualConfigDuration, configBaseline);
   ```

2. For each remaining phase:
   ```typescript
   // After network phase detects network type
   const networkMultiplier = getAppConfig().kernel.networkConditions[detectedNetworkType];
   
   // Execute with adaptive timeout
   const phaseResult = await executePhaseWithTimeout(
     phaseName,
     phaseFunction,
     deviceSlowdown,      // e.g., 1.78x
     networkMultiplier    // e.g., 1.5x for cellular 4G
   );
   // Final timeout = phaseTiming[phaseName].baseMs * 1.78 * 1.5
   
   // Handle result
   if (phaseResult.status === 'success') {
     // Continue to next phase
   } else if (phaseResult.retriable) {
     // Skip phase but mark for on-demand retry
   } else {
     // Crash: non-recoverable error
     throw phaseResult.error;
   }
   ```

### Phase A-2c (Analytics — Implemented):

**Comprehensive kernel bootstrap analytics tracking in `system/Kernel/adaptive-phase-executor.ts`:**

1. **Device Platform Detection**
   - Automatically detects: web, iOS, Android, Windows, macOS, Linux
   - Uses React Native detection + user agent parsing
   - No additional logic required (happens during analytics init)

2. **Network & Slowdown Tracking**
   - Captures `networkType` (e.g., 'wifi-4G', 'cellular-2G')
   - Captures actual `networkMultiplier` applied
   - Records slowdown as **percentage over baseline**:
     - `percentageOverBaseline: 78` = device is 78% slower (1.78x)
     - Easy to spot outliers without calculation

3. **Phase-by-Phase Analytics**
   - Each phase tracked with:
     - `baselineMs`: expected time from config
     - `timeoutMs`: final calculated timeout (with slowdown + network factors)
     - `actualDurationMs`: actual time taken
     - `status`: success, skipped, or failed
     - `reason`: unreachable, timeout, or non-recoverable (if failed)

4. **Bootstrap Timeline**
   - `bootstrapStartedAt` — Unix timestamp when kernel started
   - `bootstrapCompletedAt` — Unix timestamp when kernel finished
   - `totalDurationMs` — Sum of all phases
   - `timestamp` — When analytics were compiled

**Analytics Types (exported from adaptive-phase-executor.ts):**

```typescript
interface SlowdownAnalytics {
  configActualMs: number;           // e.g., 1950ms
  configBaselineMs: number;         // e.g., 700ms
  factor: number;                   // e.g., 1.78
  percentageOverBaseline: number;   // e.g., 78 (= 78% slower)
}

interface PhaseAnalytics {
  name: string;                      // phase name
  baselineMs: number;                // from config
  timeoutMs: number;                 // calculated including slowdown + network
  actualDurationMs: number;          // actual time
  status: 'success' | 'skipped' | 'failed';
  reason?: 'unreachable' | 'timeout' | 'non-recoverable';
}

interface KernelBootstrapAnalytics {
  platform: string;                  // 'web', 'ios', 'android', etc.
  timestamp: number;                 // When analytics collected
  networkType: string;               // e.g., 'wifi-4G'
  networkMultiplier: number;         // e.g., 1.5
  slowdown: SlowdownAnalytics;       // Device slowdown breakdown
  phases: PhaseAnalytics[];          // All phases
  totalDurationMs: number;           // Sum of phases
  bootstrapStartedAt: number;        // Unix timestamp
  bootstrapCompletedAt: number;      // Unix timestamp
}
```

**Helper Functions:**

- `initializeBootstrapAnalytics()` — Call at kernel start, returns empty analytics object
- `createSlowdownAnalytics(configActualMs, configBaselineMs)` — Generate slowdown breakdown with percentage
- `createPhaseAnalytics(name, phaseState, baselineMs, timeoutMs)` — Create phase analytics from execution
- `finalizeBootstrapAnalytics(analytics)` — Call at kernel end, calculates summary metrics
- `detectDevicePlatform()` — Gets platform string without additional dependencies

**Usage in App-Kernel Integration:**

```typescript
// 1. Start tracking
const analytics = initializeBootstrapAnalytics();

// 2. After config phase completes
const configResult = await executePhaseWithTimeout('config', configPhase, 1.0, 1.0);
const slowdown = calculateSlowdownFactor(configResult.durationMs, 700);
analytics.slowdown = createSlowdownAnalytics(configResult.durationMs, 700);
analytics.phases.push(createPhaseAnalytics('config', configResult, 700, configTimeout));

// 3. After network phase detects type
analytics.networkType = detectedNetworkType; // e.g., 'wifi-4G'
analytics.networkMultiplier = networkMultiplier; // e.g., 1.5

// 4. For each remaining phase
const phaseResult = await executePhaseWithTimeout(phaseName, phaseFunc, slowdown, networkMultiplier);
const baseline = config.kernel.phaseTiming[phaseName].baseMs;
const timeout = calculateEffectiveTimeout(phaseName, slowdown, networkMultiplier);
analytics.phases.push(createPhaseAnalytics(phaseName, phaseResult, baseline, timeout));

// 5. At end of bootstrap
const finalAnalytics = finalizeBootstrapAnalytics(analytics);

// 6. Send to analytics service (respects consent)
await analyticsManager.logKernelBootstrap(finalAnalytics);
```

**Example Analytics Output:**

```json
{
  "platform": "android",
  "timestamp": 1711845673000,
  "networkType": "cellular-4G",
  "networkMultiplier": 1.5,
  "slowdown": {
    "configActualMs": 1950,
    "configBaselineMs": 700,
    "factor": 1.78,
    "percentageOverBaseline": 78
  },
  "phases": [
    { "name": "config", "baselineMs": 700, "timeoutMs": 3000, "actualDurationMs": 1950, "status": "success" },
    { "name": "preload", "baselineMs": 850, "timeoutMs": 2276, "actualDurationMs": 812, "status": "success" },
    { "name": "network", "baselineMs": 1750, "timeoutMs": 4681, "actualDurationMs": 1542, "status": "success" },
    { "name": "storage", "baselineMs": 700, "timeoutMs": 1876, "actualDurationMs": 484, "status": "success" },
    { "name": "services", "baselineMs": 5500, "timeoutMs": 14771, "actualDurationMs": 3238, "status": "success" },
    { "name": "jobSetup", "baselineMs": 1500, "timeoutMs": 4020, "actualDurationMs": 1938, "status": "success" },
    { "name": "auth", "baselineMs": 3500, "timeoutMs": 9381, "actualDurationMs": 888, "status": "success" },
    { "name": "featureFlags", "baselineMs": 2200, "timeoutMs": 5896, "actualDurationMs": 1412, "status": "success" }
  ],
  "totalDurationMs": 12264,
  "bootstrapStartedAt": 1711845660000,
  "bootstrapCompletedAt": 1711845673000
}
```

**Analysis capabilities:**
- Identify outlier devices (percentageOverBaseline > 200%)
- Track platform-specific patterns (iOS vs Android slowness)
- Correlate network type with phase failures
- Adjust phaseTiming baseMs after collecting data
- Spot phases that consistently exceed timeouts

### SubTrack A-2 Acceptance Criteria

✅ **COMPLETED:**
- ✅ Phase baselines loaded from config (not hardcoded)
- ✅ Error code classifier detects unreachable vs. timeout vs. non-recoverable
- ✅ PhaseState interface with reason + retriable flags
- ✅ Adaptive timeout calculator: `baseMs * deviceSlowdown * networkMultiplier`
- ✅ No circular dependency: config phase has hardcoded timeout, measures slowdown, passes to remaining phases
- ✅ Comprehensive analytics tracking (platform, network, all phase timings, slowdown as percentage)

⏳ **PENDING APP-KERNEL INTEGRATION:**
- ⏳ Config phase execution captures duration, calculates device slowdown
- ⏳ Remaining phases use `executePhaseWithTimeout` with adaptive scaling
- ⏳ Network phase integration with network multiplier application
- ⏳ Phase state tracking and error routing

---

## **Track B: Conditional Phase Execution + Dependency Mapping**

**Goal:** Make dependency and skip behavior explicit without redoing the #286 bootstrap architecture.

**Files to Create/Modify:**

1. **`system/Kernel/phase-dependency-graph.ts`** (new file)
   ```typescript
   export const PHASE_DEPENDENCIES: Record<string, string[]> = {
     config: [],
     preload: [],
     network: [],
     storage: [],
     services: ['network'],
     auth: ['network', 'services'],
     jobSetup: ['storage', 'preload'],
     featureFlags: ['network', 'storage', 'services', 'jobSetup', 'auth'],
     ready: ['config', 'preload', 'network', 'storage', 'auth', 'jobSetup', 'featureFlags'],
   };

   export function canRunPhase(phaseName: string, completedPhases: Set<string>): boolean {
     const deps = PHASE_DEPENDENCIES[phaseName] || [];
     return deps.every(dep => completedPhases.has(dep));
   }

   export function isPhaseRequired(phaseName: string, context: PhaseContext): boolean {
     // Conditional logic based on platform/config
     switch (phaseName) {
      case 'auth':
        // Auth remains a real phase even without remote services because it still
        // evaluates local auth state, freshness, and deferred sync requirements.
        return true;
      case 'featureFlags':
        // FEATURE_FLAGS also remains a real phase because it seeds cache/hardcoded
        // flag state even when remote provider access is unavailable.
        return true;
       case 'config':
         // Always required (even if hardcoded)
         return true;
       // ... other phases always required unless error-skipped
       default:
         return true;
     }
   }
   ```

2. **`config/appsettings.json`** (add phase requirements)
   ```json
   {
     "kernel": {
       "phases": {
         "config": { "required": true, "description": "App config loading" },
         "preload": { "required": true, "description": "Font/image preload" },
         "network": { "required": true, "description": "Network state check" },
         "storage": { "required": true, "description": "Secure storage init" },
         "services": { "required": true, "description": "Service initialization" },
         "auth": { "required": true, "description": "Auth state evaluation + deferred sync setup" },
         "jobSetup": { "required": true, "description": "Background job setup" },
         "featureFlags": { "required": true, "description": "Feature flag bootstrap + fallback seeding" }
       }
     }
   }
   ```

3. **`config/appsettings.dev.json`** (dev phase requirements)
   ```json
   {
     "kernel": {
       "phases": {
         "note": "Dev uses same requirements as production"
       }
     }
   }
   ```

4. **`system/Kernel/app-kernel.ts`** (update phase execution order)
   ```typescript
   // Execution strategy:
   // Sequential execution, one phase at a time, respecting dependencies
   // 1. config (first, no dependencies)
   // 2. preload, network, storage (wait for config to complete)
   // 3. services (after network completes)
   // 4. auth (after network + services complete)
   // 5. jobSetup (after storage + preload complete)
   // 6. featureFlags (after all prior phases complete)
   // Strong flow: dependencies enforce order, no parallel complexity

   async function executeKernel(config: AppConfig) {
     let completedPhases: Set<string> = new Set();
     let skippedPhases: Set<string> = new Set();

     // Determine execution order based on dependencies
     const order = determineExecutionOrder(config);

     // Execute sequentially, one phase at a time
     for (const phaseName of order) {
       if (!isPhaseRequired(phaseName, config)) {
         skippedPhases.add(phaseName);
         continue;
       }

       if (!canRunPhase(phaseName, completedPhases)) {
         // Dependency not met → skip or crash
         if (isNonRecoverablePhase(phaseName)) {
           throw new Error(`Phase ${phaseName} cannot run: dependencies not met`);
         }
         skippedPhases.add(phaseName);
         continue;
       }

       try {
         await executePhase(phaseName, config);
         completedPhases.add(phaseName);
       } catch (error) {
         const failureType = classifyPhaseError(error, phaseName);
         handlePhaseFailure(phaseName, failureType, config);
         if (failureType === 'non-recoverable') {
           throw error;
         }
         skippedPhases.add(phaseName);
       }
     }

     return { completed: completedPhases, skipped: skippedPhases };
   }
   ```

5. **`lib/kernel/phase-context.ts`** (new file)
   ```typescript
   export interface PhaseContext {
     platform: 'web' | 'ios' | 'android' | 'desktop';
     isSupabaseConfigured: boolean;
     isRemoteConfigEnabled: boolean;
     environment: 'development' | 'staging' | 'production';
   }

   export function createPhaseContext(): PhaseContext {
     return {
       platform: getPlatform(),
       isSupabaseConfigured: isSupabaseConfigured(),
       isRemoteConfigEnabled: getAppConfig().remoteConfig?.enabled ?? false,
       environment: getEnvironment(),
     };
   }
   ```

**Acceptance Criteria:**
- ✅ Phase dependency graph enforced (can't run auth before network)
- ✅ Auth phase is treated as a real phase even in degraded/offline startup
- ✅ Phase execution respects "required" flag from config
- ✅ Skipped phases don't block dependent phases
- ✅ Dependencies validated before phase execution
- ✅ Config phase runs first (no network dependency)
- ✅ `featureFlags` is modeled as a real phase with internal degradation, not a phase that disappears

### Track B Implementation Complete ✅

**Files Created:**
1. ✅ `system/Kernel/phase-dependency-graph.ts`
   - `getPhaseExecutionOrder()` — Returns phases in topologically sorted execution order
   - `canRunPhase(phaseName, completedPhases)` — Check if phase dependencies are met
   - `isNonRecoverablePhase(phaseName)` — Check if phase failure crashes app
   - `getSkippablePhases()` — Phases that support graceful degradation
   - `validatePhaseGraph()` — Detect circular deps, validate consistency

2. ✅ `lib/kernel/phase-context.ts`
   - `PhaseContext` interface with platform, environment, backend availability
   - `createPhaseContext()` — Build context at kernel startup
   - `updatePhaseContextWithNetwork()` — Add network info after network phase
   - Platform detection: web, iOS, Android, desktop
   - Environment detection: dev, staging, production
   - Supabase/feature flags availability checks

3. ✅ `config/appsettings.json` (updated)
   - Added `kernel.phases` section with metadata for all 9 phases
   - Each phase has `required: true` and `description`
   - Shared baseline phaseTiming values (not overridden in dev)

4. ✅ `config/appsettings.dev.json` (updated)
   - Added `kernel.phases` section (identical to production)
   - Dev environment: only networkConditions multipliers differ (1.5-5.0x)
   - phaseTiming baselines shared with production for consistent testing

**Sequential Execution Flow (implemented):**
```
1. config (no deps)
   ↓
2. preload, network, storage (can run once config completes)
   ↓
3. services (after network)
   ↓
4. auth (after network + services)
   ↓
5. jobSetup (after storage + preload)
   ↓
6. featureFlags (after all above)
   ↓
7. registration (after featureFlags)
   ↓
⏳ Ready for app startup
```

**Next Step:** Integrate into `system/Kernel/app-kernel.ts` to use `getPhaseExecutionOrder()`, `canRunPhase()`, and `PhaseContext` during bootstrap.

---

## **Track B.5: Performance Bottleneck Analysis**

**Goal:** Document performance baseline and identify optimization priorities for future tiers.

**Files to Create:**

1. **`docs/issues/MileStone 2/Tier 7/285 - Kernel Phase Control/PERFORMANCE_ANALYSIS.md`**

   **Current Startup Timeline (latest measurements, good network):**
   ```
   Sequential Execution:
     config        922ms   (5.9%)     ℹ️  Varies by app state
     preload       1,913ms (12.3%)    ✅ Acceptable (fonts/images)
     network       1,542ms (9.9%)     ✅ Network detection + speed classification
     storage       484ms   (3.1%)     ✅ Secure storage init (fast)
     services      3,238ms (20.8%)    🔴 BOTTLENECK #1 (Supabase init + retry logic)
     registration  3,215ms (20.6%)    🔴 BOTTLENECK #2 (Server registry + job registration)
     jobSetup      1,938ms (12.4%)    ✅ Improved (was 3.6s, now 1.9s)
     authPhase     888ms   (5.7%)     ✅ Auth state evaluation + deferred sync
     featureFlags  1,412ms (9.1%)     ✅ Hybrid sync + hardcoded fallback
     ────────────────────────────────────────────────────────────────────────
     TOTAL         ~15.6 seconds
   ```

   **Bottleneck Priorities:**
   1. **services (3238ms)** — Supabase client init + auth token refresh + retry logic.
     - Impact: ~20.8% of total startup.
     - Current: Slowest single phase consistently.
     - Follow-up tier: Profile + optimize Supabase init path (parallelize, reduce retries).
   
   2. **registration (3215ms)** — Server registry + job registration + bootstrap finalization.
     - Impact: ~20.6% of total startup (nearly tied with services).
     - Current: Second bottleneck; newly measured as separate phase.
     - Follow-up tier: Profile registration work for opportunities to defer or parallelize.

   3. **jobSetup (1938ms)** — Job queue worker initialization.
     - Impact: ~12.4% of total startup (improved from earlier 3.6s baseline).
     - Current: Much faster after recent optimizations.
     - Note: Depends on storage + preload; no parallelization opportunity without those.

   **On Slow Connections (with network multipliers active, cellular-2G: 3.5x):**
   - services: 3238 × 3.5 = 11,333ms (extended, but safer for slow networks)
   - registration: 3215 × 3.5 = 11,253ms
   - **Total would reach ~50+ seconds on cellular-2G** — network multipliers significantly extend timeout windows, allowing safe operation on slow networks without code changes.

   **Recommendations:**
   - Track A + B establish the foundation (configurable timeouts + network multipliers).
   - Future tiers should profile services and registration together to find parallel opportunities.
   - Network multiplier system lets product team ship safely to cellular users now without waiting for services/registration optimization.
   - Consider "fast startup" mode for login screens (defer registration/services, eager auth only).

**Acceptance Criteria:**
- ✅ Baseline performance documented with phase breakdown (including registration phase)
- ✅ Bottlenecks identified (services + registration co-dominate)
- ✅ Multiplier system documented as short-term mitigation
- ✅ registration identified as bootstrap server/job registry phase
- ℹ️ Optimization work scoped for future tier (not in Track A/B/C)

---

## **Track C: Registration Phase Bootstrap**

✅ **Failsafe logic removed** — The deprecated 8-second failsafe button (shown after auth check timeout) has been removed from `app/index.tsx`. The timeout was from the previous implementation and is no longer accessible with the new degradation framework.

**Status:** 🔄 **READY FOR IMPLEMENTATION** — Refactored with capability-driven failure tracking

---

### **Registration Phase Strategy**

**Core Principle:** Always attempt to register all items; track failures by required capability for future retry logic and safe mode display.

**Key Insight:** 
- **Jobs always try to register** — They handle their own internal fallback logic
- **Subscriptions are listeners** — They're the mechanism that detects recovery (e.g., `network-recovery-subscription`)
- **Network recovery subscription is NOT optional** — It enables the app to detect when things come back online
- **UI flow:** App continues to run → show safe mode SCREEN listing unavailable features → user sees "Auto-save is temporarily unavailable" with full-screen clarity

**Execution Logic:**

1. **Check degradation state at registration start:**
   ```typescript
   const degradationState = appDegrade.getState();
   const isOffline = !degradationState.capabilities.connectivity.available;
   const hasAnyCapabilityFailure = Object.values(degradationState.capabilities)
     .some(cap => !cap.available);
   ```

2. **For each registration item (jobs + subscriptions):**
   - Always try to register/activate (no skipping)
   - If it fails, capture: `{ item, error, requiredCapability, recoverable }`
   - Don't crash, don't throw — just track the failure
   - Subscriptions (especially recovery listeners) should never fail

3. **Result object structure:**
   ```typescript
   interface RegistrationResult {
     success: boolean;  // true if all critical items registered (currently: all items critical)
     registered: string[];  // ["sync-orchestrator", "network-recovery-subscription", ...]
     skipped: string[];  // Items deliberately skipped (feature-flag disabled, etc.)
     failed: Array<{
       item: string;  // "sync-orchestrator"
       error: string;  // error message
       requiredCapability: DegradeCapability;  // "connectivity" or "database" etc.
       recoverable: boolean;  // true if can retry when capability recovers
     }>;
     failuresSummary?: string;  // "Auto-save unavailable (network required), Sync unavailable"
   }
   ```

4. **Post-bootstrap UI flow (Track C-2):**
   - **For now:** Silent (no UI during bootstrap)
   - **Track C-2 (separate implementation):** If `result.failed.length > 0` and app is not degraded, show safe mode SCREEN
   - Safe mode screen displays: `failuresSummary` + "These features will resume when connection is restored"
   - User can continue (app still functional with reduced features)

5. **Capability-to-Registration Mapping:**

   | Registration Item | Required Capability | Behavior if Down | Recoverable? |
   |---|---|---|---|
   | **sync-orchestrator** job | connectivity | Fails to register (DB sync won't work offline) | ✅ Yes (when connectivity returns) |
   | **network-recovery-retry** job | connectivity | Fails to register (only useful when network recovers) | ✅ Yes |
   | **feature-flags-refresh** job | connectivity | Fails to register (can't sync flags offline) | ✅ Yes |
   | **storage-health-check** job | storage | Fails to register (can't check offline storage) | ✅ Yes |
   | **analytics-network-integration** subscription | connectivity | Fails (analytics flushes only on network) | ✅ Yes |
   | **network-recovery-subscription** | — | ⚠️ **MUST NOT FAIL** (it detects recovery) | ✅ Always |
   | **sync-recovery-subscription** | — | Placeholder (not ready yet) | — |
   | **job-recovery-subscription** | — | Placeholder (not ready yet) | — |
   | **service-health-subscription** | — | Placeholder (not ready yet) | — |

---

### **Implementation Pseudocode**

```typescript
async function registrationPhase(): Promise<RegistrationResult> {
  const degradation = appDegrade.getState();
  const { logger } = await import("@/lib/utils");
  
  const result: RegistrationResult = {
    success: true,
    registered: [],
    skipped: [],
    failed: [],
  };

  const queue = getJobQueue();
  const failedFeatures: string[] = [];

  // Register all job handlers (ALWAYS TRY, never skip)
  for (const job of CORE_JOBS) {
    try {
      await job.register(queue);
      result.registered.push(job.name);
      logger.category("bootstrap").debug(`Job registered: ${job.name}`);
    } catch (error) {
      const errorMsg = (error as Error).message;
      // Map error to required capability
      let requiredCapability: DegradeCapability = "connectivity";  
      if (job.name === "storage-health-check") requiredCapability = "storage";
      
      result.failed.push({
        item: job.name,
        error: errorMsg,
        requiredCapability,
        recoverable: true,
      });
      failedFeatures.push(`${job.name} (requires ${requiredCapability})`);
      
      logger.category("bootstrap").warn(`Job registration failed: ${job.name}`, {
        error: errorMsg,
        requiredCapability,
      });
    }
  }

  // Activate all subscriptions (ALWAYS TRY, never skip)
  for (const sub of SUBSCRIPTIONS) {
    try {
      await sub.activate();
      result.registered.push(sub.name);
      logger.category("bootstrap").debug(`Subscription activated: ${sub.name}`);
    } catch (error) {
      const errorMsg = (error as Error).message;
      
      // Special handling: network-recovery-subscription MUST NOT FAIL
      if (sub.name === "network-recovery-subscription") {
        logger.category("bootstrap").error(
          "CRITICAL: Network recovery subscription failed to activate",
          { error: errorMsg }
        );
        result.success = false;
        // This is a critical failure — still continue but mark as failed
      }
      
      result.failed.push({
        item: sub.name,
        error: errorMsg,
        requiredCapability: sub.name.includes("network") ? "connectivity" : "unknown",
        recoverable: !sub.name.includes("recovery"),  // recovery subs always need to stay active
      });
      failedFeatures.push(`${sub.name}`);
      
      logger.category("bootstrap").warn(`Subscription activation failed: ${sub.name}`, {
        error: errorMsg,
      });
    }
  }

  // Build summary for safe mode screen
  if (result.failed.length > 0) {
    result.failuresSummary = buildFailuresSummary(result.failed);
  }

  logger.category("bootstrap").info(
    `Registration complete: ${result.registered.length} registered, ${result.failed.length} failed`
  );

  return result;
}

function buildFailuresSummary(failed: RegistrationResult['failed']): string {
  const grouped = new Map<string, string[]>();
  
  for (const item of failed) {
    const key = item.requiredCapability;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(humanReadableName(item.item));
  }

  const summaries: string[] = [];
  for (const [capability, items] of grouped) {
    summaries.push(`${items.join(", ")} (requires ${capability})`);
  }
  
  return summaries.join("; ");
}

function humanReadableName(itemName: string): string {
  // sync-orchestrator → "Auto-save", network-recovery-retry → "Network Retry", etc.
  const map: Record<string, string> = {
    "sync-orchestrator": "Auto-save",
    "network-recovery-retry": "Network Retry",
    "feature-flags-refresh": "Feature Updates",
    "storage-health-check": "Storage Check",
    "analytics-network-integration": "Analytics",
  };
  return map[itemName] || itemName;
}
```

---

### **Acceptance Criteria**

- ✅ Registration phase checks degradation state at start
- ✅ All jobs and subscriptions attempt to register (no skipping)
- ✅ Failures are caught and tracked with: name, error, requiredCapability, recoverable flag
- ✅ No throwing/crashing — result object captures everything
- ✅ Recovery listeners (network-recovery-subscription) log critical errors but don't crash if they fail
- ✅ Result includes `failuresSummary` for safe mode screen display
- ✅ Silent during bootstrap (no toasts/modals, just logging)
- ✅ TypeScript strict mode
- ✅ Link to MISSING_INTEGRATION.md for deferred items (Track C-1)

---

## **SubTrack C-1: Documentation of Deferred Integrations**

**Status:** ⏸ **DEFERRED** — Implementation in future tier, but documented now for visibility

**Goal:** Create `docs/issues/MileStone 2/Tier 7/287 - Kernel Phase Control/MISSING_INTEGRATION.md` to track:
1. Placeholder subscriptions not yet implemented
2. Retry logic system needed
3. Components using jobs/subscriptions
4. Safe mode screen display integration
5. Other deferred work

**File to Create:**
- `docs/issues/MileStone 2/Tier 7/287 - Kernel Phase Control/MISSING_INTEGRATION.md`

**Contents (Comprehensive Tracking):**

```markdown
# Missing Integrations for Track C Registration

This document tracks work deferred from the registration phase bootstrap but needed for complete functionality.

## Placeholder Subscriptions (Waiting for Dependencies)

### 1. sync-recovery-subscription
- **Status:** Placeholder in `lib/subscriptions/registry.ts`
- **Requirement:** Sync manager must expose recovery/drain success events
- **Implementation:** Wire success to `reportRecovery('sync', 'queue drained')`
- **Related:** Track 7 Post-Registration requirement
- **Impact:** Without this, sync failures won't trigger recovery notifications

### 2. job-recovery-subscription
- **Status:** Placeholder in `lib/subscriptions/registry.ts`
- **Requirement:** Job queue must emit retry success events
- **Implementation:** Wire job retry success to `reportRecovery('backgroundJobs', 'retry succeeded')`
- **Related:** Track 7 Post-Registration requirement
- **Impact:** Failed jobs won't auto-recover when conditions improve

### 3. service-health-subscription
- **Status:** Placeholder in `lib/subscriptions/registry.ts`
- **Requirement:** Service health monitoring (database, auth, storage) infrastructure
- **Implementation:** Wire service readiness checks to `reportRecovery(capability, 'service ready')`
- **Related:** Track 7 Post-Registration requirement
- **Impact:** Service failures won't be detected as recovered

## Retry Logic System

### Planned Retry Architecture (Track 7 Post-Registration)

Current registration tracks failures in `RegistrationResult.failed[]` with `recoverable: true` flag.

**Needed:**
1. **Storage:** Store failed registrations in `SecureStorage` (key: `STORAGE_KEYS.registrationFailures`)
2. **Subscription:** On degradation recovery (via `reportRecovery()`), scan stored failures
3. **Retry executor:** For each recoverable failure:
   - Re-attempt registration with new retry logic
   - Log results (success = remove from storage, failure = update attempt count)
   - Emit analytics event (retry attempt, success/failure)
4. **Manual trigger:** Expose "Retry Registration" action in Settings screen (Track 9)

**Pseudocode:**
```typescript
// When reportRecovery('connectivity', ...) is called
async function retryFailedRegistrations(capability: DegradeCapability) {
  const stored = await SecureStorage.get(STORAGE_KEYS.registrationFailures);
  const relevantFailures = stored.filter(f => f.requiredCapability === capability);
  
  for (const failure of relevantFailures) {
    try {
      // Re-attempt registration
      if (isJob(failure.item)) {
        await failure.item.register(queue);
      } else {
        await failure.item.activate();
      }
      // Success: remove from storage
      await removeFromStorage(failure.item);
    } catch (error) {
      // Failure: update attempt count, keep trying
      await updateRetryAttempt(failure.item, error);
    }
  }
}
```

## Components Using Jobs/Subscriptions

### Job Consumers (Where jobs are enqueued)

1. **Sync Orchestrator Job** (`sync-orchestrator`)
   - **Enqueued by:** `lib/sync/sync-manager.ts` (periodic sync, on app resume)
   - **Used in:** World sync flows, settings screen sync actions
   - **Impact on UI:** Sync status indicators in main panel, world list

2. **Network Recovery Job** (`network-recovery-retry`)
   - **Enqueued by:** `lib/network/network-state-machine.ts` (when network recovers)
   - **Used in:** Automatic retry of failed network operations
   - **Impact on UI:** Toast/banner showing "Syncing..." during recovery

3. **Storage Health Check Job** (`storage-health-check`)
   - **Enqueued by:** `lib/storage/storage-validator.ts` (periodic, or on corruption detected)
   - **Used in:** Settings screen, diagnostic panels
   - **Impact on UI:** Storage health indicator in settings

4. **Feature Flags Refresh Job** (`feature-flags-refresh`)
   - **Enqueued by:** `lib/feature-flags/feature-flags-manager.ts` (periodic)
   - **Used in:** Feature detection, A/B testing decision updates
   - **Impact on UI:** Dynamic feature availability changes (e.g., "Advanced Maps" toggle appears mid-session)

### Subscription Consumers (Where subscriptions are observed)

1. **Analytics Network Integration** (`analytics-network-integration`)
   - **Observed by:** `lib/analytics/analytics-manager.ts`
   - **Action on network recovery:** Flush buffered events
   - **Used in:** Event trending, usage analytics

2. **Network Recovery Subscription** (`network-recovery-subscription`)
   - **Observed by:** `lib/error/degrade-manager.ts`
   - **Action when network online:** Call `reportRecovery('connectivity')`
   - **Used in:** Recovery notifications, auto-retry triggers

3. **Sync Recovery Subscription** (`sync-recovery-subscription`) [PLACEHOLDER]
   - **Observed by:** `lib/sync/sync-manager.ts`
   - **Action on sync drain:** Call `reportRecovery('sync')`
   - **Used in:** Sync status UI, notification badges

### UI Components Affected by Failed Registrations

1. **Safe Mode Screen** (`Screens/SafeMode.tsx` or similar)
   - **Displays:** `RegistrationResult.failuresSummary`
   - **Shows:** Full-screen list of unavailable features with reasons
   - **Implementation:** Track C-2 (Show safe mode screen when registrations fail)

2. **Main Panel** (`Screens/main-panels/MainPanel.tsx`)
   - **Affected if:** sync-orchestrator or feature-flags-refresh fails
   - **Shows:** Dimmed sync indicators, disabled features

3. **Settings Screen** (`Screens/settings/`)
   - **Affected if:** storage-health-check or sync fails
   - **Shows:** Storage health status, sync history, retry buttons (Track 9)

4. **World List** (`Screens/select/WorldSelector.tsx`)
   - **Affected if:** feature-flags-refresh fails
   - **Shows:** Potentially missing features, limited access indicator

## Safe Mode Screen Display (Track C-2)

**File to Create:** `lib/kernel/safe-mode-screen-builder.ts`

**Responsibility:**
- Build safe mode entry with `RegistrationResult.failuresSummary`
- Format human-readable list of unavailable features
- Suggest recovery actions ("Check connection", "Retry")

**Pseudocode:**
```typescript
export function buildSafeModeFromRegistration(result: RegistrationResult): SafeModeState {
  if (result.failed.length === 0) return null;
  
  const reason = SafeModeReason.REGISTRATION_FAILURES;
  return createSafeModeState(reason, {
    failures: result.failed,
    summary: result.failuresSummary,
    recoveryActions: ['Check connection', 'Retry registration'],
  });
}
```

**Where to call:** In `system/Kernel/registration-phase.ts`, after phase completes:
```typescript
const result = await registrationPhase();
if (result.failed.length > 0) {
  const safeMode = buildSafeModeFromRegistration(result);
  setSafeMode(safeMode);
}
```

## Other Deferred Work

### 1. Registration Result Serialization
- **Need:** Store `RegistrationResult` in safe mode state for debugging
- **Why:** Help diagnose which registrations failed and why
- **Where:** `lib/error/error-types.ts` → add to `SafeModeState.metadata`

### 2. Analytics for Registration Failures
- **Need:** Track which items fail, how often, on which devices/networks
- **Events to emit:**
  - `registration.item_failed` (item, capability, error_code)
  - `registration.retry_attempted` (item, attempt_number, success)
  - `registration.recovery_detected` (capability, time_to_recovery_ms)

### 3. Telemetry Dashboard for Registrations
- **Need:** Backend dashboard showing registration failure patterns
- **Why:** Identify systemic issues (e.g., "78% of iOS users fail storage-health-check")
- **Defer to:** Separate telemetry tier (not critical)

### 4. Configuration for Criticality Override
- **Need:** Config option to mark items as non-critical (never crash safe mode)
- **Example:** `config/appsettings.json`
  ```json
  {
    "kernel": {
      "registrationCriticality": {
        "storage-health-check": "optional",
        "analytics-network-integration": "optional"
      }
    }
  }
  ```
- **Defer to:** Future tier (all items currently critical)

---

## Implementation Order (Future Tiers)

1. **Immediate (Track C-2):** Safe mode screen display + setFailuresSummary integration
2. **Track 7 Post-Registration:** Placeholder subscriptions, retry logic system
3. **Track 9 (Settings):** Manual "Retry Registration" action
4. **Future:** Analytics + telemetry + configuration overrides
```

---

### **Acceptance Criteria (Track C-1)**

- ✅ `MISSING_INTEGRATION.md` created with all deferred items
- ✅ Placeholder subscriptions listed with dependency requirements
- ✅ Retry logic pseudocode documented
- ✅ Components using jobs/subscriptions mapped
- ✅ Safe mode screen integration location documented
- ✅ Other deferred work listed with defer reasons
- ✅ Implementation order clear

---

## **Track C-2: Safe Mode Screen Integration (DEFERRED)**

**Status:** ⏳ **PENDING** — Awaits Track C implementation + safe mode system readiness

**Goal:** Display safe mode screen when registrations fail

**Implementation (High-Level):**
1. In `system/Kernel/registration-phase.ts`, after registrations complete:
   ```typescript
   const result = await registrationPhase();
   if (result.failed.length > 0 && !appDegrade.getState().degraded) {
     const safeMode = buildSafeModeFromRegistration(result);
     setSafeMode(safeMode);  // Shows full-screen UI with failures
   }
   ```

2. Safe mode screen displays:
   - "The following features are temporarily unavailable:"
   - List: "Auto-save", "Feature Updates", "Network Retry", etc.
   - Reason: "(requires network connection)"
   - Action: "Continue to App" or "Retry Now"

**Dependencies:**
- Track C implementation must complete first
- Safe mode screen component must exist
- SafeModeState must support `failures` metadata

**Next Step:** Implement in separate smaller PR after Track C

---

**Dependencies:**
- `services`, `jobSetup`, `auth`, `featureFlags` must all complete first (execution order ensures this)
- Needs degradation state from `appDegrade` (already wired)
- Needs phase context to know which degradations are active
- Needs `MISSING_INTEGRATION.md` for visibility into deferred items

**Next step:** Implement Track C in registration-phase.ts after Tracks A, B, D are merged. Create MISSING_INTEGRATION.md simultaneously for deferred tracking.

---

## **Track D: App-Kernel Integration**

**Goal:** Pull Tracks A & B together into `system/Kernel/app-kernel.ts`. Wire up dependency checking, adaptive timeouts, error classification, analytics collection, and graceful degradation rules.

**Status:** 🔄 **IN PROGRESS** (ready to implement after this issue update)

**Files to Create/Modify:**

1. **`system/Kernel/app-kernel.ts`** (major refactor)

   **Current responsibilities:** Execute phases in sequence.
   
   **New responsibilities:** 
   - Call `createPhaseContext()` at startup (detect platform/environment)
   - Validate phase graph with `validatePhaseGraph()`
   - Determine execution order with `getPhaseExecutionOrder()`
   - For each phase:
     - Check if dependencies met with `canRunPhase(phaseName, completedPhases)`
     - If not met: decide crash vs. skip based on `isNonRecoverablePhase(phaseName)`
     - Calculate adaptive timeout: `calculateEffectiveTimeout(phaseName, deviceSlowdown, networkMultiplier)`
     - Execute with timeout + error classification: `executePhaseWithTimeout(phaseName, phaseFunc, deviceSlowdown, networkMultiplier)`
     - Classify error: `classifyPhaseError(error)` to determine if retriable
   - Collect analytics throughout bootstrap
   - Forward analytics to `lib/analytics/analytics-manager.ts` at end (respects consent)

2. **Phase Execution Loop (Pseudocode)**

   ```typescript
   // 1. Initialize
   const context = createPhaseContext();  // platform, environment, device type
   const analytics = initializeBootstrapAnalytics();
   validatePhaseGraph();  // Ensure no circular dependencies

   // 2. Set execution order based on dependencies
   const order = getPhaseExecutionOrder();
   const completedPhases = new Set<PhaseName>();
   let deviceSlowdown = 1.0;
   let networkMultiplier = 1.0;

   // 3. Execute config phase (hardcoded timeout, calculates slowdown)
   const configResult = await executePhaseWithTimeout('config', configPhase, 1.0, 1.0);
   
   if (configResult.status === 'success') {
     const configBaseline = appConfig.kernel.phaseTiming.config.baseMs;
     deviceSlowdown = calculateSlowdownFactor(configResult.durationMs, configBaseline);
     analytics.slowdown = createSlowdownAnalytics(configResult.durationMs, configBaseline);
   } else {
     // Config failure is non-recoverable
     throw new Error('Failed to load app config');
   }
   
   completedPhases.add('config');
   analytics.phases.push(createPhaseAnalytics('config', configResult, configBaseline, 3000));

   // 4. Execute remaining phases
   for (const phaseName of order) {
     if (phaseName === 'config') continue;  // Already done

     // Check dependencies
     if (!canRunPhase(phaseName, completedPhases)) {
       if (isNonRecoverablePhase(phaseName)) {
         // Crash: critical phase cannot run
         throw new Error(`Cannot run phase ${phaseName}: dependencies not met`);
       } else {
         // Skip: degradable phase cannot run
         analytics.phases.push({
           name: phaseName,
           status: 'skipped',
           reason: 'dependencies-not-met',
         });
         continue;
       }
     }

     // Execute with adaptive timeout
     const baseline = appConfig.kernel.phaseTiming[phaseName].baseMs;
     const timeout = calculateEffectiveTimeout(phaseName, deviceSlowdown, networkMultiplier);
     
     const result = await executePhaseWithTimeout(
       phaseName,
       phaseFunc[phaseName],
       deviceSlowdown,
       networkMultiplier
     );

     // Collect analytics
     analytics.phases.push(createPhaseAnalytics(phaseName, result, baseline, timeout));

     // Handle result
     if (result.status === 'success') {
       completedPhases.add(phaseName);
       
       // Special: After network phase, detect network type for multiplier
       if (phaseName === 'network') {
         networkMultiplier = appConfig.kernel.networkConditions[detectedNetworkType];
         analytics.networkType = detectedNetworkType;
         analytics.networkMultiplier = networkMultiplier;
       }
     } else if (result.reason === 'timeout' || result.retriable) {
       // Skippable phase failed but can retry on-demand
       if (getSkippablePhases().has(phaseName)) {
         // Log and continue
         logger.category('bootstrap').warn(
           `Phase ${phaseName} timed out but is skippable. Will retry on-demand.`
         );
       } else {
         // Non-retriable timeout on a critical phase = crash
         throw result.error;
       }
     } else {
       // Non-recoverable error
       throw result.error;
     }
   }

   // 5. Finalize analytics
   const finalAnalytics = finalizeBootstrapAnalytics(analytics);

   // 6. Send to analytics service
   await analyticsManager.logKernelBootstrap(finalAnalytics);

   // Ready!
   return { success: true, analytics: finalAnalytics };
   ```

**Acceptance Criteria:**
- ✅ `app-kernel.ts` wires all Track A & B helpers (dependency graph, error classifier, adaptive executor, phase context)
- ✅ Sequential phase execution with dependency validation
- ✅ Each phase executed with adaptive timeout (slowdown + network multiplier)
- ✅ Error classification determines crash vs. skip vs. retry
- ✅ Analytics collected during bootstrap (platform, network, slowdown, all phase timings)
- ✅ Non-recoverable phases crash immediately; skippable phases log and continue
- ✅ Analytics sent to `lib/analytics/analytics-manager.ts` (respects consent via middleware)
- ✅ **NO analytics written after bootstrap completes** (analytics only track bootstrap, not ongoing operation)
- ✅ All code lints and passes TypeScript strict mode

---



## 5. Implementation Order

1. **Track A** (Config + Classifier + Network Multipliers) — ✅ COMPLETED
   - Config files updated with baseMs + network multipliers
   - Error classifier created
   - Adaptive phase executor with timeout calculation + network detection

2. **Track B** (Dependencies + Conditional) — ✅ COMPLETED
   - Dependency graph created
   - Phase context detection (platform, environment)
   - Conditional/degraded phase execution rules

3. **Track D** (App-Kernel Integration) — 🔄 NEXT
   - Integrate Tracks A & B into `system/Kernel/app-kernel.ts`
   - Implement sequential phase execution with dependency validation
   - Wire adaptive timeouts + error classification
   - Collect analytics throughout bootstrap
   - Send analytics to `lib/analytics/analytics-manager.ts` (bootstrap only)

4. **Track C** (Registration Phase) — ⏸ DEFERRED
   - Pending finalization of degradation strategy
   - Will implement in follow-up tier with clear failure recovery paths

5. **Track E** (Degraded Path Audit) — 📋 DOCUMENT
   - Audit current degraded paths
   - Document gaps
   - Scope comprehensive degraded path tier for future work

---

## 6. Config Changes Summary

### `appsettings.json` additions:
```json
{
  "kernel": {
    "networkConditions": {
      "description": "Timeout multipliers by network speed and type (cellular vs WiFi). Detected at startup.",
      "cellular-2G": 3.5,
      "cellular-3G": 2.5,
      "cellular-4G": 1.5,
      "wifi-2G": 2.5,
      "wifi-3G": 1.5,
      "wifi-4G": 1.0
    },
    "phaseTiming": {
      "config": { "baseMs": 1000, "onFailure": "fail" },
      "preload": { "baseMs": 1000, "onFailure": "fail" },
      "network": { "baseMs": 2000, "onFailure": "force-skip" },
      "storage": { "baseMs": 1000, "onFailure": "fail" },
      "services": { "baseMs": 3000, "onFailure": "force-skip" },
      "jobSetup": { "baseMs": 5000, "onFailure": "fail" },
      "auth": { "baseMs": 2000, "onFailure": "force-skip" },
      "featureFlags": { "baseMs": 2000, "onFailure": "force-skip" }
    },
    "phases": {
      "config": { "required": true },
      "preload": { "required": true },
      "network": { "required": true, "note": "Network speed detected here; feeds multiplier calculation" },
      "storage": { "required": true },
      "services": { "required": true },
      "auth": { "required": true },
      "jobSetup": { "required": true },
      "featureFlags": { "required": true }
    }
  }
}
```

### `appsettings.dev.json` overrides:
```json
{
  "kernel": {
    "networkConditions": {
      "description": "Dev uses higher multipliers for generous debugging timeouts across all network types",
      "cellular-2G": 5.0,
      "cellular-3G": 4.0,
      "cellular-4G": 2.5,
      "wifi-2G": 4.0,
      "wifi-3G": 2.5,
      "wifi-4G": 1.5
    },
    "phaseTiming": {
      "config": { "baseMs": 5000 },
      "preload": { "baseMs": 3000 },
      "network": { "baseMs": 5000 },
      "storage": { "baseMs": 3000 },
      "services": { "baseMs": 8000 },
      "jobSetup": { "baseMs": 15000 },
      "auth": { "baseMs": 5000 },
      "featureFlags": { "baseMs": 5000 }
    }
  }
}
```

### `expected-differences.json`:
- Phase baseMs differ (dev is slower for debugging: 5-15s base vs. prod 1-5s base)
- Network multipliers differentiate by type+speed (cellular-2G up to 3.5x, wifi-4G at 1.0x baseline)
- Effective timeout = baseMs × detected_network_conditions[type-speed]
- Example: services on prod wifi-4G = 3000ms; on prod cellular-4G = 3000 * 1.5 = 4500ms; on prod cellular-2G = 3000 * 3.5 = 10500ms
- Dev multipliers are uniformly higher for generous debugging (wifi-4G at 1.5x, cellular-2G at 5.0x)

---

## 7. File Status

### Track A & B: Completed Files

**New Files Created:**
- ✅ `system/Kernel/phase-helpers/phase-executor-constants.ts` (hardcoded CONFIG_PHASE_TIMEOUT_MS = 3000)
- ✅ `system/Kernel/phase-helpers/phase-error-classifier.ts` (classifyPhaseError, isSkippable, isTimeout)
- ✅ `system/Kernel/phase-helpers/adaptive-phase-executor.ts` (calculateSlowdownFactor, calculateEffectiveTimeout, executePhaseWithTimeout, analytics helpers)
- ✅ `system/Kernel/phase-helpers/phase-dependency-graph.ts` (PHASE_DEPENDENCIES map, canRunPhase, getPhaseExecutionOrder, isNonRecoverablePhase, getSkippablePhases, validatePhaseGraph)
- ✅ `system/Kernel/phase-helpers/phase-context.ts` (createPhaseContext, updatePhaseContextWithNetwork, platform/environment detection)

**Modified Files:**
- ✅ `config/appsettings.json` (added kernel.networkConditions + kernel.phaseTiming + kernel.phases metadata)
- ✅ `config/appsettings.dev.json` (added kernel section with higher multipliers + kernel.phases)
- ✅ `type-definitions/kernel-types.ts` (added/updated PhaseState interface)

### Track D: In Progress (App-Kernel Integration)

**Files to Modify:**
- [ ] `system/Kernel/app-kernel.ts` (major refactor: integrate phase-helpers, implement sequential execution with dependency validation, adaptive timeouts, error classification, analytics collection)

### Track C: Deferred (Registration Phase)

**Status:** ⏸ **DEFERRED** — Pending degradation strategy finalization
- Registration phase implementation deferred to follow-up tier
- All dependency graph preparation complete; ready to integrate once degradation paths determined

### Track E: Documentation (Degraded Path Audit)

**Files to Create:**
- [ ] `docs/issues/MileStone 2/Tier 7/287 - Kernel Advanced Phase Control/DEGRADED_PATH_AUDIT.md` (audit findings, gaps, follow-up scope)

---

## 8. Testing Strategy

**Manual Testing Checklist:**
- [ ] Network detection correctly identifies cellular-2G, cellular-3G, cellular-4G, wifi-2G, wifi-3G, wifi-4G
- [ ] Bootstrap app on cellular WiFi 4G: services timeout ~3s, total ~10s
- [ ] Bootstrap app on cellular 4G LTE: services timeout ~4.5s (3000 * 1.5)
- [ ] Bootstrap app on cellular 2G EDGE: services timeout ~10.5s (3000 * 3.5)
- [ ] Bootstrap app on WiFi 4G: services timeout ~3s (baseline)
- [ ] Bootstrap app on dev config cellular 2G: services timeout ~40s (8000 * 5.0), extremely generous
- [ ] Simulate network timeout: network phase should skip/degrade, multipliers shouldn't crash
- [ ] Simulate network timeout: network phase should skip/degrade, config phase should still succeed locally
- [ ] Simulate unreachable network: network → offline mode, multiplier calculation shouldn't crash
- [ ] Simulate services timeout: services → skipped/degraded, auth/featureFlags honor current fallback rules
- [ ] Simulate storage failure: app crashes with safe mode screen
- [ ] Verify dependency ordering (auth doesn't run before network)
- [ ] Verify `featureFlags` still seeds cache/hardcoded values when remote provider is unavailable
- [ ] Test error classification (ENOTFOUND → unreachable, ETIMEDOUT → timeout)
- [ ] Test network multiplier calculation for all 4 speeds (2G, 3G, 4G, wifi)

**Automated Testing:**
- Unit tests for `system/Kernel/phase-error-classifier.ts` (error code → failure type)
- Unit tests for `phase-dependency-graph.ts` (dependency validation)
- Integration test for kernel execution order

---

## 9. Success Criteria

✅ **Track A:**
- Per-phase baseMs configurable (production: 1-5s base, dev: 3-15s base)
- Network multiplier system scales timeouts by detected connection type+speed (cellular-2G: 3.5x up to wifi-4G: 1.0x baseline)
- Network multiplier calculation works across all 6 connection types without crashes
- Cellular connections recognized as distinct from WiFi (generally slower, higher multipliers)
- Error codes classified to failure types (unreachable/timeout/non-recoverable)
- Phase execution respects effective timeout (baseMs × multiplier) + routes failures correctly
- Production app works safely on cellular-2G (extended but adaptive timeouts) without code changes
- registration phase configured with timeout for graceful degradation

✅ **Track B:**
- Phase dependencies enforced (network before services, services before auth, auth before featureFlags, featureFlags before registration)
- Auth modeled correctly as a real phase with degraded behavior
- featureFlags modeled correctly as a real phase with internal fallback behavior
- registration modeled as bootstrap server/job registry phase
- Independent phases can run in parallel

✅ **Track B.5:**
- Performance baseline documented with phase breakdown (including registration phase)
- Bottlenecks identified (services 20.8%, registration 20.6%, jobSetup 12.4%)
- Network multiplier system explained as short-term mitigation (allows shipping to slow networks now)
- registration identified as bootstrap server/job registry phase
- Future optimization work scoped for next tier (profile services + registration for parallelization opportunities)

✅ **Track C:**
- Current degraded paths audited and documented
- Gaps identified with specific examples
- Degraded path telemetry needs identified
- Follow-up tier scoped for comprehensive degraded path implementation

---

## 10. Related Issues

- **#265** (Kernel Phase-Aware Provider Pattern) — Provides UIBlocker infrastructure used by this issue
- **#283** (Kernel Phase Progress + Messages) — Provides progress tracking; #285 extends with failure handling
- **#286** (Feature Flags & Entitlements Phase) — Completed prerequisite. Provides the real `FEATURE_FLAGS` phase, auth/flag freshness handling, and cleanup this issue now builds on
- **#172** (Degraded & Safe Mode) — Related: degraded paths tie into this issue's failure handling
- **Future Tier: Comprehensive Degraded Paths** — Follow-up work identified in Track C

---

## 11. Notes

- **Config phase is local-only** — Reads `appsettings.json` from disk; zero network dependency
- **Feature flags are already a proper kernel phase (#286)** — Runs last (after AUTH, before READY) with hybrid sync+async model
- **Auth freshness and feature-flag freshness are already done** — This issue should not re-spec them
- **Sync splash orchestration is already done** — This issue should focus on shared phase control semantics, not more auth/bootstrap flow refactors
- **jobSetup failure = permanent session failure** — No on-demand retry; app must restart
- **Error code classification is industry-standard** — ENOTFOUND, ETIMEDOUT, etc. are well-defined
- **Timeout config per-phase allows tuning** — Web might need slower timeouts (slow networks), desktop faster (local)
- **Dependency graph is strict — prevents subtle ordering bugs**
- **Config differences (dev vs. prod) are documented** — Makes it clear why dev is slower
- **featureFlags phase has most dependencies** — Depends on network, storage, services, jobSetup, auth
- **Do not collapse auth/featureFlags into "optional" phases** — both still provide meaningful local/degraded startup behavior even when remote services are unavailable
- **Network speed is detected during network phase** — Feeds into multiplier calculation for all subsequent phases
- **Cellular vs WiFi distinction** — System distinguishes between 6 network types (cellular-2G/3G/4G, wifi-2G/3G/4G) to apply appropriate timeout scaling
- **Effective timeout = baseMs × multiplier** — Allows product to ship to 2G users now with extended timeouts, no code duplication
- **services + registration co-dominate startup** — Combined ~41% of startup time. Network multipliers allow safe degradation on slow networks.