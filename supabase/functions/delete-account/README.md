# delete-account Edge Function

Handles permanent account deletion with cascading data cleanup.

## ⚠️ Dashboard Management

**This function is managed in the Supabase Dashboard, NOT via CLI.**

The files in this directory are **reference copies** for team visibility and version control. When updating the function:

1. Copy the relevant code from this directory
2. Paste into the Supabase Dashboard editor (`Functions` > `delete-account`)
3. Deploy from Dashboard
4. Commit updated reference files to repo

**Future:** When migrating to Supabase CLI (Phase 2+), this will become the source of truth. No code changes needed.

**See also:** [Supabase Edge Functions Overview](../README.md)

---

## Usage

### Request

```bash
POST /functions/v1/delete-account
Authorization: Bearer <user_jwt_token>
Content-Type: application/json

{
  "password": "user_current_password"
}
```

Requires:

- Valid JWT token (user must be authenticated)
- User's current password for confirmation

### Response (200 OK)

```json
{
  "success": true,
  "message": "Account successfully deleted",
  "deletedAt": "2026-02-05T12:34:56.789Z"
}
```

### Error Responses

| Status | Cause               | Response                                             |
| ------ | ------------------- | ---------------------------------------------------- |
| 400    | Missing password    | `{ error: "Password required" }`                     |
| 401    | Invalid password    | `{ error: "Invalid credentials" }`                   |
| 401    | Invalid/missing JWT | `{ error: "Unauthorized" }`                          |
| 405    | Invalid HTTP method | `{ error: "Method not allowed" }`                    |
| 500    | Server error        | `{ error: "Internal server error", message: "..." }` |

---

## What Gets Deleted

When an account is deleted, the following data is permanently removed:

### Direct User Data

- `auth.users` record (Supabase Auth)
- User profile / settings
- Authentication secrets and sessions
- All personal preferences

### Related Data (via cascading deletes)

- All worlds owned by the user
- Campaign data for all worlds
- Character sheets
- Campaign notes
- Encounters and battles
- Items and inventory
- Relationships and friendships

### Offline/Cache Data

- Local secure storage (app clears on logout)
- Browser cache (if web app)

**Note:** Data is permanently deleted. There is no recovery or restoration option.

---

## Implementation Details

### JWT Verification

- Extracts user ID from JWT `sub` claim
- Validates JWT signature using `SUPABASE_JWT_SECRET`
- Returns 401 if token is invalid or missing

### Password Verification

- Retrieves user's current password hash from Supabase Auth
- Compares provided password against stored hash
- Returns 401 if passwords don't match
- Double-checks user ID match before deletion

### Cascading Deletion Strategy

Uses SQL foreign key cascade:

```sql
DELETE FROM auth.users WHERE id = user_id;
-- Cascades to:
-- - user_profiles
-- - worlds (owned)
-- - campaigns
-- - characters
-- - encounters
-- etc.
```

---

## Client Integration

Typically invoked from `lib/auth/auth-state.ts` during account deletion flow:

```typescript
// After user confirms deletion password
const response = await supabase.functions.invoke("delete-account", {
  method: "POST",
  body: JSON.stringify({ password: userPassword }),
});

if (response.success) {
  // Clear local auth state
  // Logout user
  // Redirect to login screen
}
```

---

## Security Considerations

### Password Confirmation Required

- Prevents accidental deletion via session hijacking
- Even if JWT is compromised, attacker can't delete without password

### No Soft Deletes

- Permanent deletion, not archive
- Complies with GDPR "right to be forgotten"
- No recovery window

### Audit Logging

- Consider adding audit trail to `account_deletion_log`:
  - When deleted
  - By which user
  - IP address / user agent (for fraud detection)

---

## Troubleshooting

### Function returns 500

Check Dashboard function logs:

1. Dashboard > `Functions` > `delete-account` > `Logs`
2. Look for SQL errors or permission issues
3. Verify cascading delete relationships are correct

### Password verification fails

- Ensure password matches what user entered in auth form
- Verify Supabase Auth is operational
- Check password isn't expired or locked

### JWT verification fails

- Ensure Bearer token format: `Authorization: Bearer <token>`
- Verify token was issued by Supabase
- Check token has not expired

---

## Future Enhancements (Phase 2+)

- **Data Export Before Deletion** — Allow user to download backup
- **Soft Delete Window** — 30-day grace period to recover
- **Admin Override** — Admins can delete users for policy violations
- **Audit Trail** — Log all account deletions for compliance
- **Gradual Deletion** — Async cleanup for large data sets
