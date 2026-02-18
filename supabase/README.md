# Supabase Edge Functions

Reference copies of Supabase Edge Functions used by the DnD Toolkit app.

This folder contains code samples and reference docs. Functions are managed and deployed from the Supabase Dashboard (Phase 1). When migrating to the Supabase CLI (Phase 2+), these files may become the canonical source.

## Functions (summary)

| Function                | Auth     | Purpose                                  |
| ----------------------- | -------- | ---------------------------------------- |
| `health`                | Public   | Network connectivity / health checks     |
| `get_feature_flags`     | JWT      | Consolidated feature flags & entitlements|
| `delete-account`        | JWT      | Permanent account deletion (cascading)   |
| `invite-link-cleanup`   | Internal | Expire old invite links (scheduled/admin)|

## Dashboard Deployment (Phase 1)

These functions are edited and deployed in the Supabase Dashboard. Recommended workflow:

1. Copy code from this repo file.
2. Paste into Supabase Dashboard → Functions → `<function-name>`.
3. Save & deploy in Dashboard.
4. Commit reference file updates to the repository for visibility.

Notes:
- Dashboard provides `SUPABASE_URL`, `SUPABASE_JWT_SECRET`, and service keys automatically.
- Use `SUPABASE_DB_URL` only for direct Postgres tasks (e.g., cleanup migration jobs).

## Patterns & Examples

### JWT auth (example)

```ts
import { jwtVerify } from "https://esm.sh/jose@5";
const token = authHeader.replace(/^Bearer\s+/i, "");
const secret = new TextEncoder().encode(Deno.env.get("SUPABASE_JWT_SECRET"));
const verified = await jwtVerify(token, secret);
const userId = verified.payload.sub as string;
```

### Standard JSON error responses

```ts
return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
// or
return new Response(JSON.stringify({ error: "Internal error", message }), { status: 500 });
```

## Function docs

Detailed docs live under `./functions/`:
- `functions/health/README.md` — health checks
- `functions/get_feature_flags/README.md` — feature flags consolidation
- `functions/delete-account/README.md` — account deletion workflow
- `functions/invite-link-cleanup/README.md` — invite cleanup job

## Related docs

- Edge functions architecture: `docs/issues/MileStone 2/Tier 3/223 - Event-Driven Feature Flags Architecture/EDGE_FUNCTIONS.md`
- Client integration samples: `lib/edge-functions`
