# health Edge Function

Reference copy of the public Supabase health endpoint used to confirm backend reachability.

## What Lives Here

This folder documents the `health` Edge Function that responds to lightweight `GET` and `HEAD` requests. The repo copy is kept for visibility and version tracking while the deployed function is still managed in the Supabase Dashboard.

## Key Responsibilities

- provide a fast backend reachability check
- distinguish backend unavailability from broader client-side network issues
- support web and native availability checks without requiring authentication

## Important Paths

- `index.txt` — reference function source
- `../README.md` — parent Edge Functions overview
- `system/Services/backend-availability.ts` — backend health URL resolution
- `system/Network/network-detection.ts` — runtime health checks and connectivity decisions
- `docs/Important Notes/Dev/NETWORK_HEALTH_ENDPOINT.md` — current app-level note for this endpoint

## Request And Response

- Methods: `GET`, `HEAD`
- Auth: none
- Success: `200` with a small health payload or empty body for `HEAD`
- Failure: `405` for unsupported methods and `500+` for server-side failures

Example success payload:

```json
{
  "status": "healthy",
  "timestamp": "2026-02-05T12:34:56.789Z"
}
```

## Related Modules

- `system/Network/README.md`
- `system/Services/README.md`
- `lib/database/edge/README.md`
