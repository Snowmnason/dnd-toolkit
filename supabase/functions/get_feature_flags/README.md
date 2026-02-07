# get_feature_flags Edge Function

This Edge Function consolidates feature flags, entitlements, and per-user overrides into a single server-side RPC call.

## ⚠️ Dashboard Management

**This function is managed in the Supabase Dashboard, NOT via CLI.**

The files in this directory are **reference copies** for team visibility and version control. When updating the function:

1. Copy the relevant code from this directory
2. Paste into the Supabase Dashboard editor (`Functions` > `get_feature_flags`)
3. Deploy from Dashboard
4. Commit updated reference files to repo

**Future:** When migrating to Supabase CLI (Phase 2+), this will become the source of truth. No code changes needed.

**See also:** [Supabase Edge Functions Overview](../README.md)

---

## Usage

### Request

```bash
POST /functions/v1/get_feature_flags
Authorization: Bearer <user_jwt_token>
Content-Type: application/json
```

### Response (200 OK)

```json
{
  "flags": [
    {
      "flag_name": "darkModeV2",
      "enabled": true,
      "kind": "free",
      "description": "Dark mode toggle",
      "created_at": "2026-02-05T...",
      "updated_at": "2026-02-05T..."
    }
  ],
  "entitlements": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "key": "premium_maps",
      "expires_at": "2026-12-31T...",
      "created_at": "2026-02-05T...",
      "updated_at": "2026-02-05T..."
    }
  ],
  "overrides": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "target_type": "flag",
      "target_name": "betaFeature",
      "enabled": true,
      "expires_at": null,
      "revoked": false,
      "reason": "internal testing",
      "created_by": "uuid",
      "created_at": "2026-02-05T...",
      "updated_at": "2026-02-05T..."
    }
  ],
  "fetchedAt": 1707120000000,
  "version": "v1"
}
```

### Error Responses

| Status | Cause               | Response                                             |
| ------ | ------------------- | ---------------------------------------------------- |
| 401    | Missing/invalid JWT | `{ error: "Unauthorized" }`                          |
| 405    | Invalid HTTP method | `{ error: "Method not allowed" }`                    |
| 500    | Server error        | `{ error: "Internal server error", message: "..." }` |

---

## Implementation Details

### JWT Verification

- Uses Supabase's JWT secret (`SUPABASE_JWT_SECRET`) to verify token authenticity
- Extracts `sub` claim (user ID) from JWT
- Returns 401 if token is invalid or missing

### Data Fetching

- Parallel fetching of flags, entitlements, and overrides for performance
- Uses service role key to bypass RLS (function runs with elevated permissions)
- Server-side filters for non-revoked, non-expired overrides

### Response Structure

- **flags**: All global feature flags (not user-specific)
- **entitlements**: All active entitlements for the user
- **overrides**: All active overrides for the user (both flag and entitlement types)
- **fetchedAt**: Timestamp for cache invalidation (client-side)
- **version**: API version for future compatibility

---

## Client Integration

Client-side code in `lib/feature-flags/server-sync.ts` invokes this function:

```typescript
const response = await supabase.functions.invoke("get_feature_flags", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
});

// Response structure matches GetFeatureFlagsResponse type
// Client then caches and merges locally
```

### Client-Side Responsibilities

- Cache response to `SecureStorage`
- Merge logic: override > entitlement > flag
- Offline fallback: use cached values
- Local overrides: for admin testing

---

## Architecture

**Flow:**

1. Client invokes Edge Function with JWT token
2. Function verifies JWT and extracts user ID
3. Function fetches flags + entitlements + overrides in parallel
4. Server-side filters applied (expiry, revocation)
5. Consolidated response returned to client
6. Client caches and merges locally

**Why?**

- ✅ Single request (3 queries → 1 RPC)
- ✅ Server-side filtering (cleaner architecture)
- ✅ Natural extension point for Phase 2 features
- ✅ Offline unchanged (client-side caching)

---

## Future Enhancements (Phase 2+)

The function is designed as a natural growth point:

- **A/B Testing Bucketing** — Add deterministic user bucket assignment
- **Conditions & Targeting** — Evaluate user attributes and return filtered flags
- **Audit Logging** — Log which flags returned to which users
- **ETag/304 Support** — Cache validation to reduce bandwidth

---

## Troubleshooting

### Function returns 500

Check Dashboard function logs:

1. Dashboard > `Functions` > `get_feature_flags` > `Logs`
2. Look for missing environment variables or database query errors
3. Verify Supabase credentials are correct

### Client receives empty arrays

- Verify user has entitlements/overrides in database
- Check database RLS policies (service role key bypasses RLS)
- Verify JWT token is valid and contains `sub` claim

### JWT verification fails

- Ensure Bearer token format: `Authorization: Bearer <token>`
- Verify token was issued by Supabase (signed with correct key)
- Check token has not expired (verify `exp` claim)
