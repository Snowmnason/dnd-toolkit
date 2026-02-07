# Edge Functions Documentation

## Overview

This project has 4 Supabase Edge Functions deployed to production. All functions use the `/functions/v1/` path.

**Base URL:** Your Supabase project URL (e.g., `https://<project-id>.supabase.co`)

**Environment Variable:** `EXPO_PUBLIC_SUPABASE_URL`

---

## 1. Health Check (`/functions/v1/health`)

**Purpose:** Public health check endpoint for network availability without authentication.

**Authentication:** None (public)  
**HTTP Methods:** `GET`, `HEAD`  
**URL:** `{SUPABASE_URL}/functions/v1/health`

### Request

Using the Supabase SDK:

```typescript
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
);

const { data, error } = await supabase.functions.invoke("health");
```

Using fetch directly:

```bash
curl -X GET https://<project-id>.supabase.co/functions/v1/health
```

### Response (Success - 200 OK)

```json
{
  "status": "ok",
  "timestamp": 1707360000000,
  "uptime": 86400000,
  "version": "1.0"
}
```

### Response (Maintenance - 503 Service Unavailable)

```json
{
  "status": "maintenance",
  "message": "System is under maintenance"
}
```

### Configuration

- Set `MAINTENANCE_MODE=true` environment variable to return 503 responses

### Used By

- Network detection system (`lib/network/network-detection.ts`)
- App kernel for connectivity checks
- Environment variable: `EXPO_PUBLIC_SUPABASE_HEALTH_ENDPOINT`

### Code Location

- Function: `supabase/functions/health/index.ts`

---

## 2. Get Feature Flags (`/functions/v1/get_feature_flags`)

**Purpose:** Fetch consolidated feature flags, entitlements, and per-user overrides in a single request.

**Authentication:** Required (JWT Bearer token)  
**HTTP Methods:** `POST`  
**URL:** `{SUPABASE_URL}/functions/v1/get_feature_flags`

### Request

Using the Supabase SDK:

```typescript
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
);

const { data, error } = await supabase.functions.invoke("get_feature_flags");
```

Using fetch with authentication:

```bash
curl -X POST https://<project-id>.supabase.co/functions/v1/get_feature_flags \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json"
```

### Response (Success - 200 OK)

```json
{
  "flags": [
    {
      "flag_name": "premiumUI",
      "enabled": true,
      "kind": "premium",
      "description": "New premium user interface",
      "created_at": "2026-02-05T00:00:00Z",
      "updated_at": "2026-02-06T00:00:00Z"
    }
  ],
  "entitlements": [
    {
      "id": "ent-123",
      "user_id": "user-456",
      "key": "premium",
      "created_at": "2026-02-01T00:00:00Z",
      "updated_at": "2026-02-06T00:00:00Z",
      "expires_at": "2026-12-31T23:59:59Z"
    }
  ],
  "overrides": [
    {
      "id": "override-789",
      "user_id": "user-456",
      "target_type": "flag",
      "target_name": "betaFeature",
      "enabled": true,
      "expires_at": null,
      "revoked": false,
      "reason": "QA testing",
      "created_by": "admin@example.com",
      "created_at": "2026-02-05T00:00:00Z",
      "updated_at": "2026-02-05T00:00:00Z"
    }
  ],
  "fetchedAt": 1707360000000,
  "version": "v1"
}
```

### Response (Unauthorized - 401)

```json
{
  "error": "Missing or invalid Authorization header",
  "timestamp": 1707360000000
}
```

### Used By

- Feature flags system (`lib/feature-flags/server-sync.ts`)
- Called on app startup to bootstrap flags
- Subscription manager for entitlement checks
- Client calls via: `supabase.functions.invoke("get_feature_flags")`

### Code Location

- Function: `supabase/functions/get_feature_flags/`
  - `index.ts` - Main handler
  - `queries.ts` - Database query helpers
  - `types.ts` - TypeScript types

---

## 3. Delete Account (`/functions/v1/delete-account`)

**Purpose:** Securely delete a user account and all associated data (irreversible).

**Authentication:** Required (JWT Bearer token - user can only delete their own account)  
**HTTP Methods:** `POST`  
**URL:** `{SUPABASE_URL}/functions/v1/delete-account`

### Request

Using the Supabase SDK:

```typescript
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
);

const { data, error } = await supabase.functions.invoke("delete-account");
```

Using fetch:

```bash
curl -X POST https://<project-id>.supabase.co/functions/v1/delete-account \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json"
```

### Response (Success - 200 OK)

```json
{
  "success": true,
  "message": "Account deleted successfully",
  "timestamp": 1707360000000
}
```

### Response (Unauthorized - 401)

```json
{
  "error": "Missing or invalid Authorization header",
  "timestamp": 1707360000000
}
```

### Response (Error - 500)

```json
{
  "error": "Failed to delete account",
  "message": "Database constraint violation",
  "timestamp": 1707360000000
}
```

### Security

- Validates JWT token and extracts user ID
- User can only delete their own account
- Deletes all app data first (cascading deletes)
- Then deletes Supabase auth user
- Multi-step process for maximum data cleanup

### Used By

- User account deletion (`lib/database/users.ts`)
- Called via: `supabase.functions.invoke("delete-account")`

### Code Location

- Function: `supabase/functions/delete-account/index.ts`

---

## 4. Invite Link Cleanup (`/functions/v1/invite-link-cleanup`)

**Purpose:** Remove expired invite links from the database (scheduled cleanup).

**Authentication:** Optional (can be called by cron or scheduled job)  
**HTTP Methods:** `POST`  
**URL:** `{SUPABASE_URL}/functions/v1/invite-link-cleanup`  
**Query Parameters:**

- `dry_run=true` - Show what would be deleted without actually deleting
- `dry_run=false` - (default) Actually delete expired links

### Request

Using the Supabase SDK:

```typescript
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
);

// Dry run
const { data, error } = await supabase.functions.invoke("invite-link-cleanup", {
  body: { dry_run: true },
});

// Actual cleanup
const { data, error } = await supabase.functions.invoke("invite-link-cleanup", {
  body: { dry_run: false },
});
```

Using fetch:

```bash
# Dry run (count only)
curl -X POST "https://<project-id>.supabase.co/functions/v1/invite-link-cleanup?dry_run=true"

# Actual cleanup
curl -X POST "https://<project-id>.supabase.co/functions/v1/invite-link-cleanup?dry_run=false"
```

### Response (Success - 200 OK)

```json
{
  "status": "ok",
  "deleted": 42,
  "message": "42 expired invite link(s) removed.",
  "timestamp": 1707360000000
}
```

### Response (Dry Run - 200 OK)

```json
{
  "status": "ok",
  "dry_run": true,
  "would_delete": 42,
  "timestamp": 1707360000000
}
```

### Response (Error - 500)

```json
{
  "status": "error",
  "message": "Failed to run cleanup",
  "details": "Connection timeout",
  "timestamp": 1707360000000
}
```

### Implementation

- Connects directly to PostgreSQL database
- Finds all invite links with `expires_at <= NOW()`
- Deletes in batches to avoid timeouts
- Logs operation for audit trail

### Scheduling

- Can be scheduled via Supabase cron functions
- Or called by external scheduler (e.g., GitHub Actions)
- Recommended frequency: Daily or weekly

### Code Location

- Function: `supabase/functions/invite-link-cleanup/index.ts`

---

## URL Constants and Helpers

All Edge Function URLs are centrally managed in `lib/edge-functions/constants.ts`:

```typescript
import { EDGE_FUNCTIONS, getEdgeFunctionUrl } from "@/lib/edge-functions";

// Get individual endpoint paths
EDGE_FUNCTIONS.HEALTH; // "/functions/v1/health"
EDGE_FUNCTIONS.GET_FEATURE_FLAGS; // "/functions/v1/get_feature_flags"
EDGE_FUNCTIONS.DELETE_ACCOUNT; // "/functions/v1/delete-account"
EDGE_FUNCTIONS.INVITE_LINK_CLEANUP; // "/functions/v1/invite-link-cleanup"

// Build full URLs
const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const fullUrl = getEdgeFunctionUrl(EDGE_FUNCTIONS.HEALTH, baseUrl);
// Result: "https://<project-id>.supabase.co/functions/v1/health"
```

---

## Testing

All Edge Function URLs are verified by tests in `__tests__/edge-functions/constants.test.ts`:

```bash
npm test -- __tests__/edge-functions/constants.test.ts
```

Tests verify:

- URL format and structure
- Environment variable handling
- Health endpoint uses `/functions/v1/health` not `/rest/v1/`
- All functions accessible via their correct paths

---

## Environment Variables

### Health Endpoint (Network Detection)

```bash
# Required for network detection
EXPO_PUBLIC_SUPABASE_URL=https://<project-id>.supabase.co

# Optional: Override health endpoint for testing
EXPO_PUBLIC_SUPABASE_HEALTH_ENDPOINT=https://<project-id>.supabase.co/functions/v1/health
```

### Feature Flags

- No specific environment variable (uses `supabase.functions.invoke()`)
- JWT authentication handled automatically

### Maintenance Mode (Health Check)

```bash
# Set in Supabase Edge Function environment to trigger 503 responses
MAINTENANCE_MODE=true
```

---

## Common Issues & Troubleshooting

### Health Endpoint Returning 401

- **Cause:** Using old `/rest/v1/` endpoint
- **Fix:** Update `EXPO_PUBLIC_SUPABASE_HEALTH_ENDPOINT` to point to `/functions/v1/health`

### Feature Flags Not Fetching

- **Cause:** JWT token expired or not included
- **Fix:** Verify user is authenticated; check logs in Supabase functions dashboard

### Delete Account Fails

- **Cause:** Database constraints or user ID mismatch
- **Fix:** Check Supabase logs; ensure user ID in JWT matches user being deleted

### Invite Cleanup Timeout

- **Cause:** Too many expired links to delete in one batch
- **Fix:** Run with `dry_run=true` to check count; increase database batch size

---

## Deployment

All functions are deployed to Supabase:

```bash
# Deploy all functions
supabase functions deploy

# Deploy specific function
supabase functions deploy health
supabase functions deploy get_feature_flags
supabase functions deploy delete-account
supabase functions deploy invite-link-cleanup
```

---

## Related Documentation

- `lib/edge-functions/constants.ts` - URL definitions
- `lib/feature-flags/server-sync.ts` - Feature flags usage
- `lib/database/users.ts` - Account deletion
- `lib/network/network-detection.ts` - Health checks
- `supabase/functions/*/` - Function implementations
