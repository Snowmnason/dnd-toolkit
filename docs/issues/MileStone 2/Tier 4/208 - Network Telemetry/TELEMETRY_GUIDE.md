## Network Telemetry Integration Guide

Purpose: describe how to integrate `lib/network` telemetry into the app and how to test it.

1) Bootstrap integration

- Start health checks during app kernel/network ready phase (AppKernelProvider):

```ts
import { startHealthCheckInterval } from "@/lib/network/network-telemetry";

// on kernel.phases.networkReady
startHealthCheckInterval(); // uses configured interval
```

2) Hook quality changes

- Subscribe to `NetworkDetection` and rely on `lib/network/network-telemetry` to emit `quality_change` events. No additional wiring required when using provided helpers.

3) Request manager error capture

- `lib/api/request-manager` should call the exported `captureErrorCorrelation(error)` helper to queue error snapshots. Sampling and emission are performed by telemetry code.

4) Configuring sampling

- Edit `config/appsettings.json` and `config/appsettings.dev.json` under `network.telemetry`:

```json
"network": {
  "telemetry": {
    "enabled": true,
    "healthCheckSampleRate": 0.1,
    "errorCorrelationSampleRate": 0.5
  }
}
```

5) Consent and privacy

- Before emitting any telemetry, code checks the app's consent manager (#181). If consent is withdrawn:
  - stop the health check interval
  - discard any queued error snapshots
  - avoid sending any telemetry to backends

6) Testing checklist

- Unit tests:
  - Validate `shouldSample()` behavior over boundary values (0, 1)
  - Ensure first health check bypasses sampling
  - Ensure `captureErrorCorrelation()` queues events and `emitSampledErrorEvents()` respects sample rate

- Integration/manual tests:
  - Simulate 4g → 3g → 2g transitions and assert `quality_change` logs appear
  - Force a request timeout and assert `error_correlation` queued and (when sampled) logged
  - Toggle consent off and ensure no telemetry logs and the interval stops

7) Future improvements (Phase 3+)

- Add a deterministic seeded sampling mode for reproducible captures in experiments.
- Persist queued error snapshots to local storage with a bounded size.
- Add server ingestion contract and event versioning (`telemetryVersion`).
- Implement PII scrubber and privacy audit for telemetry payloads.
