# health Edge Function
at https://<project>.supabase.co/functions/v1/health

Simple public health-check endpoint for monitoring network connectivity to Supabase.

## ⚠️ Dashboard Management

**This function is managed in the Supabase Dashboard, NOT via CLI.**

The files in this directory are **reference copies** for team visibility and version control. When updating the function:

1. Copy the relevant code from this directory
2. Paste into the Supabase Dashboard editor (`Functions` > `health`)
3. Deploy from Dashboard
4. Commit updated reference files to repo

**Future:** When migrating to Supabase CLI (Phase 2+), this will become the source of truth. No code changes needed.

**See also:** [Supabase Edge Functions Overview](../README.md)

---

## Usage

### Request

Both GET and HEAD requests are supported:

```bash
# GET request
GET /functions/v1/health

# HEAD request (headers only, no body)
HEAD /functions/v1/health
```

No authentication required.

### Response (200 OK)

```json
{
  "status": "healthy",
  "timestamp": "2026-02-05T12:34:56.789Z"
}
```

---

## Purpose

The DnD Toolkit uses this endpoint to detect network connectivity issues before attempting to sync feature flags or other data. Can be called periodically or reactively.

### Client Integration

Used by `lib/network/network-detection.ts`:

```typescript
// Check if network is reachable
const isHealthy = await checkSupabaseHealth();
if (!isHealthy) {
  // Enable offline mode, disable sync, etc.
}
```

---

## Response Codes

| Status | Meaning                                      |
| ------ | -------------------------------------------- |
| 200    | Healthy — endpoint is reachable              |
| 405    | Method not allowed — only GET/HEAD supported |
| 500+   | Server error — endpoint unavailable          |

---

## Performance Characteristics

- **Latency**: ~50-200ms typical (depends on geographic location and network conditions)
- **Payload**: ~70 bytes
- **Timeout**: 30 seconds (Supabase default)
- **No database queries** — pure endpoint availability check

---

## Monitoring

You can monitor this endpoint to track:

- Supabase service availability
- Geographic latency variations (if calling from different regions)
- Network resilience

Typical usage pattern:

```
- Client attempts any Supabase operation
- If network error occurs → call health endpoint
- If health fails → enter offline mode
- If health succeeds → retry original operation
```

---

## Future Enhancements (Phase 2+)

Potential extensions:

- Database connectivity check (SELECT 1)
- Authentication service status
- Performance metrics (response time tracking)
