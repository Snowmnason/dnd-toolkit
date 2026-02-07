# Supabase Edge Functions

This directory contains Supabase Edge Functions used by the DnD Toolkit app.

## 📋 Functions Overview

| Function                | Auth     | Purpose                                  | Details                                     |
| ----------------------- | -------- | ---------------------------------------- | ------------------------------------------- |
| **health**              | Public   | Network connectivity checks              | No auth required, simple 200 OK response    |
| **get_feature_flags**   | JWT      | Feature flags + entitlements + overrides | Authenticated, consolidated server-side     |
| **delete-account**      | JWT      | Permanent account deletion               | Authenticated, cascading user data deletion |
| **invite-link-cleanup** | Internal | Expire old invite links                  | Scheduled/admin only, supports dry-run      |

## ⚠️ Dashboard Management (Phase 1)

**These functions are managed in the Supabase Dashboard, NOT via CLI.**

The files in this directory are **reference copies** for team visibility and version control. When updating a function:

1. Copy the relevant code from this directory
2. Paste into the Supabase Dashboard editor (`Functions` > `<function-name>`)
3. Deploy from Dashboard
4. Commit updated reference files to repo

**Future:** When migrating to Supabase CLI (Phase 2+), this will become the source of truth and deployment method changes to CLI. No code changes needed.

---

## 📁 Function Documentation

For detailed documentation on each function, see:

- **[health](./functions/health/README.md)** — Network health checks
- **[get_feature_flags](./functions/get_feature_flags/README.md)** — Feature flag consolidation
- **[delete-account](./functions/delete-account/README.md)** — Account deletion
- **[invite-link-cleanup](./functions/invite-link-cleanup/README.md)** — Invite link cleanup

---

## 🔧 Environment Variables

When creating functions in Supabase Dashboard:

- `SUPABASE_URL` — Automatically provided by Dashboard
- `SUPABASE_JWT_SECRET` — Automatically provided by Dashboard
- `SUPABASE_SERVICE_ROLE_KEY` — Automatically provided by Dashboard
- `SUPABASE_DB_URL` — For invite-link-cleanup (direct pg connection)

No manual setup needed; Dashboard provides these automatically.

---

## 🚀 Common Patterns

### Authentication in Edge Functions

All authenticated functions use JWT verification:

```typescript
import { jwtVerify } from "https://esm.sh/jose@5.0.0";

const token = authHeader.substring(7); // Remove "Bearer " prefix
const secret = new TextEncoder().encode(Deno.env.get("SUPABASE_JWT_SECRET"));
const verified = await jwtVerify(token, secret);
const userId = verified.payload.sub; // User ID from JWT
```

### Error Responses

All functions return JSON with appropriate HTTP status:

```typescript
// Unauthorized
return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

// Server error
return new Response(
  JSON.stringify({ error: "Internal error", message: "..." }),
  { status: 500 },
);
```

---

## 🔗 Related Documentation

- [Edge Functions Guide](../../docs/issues/MileStone%202/Tier%203/223%20-%20Event-Driven%20Feature%20Flags%20Architecture/EDGE_FUNCTIONS.md) — Complete Edge Functions architecture
- [Client Integration](../../lib/edge-functions) — Client-side Edge Functions usage
