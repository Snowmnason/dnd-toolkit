# 🚀 Edge Functions — DnD Toolkit

This document describes the Supabase Edge Functions used in the D&D Toolkit backend. Edge Functions run server-side and can bypass Row Level Security (RLS) when using the `service_role` key.

---

## Overview

**Location:** `supabase/functions/`

Edge Functions handle:

- Feature flag consolidation and server-side filtering
- Account deletion with cascading cleanup
- Health checks and monitoring
- Periodic maintenance tasks (cleanup, expiry handling)

---

## Core Edge Functions

### 1. `get_feature_flags` (POST)

**Purpose:** Consolidates feature flags, entitlements, and per-user overrides into a single authenticated RPC call.

**Endpoint:** `POST /functions/v1/get_feature_flags`

**Authentication:** Bearer token (JWT from Supabase auth)

**Request:**

```bash
curl -X POST https://your-project.supabase.co/functions/v1/get_feature_flags \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Response (Success):**

```json
{
  "flags": [
    {
      "flag_name": "dark-mode",
      "enabled": true,
      "kind": "boolean",
      "description": "Dark mode theme toggle",
      "created_at": "2026-02-01T10:00:00Z",
      "updated_at": "2026-02-08T15:30:00Z"
    }
  ],
  "entitlements": [
    {
      "id": "uuid...",
      "user_id": "uuid...",
      "key": "premium-features",
      "is_active": true,
      "remind_user": false,
      "created_at": "2026-02-01T10:00:00Z",
      "updated_at": "2026-02-08T15:30:00Z",
      "expires_at": "2026-03-01T10:00:00Z"
    }
  ],
  "overrides": [
    {
      "id": "uuid...",
      "user_id": "uuid...",
      "target_type": "flag",
      "target_name": "dark-mode",
      "enabled": false,
      "expires_at": null,
      "revoked": false,
      "reason": "Admin testing",
      "created_by": "uuid...",
      "created_at": "2026-02-08T15:30:00Z",
      "updated_at": "2026-02-08T15:30:00Z"
    }
  ],
  "rollouts": {
    "new-feature": { "percentage": 50, "seed": "2026-02-07" }
  },
  "fetchedAt": 1707408600000,
  "version": "v1"
}
```

**Server-side Filtering:**

- **Feature Flags:** All returned (no filtering)
- **Entitlements:** Only `is_active=true` and non-expired (expires_at IS NULL OR expires_at > now())
- **Overrides:** Only non-revoked and non-expired
- **Rollouts:** Only `is_active=true`

**Client-side Responsibilities:**

- Cache response via SecureStorage
- Merge logic: override > entitlement > flag
- Offline fallback to cached values
- Apply rollout rules (percentage-based bucketing)

**Code Location:** `supabase/functions/get_feature_flags/`

---

### 2. `delete-account` (POST)

**Purpose:** Securely deletes a user account and all associated data.

**Endpoint:** `POST /functions/v1/delete-account`

**Authentication:** Bearer token (JWT from Supabase auth) — user can only delete their own account

**Request:**

```bash
curl -X POST https://your-project.supabase.co/functions/v1/delete-account \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Response (Success):**

```json
{
  "success": true,
  "message": "Account deleted successfully",
  "timestamp": 1707408600000
}
```

**Response (Unauthorized):**

```json
{
  "error": "Unauthorized"
}
```

**Deletion Flow:**

1. Validate JWT token via `auth.getUser()`
2. Delete user app data (cascades handle dependents)
3. Delete Supabase auth user
4. Optional: log audit entry for compliance/recovery

**Code Location:** `supabase/functions/delete-account/`

---

### 3. `health` (GET/HEAD)

**Purpose:** Public health check endpoint for network monitoring and uptime verification.

**Endpoint:** `GET /functions/v1/health` or `HEAD /functions/v1/health`

**Authentication:** None required (public endpoint)

**Response (Success):**

```json
{
  "status": "ok",
  "timestamp": 1707408600000,
  "uptime": 3600000,
  "version": "1.0"
}
```

**HTTP Status:** 200 OK (or 503 if maintenance mode)

**Use Cases:**

- Network detection: verify connectivity without auth errors
- Monitoring/alerting: check function availability
- Maintenance mode: toggle via `MAINTENANCE_MODE` env var

**Code Location:** `supabase/functions/health/`

---

### 4. `invite-link-cleanup` (POST)

**Purpose:** Periodic cleanup of expired invite links.

**Endpoint:** `POST /functions/v1/invite-link-cleanup?dry_run=false`

**Authentication:** None (internal/scheduled job)

**Query Parameters:**

- `dry_run=true` — returns count without deleting

**Request:**

```bash
curl -X POST https://your-project.supabase.co/functions/v1/invite-link-cleanup
```

**Response (Success):**

```json
{
  "status": "ok",
  "deleted": 42,
  "message": "42 expired invite link(s) removed.",
  "timestamp": 1707408600000,
  "duration": 245
}
```

**Response (Dry Run):**

```json
{
  "status": "ok",
  "dry_run": true,
  "would_delete": 42,
  "timestamp": 1707408600000
}
```

**Prerequisites:**

- Environment variable `CLEANUP_ENABLED=true` to allow deletions
- `SUPABASE_DB_URL` connection string configured

**Code Location:** `supabase/functions/invite-link-cleanup/`

---

## Environment Variables

| Variable                    | Required | Purpose                                                |
| --------------------------- | -------- | ------------------------------------------------------ |
| `SUPABASE_URL`              | Yes      | Supabase project URL                                   |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes      | Service role key (for admin operations, RLS bypass)    |
| `SUPABASE_DB_URL`           | Yes      | Direct database connection string (cleanup function)   |
| `CLEANUP_ENABLED`           | No       | Set to `true` to enable invite link deletion           |
| `MAINTENANCE_MODE`          | No       | Set to `true` to return 503 from health check          |
| `HEALTH_VERSION`            | No       | Version string returned by health check (default: 1.0) |

---

## Performance & Caching

- `get_feature_flags`: ~200-400ms typical (50ms flags + 100ms entitlements + 150ms overrides + 50ms rollouts)
- Response caching on clients: 5-second max-age with 10-second stale-while-revalidate
- Server caching: None (always fresh queries for consistency)

---

## Error Handling

All functions return structured error responses:

```json
{
  "status": "error",
  "message": "Human-readable error message",
  "timestamp": 1707408600000
}
```

**Common Status Codes:**

- `200` — Success
- `204` — No Content (health check OPTIONS)
- `400` — Bad Request (invalid parameters)
- `401` — Unauthorized (invalid/missing token)
- `403` — Forbidden (insufficient permissions)
- `500` — Internal Server Error (database/processing failure)
- `503` — Service Unavailable (maintenance mode)

---

## Testing

**Health Check:**

```bash
curl -i https://your-project.supabase.co/functions/v1/health
```

**Feature Flags (authenticated):**

```bash
curl -X POST https://your-project.supabase.co/functions/v1/get_feature_flags \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Delete Account (careful!):**

```bash
curl -X POST https://your-project.supabase.co/functions/v1/delete-account \
  -H "Authorization: Bearer $JWT_TOKEN"
```

---

_Last Updated: Feb 8, 2026_
