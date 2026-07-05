# invite-link-cleanup Edge Function

Reference copy of the Supabase Edge Function that cleans up expired invite links and stale invitation data.

## What Lives Here

This function handles maintenance work for invite-related tables. The repo copy is kept for visibility and version tracking while the deployed function is still managed in the Supabase Dashboard.

## Key Responsibilities

- revoke expired invite links
- remove orphaned or stale invite-link records
- clean up expired invitation entries
- support dry-run invocation for safe admin checks

## Important Paths

- `index.txt` — reference function source
- `../README.md` — parent Edge Functions overview
- `lib/database/README.md` — broader database layer reference

## Request And Response

- Method: `POST`
- Auth: admin bearer token
- Body: optional `{ "dry_run": true | false }`
- Success: `200` with a cleanup summary
- Common failures: `401` for invalid or missing auth, `405` for wrong method, `500` for cleanup or query failures

Example response shape:

```json
{
  "success": true,
  "summary": {
    "totalProcessed": 1524,
    "expiredLinksRevoked": 234,
    "orphanedLinksDeleted": 89,
    "invitedUsersExpired": 12
  },
  "dryRun": false,
  "timestamp": "2026-02-05T12:34:56.789Z"
}
```

## Related Modules

- `lib/database/README.md`
- `lib/database/edge/README.md`
