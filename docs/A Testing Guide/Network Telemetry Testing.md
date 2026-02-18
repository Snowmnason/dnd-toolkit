# Network Telemetry — Manual Testing Guide

Purpose: step-by-step manual test cases to validate telemetry emitted by `lib/network` (quality_change, health_check, error_correlation). Use these during QA and smoke testing on web / iOS / Android.

Preparation
- Ensure development build uses `config/appsettings.dev.json` (sampling enabled and set to conservative values).
- Enable `logger` category `network` in dev feature flags to see telemetry logs.
- Open device/emulator/devtools console or capture device logs for native platforms.

Common verification steps
- Search runtime logs for `category: network` or inspect `logger` output. Events are logged via `logger.category('network').info(...)`.
- Check sampling config at runtime via `getAppConfig().network?.telemetry` or by inspecting `config/appsettings*.json`.

Test cases

1) Quality change events (unsampled)
- Goal: verify `quality_change` events are emitted when effectiveType changes.
- Steps:
  1. In web DevTools, emulate 4G → Slow 3G → Offline via Network throttling.
  2. On native, use Network Link Conditioner (iOS) or Android settings to switch profiles.
  3. Observe logs for `quality_change` events with `previousQuality` and `currentQuality`.
- Expected:
  - Events appear immediately on each quality change.
  - Each event contains `previousQuality`, `currentQuality`, `timestamp`, `platform`, and `isOnline` fields.

2) Health check (first unsampled, subsequent sampled)
- Goal: verify a health check is emitted on app start (unsampled) and that subsequent checks follow sample rate.
- Steps:
  1. Start the app and watch logs for a `health_check` event immediately after network ready.
  2. Wait for a few intervals (or reduce interval in dev config) to spot sampled events.
  3. Alternatively, temporarily set `healthCheckSampleRate` to 1.0 in `appsettings.dev.json` to observe all health checks.
- Expected:
  - First `health_check` appears on startup regardless of sample rate.
  - With sample rate < 1, not every interval emits; toggling sample to 1 should emit every interval.

3) Error correlation (capture + sampled emission)
- Goal: capture an error snapshot on request failures and verify sampling/emit behavior.
- Steps:
  1. Trigger a network error (simulate server timeout or return 5xx from a test endpoint).
  2. Confirm `captureErrorCorrelation()` is invoked by the RequestManager (check logs for queued events if implemented).
  3. To force emission, temporarily set `errorCorrelationSampleRate: 1.0` in `appsettings.dev.json` and observe `error_correlation` logs.
- Expected:
  - Error snapshots include `error` (classification), `currentQuality`, `isOnline`, `connectionType`, and `timestamp`.

4) Consent toggle (privacy)
- Goal: ensure telemetry stops when consent is withdrawn and resumes when granted.
- Steps:
  1. With telemetry enabled, verify events appear.
  2. Toggle consent off via the app's consent manager (feature #181) or simulate the flag.
  3. Verify no further telemetry events are emitted and the health check interval stops.
  4. Re-enable consent and verify health checks resume.
- Expected:
  - On consent withdrawal: no new telemetry logs; queued error snapshots are discarded.
  - On consent grant: telemetry resumes and first health check emits immediately (unsampled).

5) Platform-specific checks
- Web:
  - Use DevTools network throttling and check `navigator.connection` where available.
  - Verify RTT/latency fields appear in `health_check` when supported.
- iOS:
  - Use Network Link Conditioner or Xcode to throttle and confirm `connectionType` and `isExpensive` values.
- Android:
  - Use developer settings to simulate slow networks and check logs.

Troubleshooting
- No telemetry logs:
  - Confirm `featureFlags.loggerCategories.network` is enabled in dev settings.
  - Confirm consent flag allows telemetry.
  - Check `getAppConfig().network.telemetry.enabled`.
- Missing latency/downlink fields:
  - Browser may not support Network Information API — use ping fallback or accept omission.
- Too many events:
  - Adjust sample rates in `appsettings.*.json`.

Test data capture
- For longer runs, collect logs and run aggregation queries on your log store to confirm distribution (e.g., error rate by quality tier).

Acceptance criteria
- `quality_change` events always emitted on changes.
- First `health_check` always logged; sampling reduces subsequent health checks.
- `error_correlation` events include a quality snapshot when sampled.
- Consent toggle cleanly stops/resumes telemetry.
