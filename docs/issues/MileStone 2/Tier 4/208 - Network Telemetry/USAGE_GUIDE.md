# Network Telemetry — Usage Guide

Purpose: a concise how-to for using `lib/network` telemetry in the app: where to call functions, what hooks to subscribe to, and configuration points.

1) Where the code lives
- Primary runtime: `lib/network/network-telemetry.ts` (emits telemetry)
- Detection and subscription: `lib/network/network-detection.ts` (provides `NetworkDetection` singleton and `useNetworkStatus` hook)
- Error capture integration: `lib/api/request-manager.ts` (calls into telemetry on request failures)
- Documentation and schema: `docs/issues/MileStone 2/Tier 4/208 - Network Telemetry/TELEMETRY_SCHEMA.md` and `lib/network/README.md`

2) Key functions & when to call them
- `startHealthCheckInterval(intervalMs?: number)`
  - Call: during app bootstrap once network subsystem is ready (e.g., in `AppKernelProvider` when `kernel.phases.networkReady` is true).
  - Purpose: start periodic health checks (default 5 minutes). The first health check emits regardless of sample rate.

- `stopHealthCheckInterval()`
  - Call: on app shutdown or when consent is revoked.
  - Purpose: cleanup and stop emitting periodic `health_check` events.

- `emitQualityChangeEvent(previousQuality, currentQuality, status)`
  - Call: wiring is provided via `NetworkDetection.subscribe()`; you only need to call this if implementing a custom detector.
  - Purpose: emit `quality_change` when the effective type changes. This event is unsampled.

- `captureErrorCorrelation(error, context?)`
  - Call: from network error interceptors such as `lib/api/request-manager` or `lib/offline/sync-manager` when a request or sync fails.
  - Purpose: queue/record an error snapshot with the current network status for later sampling and emission.

- `emitSampledErrorEvents(events)`
  - Call: used by the telemetry module to drain queued errors applying sampling. Not typically callable by consumers.

3) How to subscribe to quality changes
```ts
import { NetworkDetection } from "@/lib/network";

const unsubscribe = NetworkDetection.subscribe((status) => {
  // status: { isOnline, connectionType, connectionQuality, latency? }
  // Use status in UI to show warnings or adapt behavior.
});

// When component unmounts:
unsubscribe();
```

4) How to capture errors (example for RequestManager)
```ts
import { captureErrorCorrelation } from "@/lib/network/network-telemetry";

try {
  await requestManager.send(...);
} catch (err) {
  // capture network context for later sampling
  captureErrorCorrelation(err);
  throw err;
}
```

5) Configuration
- Sampling and enabling lives in `config/appsettings.json` and `config/appsettings.dev.json` under `network.telemetry`:

```json
"network": {
  "telemetry": {
    "enabled": true,
    "healthCheckSampleRate": 0.1,
    "errorCorrelationSampleRate": 0.5
  }
}
```

- To temporarily disable telemetry in a dev build, set `enabled` to `false`.

6) Consent / privacy notes
- Telemetry checks the application's consent manager before emitting. If consent is withdrawn:
  - `stopHealthCheckInterval()` is called to stop heartbeats
  - queued error snapshots are discarded
  - No telemetry is emitted or sent to backend until consent is granted again

7) Where to look for telemetry logs
- Dev logs: search for `logger.category('network')` output in console / device logs.
- Files & docs:
  - `lib/network/network-telemetry.ts` — implementation
  - `lib/network/README.md` — overview and telemetry section
  - `docs/issues/MileStone 2/Tier 4/208 - Network Telemetry/TELEMETRY_SCHEMA.md` — event JSON schemas & examples
  - `docs/issues/MileStone 2/Tier 4/208 - Network Telemetry/TELEMETRY_GUIDE.md` — integration checklist and testing notes

8) Troubleshooting
- Health checks not appearing:
  - Confirm `startHealthCheckInterval()` was called on bootstrap and the health check interval is running.
  - Confirm `network.telemetry.enabled` is true.
  - Check consent status.
- Error snapshots missing:
  - Confirm `captureErrorCorrelation()` is invoked in error paths (RequestManager integration).
  - Confirm `errorCorrelationSampleRate` (use 1.0 in dev to force emission).

9) Example: Minimal bootstrap wiring
```ts
import { startHealthCheckInterval } from "@/lib/network/network-telemetry";
import { NetworkDetection } from "@/lib/network";

// inside AppKernelProvider after kernel.phases.networkReady === true
startHealthCheckInterval();

// optional: log status changes
const unsub = NetworkDetection.subscribe((status) => {
  logger.category('network').debug('status_update', status);
});

// on app exit
unsub();
stopHealthCheckInterval();
```

10) Next steps
- Integrate consent manager (#181) to ensure telemetry respects user choice.
- Add unit tests for sampling logic and first-check bypass.
