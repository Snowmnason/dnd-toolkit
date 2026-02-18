# Network Telemetry — JSON Schemas & Examples

This document defines the client-side telemetry event JSON shapes used by `lib/network` (quality_change, health_check, error_correlation). These are intended for Phase 2 documentation and backend ingestion planning.

## 1) Base event (common fields)

Required common fields used across event types:

```json
{
  "telemetryVersion": 1,
  "eventType": "string",
  "timestamp": 0,
  "platform": "web|ios|android|desktop",
  "currentQuality": "EXCELLENT|GOOD|POOR|OFFLINE",
  "isOnline": true,
  "connectionType": "wifi|cellular|ethernet|unknown",
  "isExpensive": false
}
```

Notes:
- `telemetryVersion` allows future schema evolution.
- Optional fields are omitted when unavailable (e.g., `latency` on older browsers).

## 2) `quality_change` schema

Required: `eventType`, `timestamp`, `previousQuality`, `currentQuality`, `platform`.

Example:

```json
{
  "telemetryVersion": 1,
  "eventType": "quality_change",
  "timestamp": 1670000000000,
  "platform": "web",
  "previousQuality": "GOOD",
  "currentQuality": "POOR",
  "isOnline": true,
  "connectionType": "wifi",
  "isExpensive": false
}
```

## 3) `health_check` schema

Optional latency/downlink fields when available. First health check on app start is unsampled; subsequent checks are sampled.

Example:

```json
{
  "telemetryVersion": 1,
  "eventType": "health_check",
  "timestamp": 1670000000000,
  "platform": "web",
  "currentQuality": "GOOD",
  "isOnline": true,
  "connectionType": "wifi",
  "latency": 42,
  "downlink": 12.5,
  "isExpensive": false
}
```

## 4) `error_correlation` schema

Includes an error classification and optional HTTP status/ message.

Example:

```json
{
  "telemetryVersion": 1,
  "eventType": "error_correlation",
  "timestamp": 1670000000000,
  "platform": "ios",
  "currentQuality": "POOR",
  "isOnline": true,
  "connectionType": "cellular",
  "isExpensive": true,
  "error": "timeout",
  "statusCode": null,
  "errorMessage": "Request timed out after 10000ms"
}
```

## Aggregation / example query

Example SQL to compute error rates by quality tier (Postgres):

```sql
SELECT
  currentQuality,
  COUNT(*) AS events,
  SUM(CASE WHEN eventType = 'error_correlation' THEN 1 ELSE 0 END) AS error_count
FROM telemetry_events
WHERE timestamp >= now() - INTERVAL '7 days'
GROUP BY currentQuality
ORDER BY error_count DESC;
```

## Privacy & ingestion notes

- Events MUST NOT include PII unless explicit consent is present and documented.
- Backends should validate `telemetryVersion` and reject/transform unknown versions.
- Consider server-side sampling or deduplication for high-volume ingestion.
