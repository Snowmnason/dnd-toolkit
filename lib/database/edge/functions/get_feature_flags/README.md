# get_feature_flags Edge Function

Reference copy of the Supabase Edge Function that returns the server-side feature-flag snapshot for the current user.

## What Lives Here

This function consolidates three related surfaces into one response:

- global feature flags
- active user entitlements
- active per-user overrides

The repo copy is kept for visibility and version tracking while the deployed function is still managed in the Supabase Dashboard.

## Key Responsibilities

- verify the caller's JWT
- fetch flags, entitlements, and overrides for the current user
- apply server-side expiry and revocation filtering
- return a single snapshot the client can cache and merge locally

## Important Paths

- `index.txt` — reference function source
- `../README.md` — parent Edge Functions overview
- `lib/feature-flags/README.md` — client-side feature-flag system
- `lib/feature-flags/server-sync.ts` — client sync path that consumes this function

## Request And Response

- Method: `POST`
- Auth: required bearer token
- Success: `200` with `flags`, `entitlements`, `overrides`, `fetchedAt`, and `version`
- Common failures: `401` for invalid or missing auth, `405` for wrong method, `500` for function or query failure

Example response shape:

```json
{
  "flags": [],
  "entitlements": [],
  "overrides": [],
  "fetchedAt": 1707120000000,
  "version": "v1"
}
```

## Related Modules

- `lib/feature-flags/README.md`
- `system/Services/README.md`
- `lib/database/edge/README.md`
