# invite-link-cleanup Edge Function

Scheduled cleanup of expired invite links and stale invitations.

## ⚠️ Dashboard Management

**This function is managed in the Supabase Dashboard, NOT via CLI.**

The files in this directory are **reference copies** for team visibility and version control. When updating the function:

1. Copy the relevant code from this directory
2. Paste into the Supabase Dashboard editor (`Functions` > `invite-link-cleanup`)
3. Deploy from Dashboard
4. Commit updated reference files to repo

**Future:** When migrating to Supabase CLI (Phase 2+), this will become the source of truth. No code changes needed.

**See also:** [Supabase Edge Functions Overview](../README.md)

---

## Purpose

Periodically runs (e.g., daily scheduled job) to:

- Mark expired invites as `revoked = true`
- Delete orphaned invite links (invite doesn't exist, link is stale)
- Clean up `invited_users` table of expired entries
- Prevent clutter and improve database performance

---

## Invocation

### Manual Invocation (Testing)

```bash
# Dry-run (no deletions, just report what would happen)
curl -X POST \
  https://your-supabase-url/functions/v1/invite-link-cleanup \
  -H "Authorization: Bearer your_admin_jwt" \
  -H "Content-Type: application/json" \
  -d '{ "dry_run": true }'

# Actual cleanup
curl -X POST \
  https://your-supabase-url/functions/v1/invite-link-cleanup \
  -H "Authorization: Bearer your_admin_jwt" \
  -H "Content-Type: application/json" \
  -d '{ "dry_run": false }'
```

### Request

```json
{
  "dry_run": false
}
```

Optional:

- `dry_run: true` — Report what would be deleted without making changes (default: false)

### Response (200 OK)

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

### Error Responses

| Status | Cause               | Response                                             |
| ------ | ------------------- | ---------------------------------------------------- |
| 401    | Invalid/missing JWT | `{ error: "Unauthorized" }`                          |
| 405    | Invalid HTTP method | `{ error: "Method not allowed" }`                    |
| 500    | Database error      | `{ error: "Internal server error", message: "..." }` |

---

## Implementation Details

### What Gets Cleaned Up

#### 1. Expired Invite Links

```sql
UPDATE invite_links
SET revoked = true
WHERE expires_at < now() AND revoked = false
```

**Action:** Mark as revoked, keep for history.

#### 2. Orphaned Links

```sql
DELETE FROM invite_links
WHERE world_id NOT IN (SELECT id FROM worlds)
  AND created_at < now() - interval '7 days'
```

**Action:** Hard delete (not revoked).

#### 3. Expired Invitations

```sql
DELETE FROM invited_users
WHERE expires_at < now() - interval '7 days'
```

**Action:** Hard delete stale records.

### Dry-Run Mode

When `dry_run: true`:

- Runs all queries with `EXPLAIN` instead of actual execution
- Reports expected row counts
- No data modifications
- Safe for monitoring

---

## Scheduling

### Current Setup (Phase 1 - Manual)

Currently requires manual invocation via Dashboard or CLI. Schedule:

- **Frequency**: Daily at 2 AM UTC (low-traffic window)
- **Isolation**: Minimal impact on user queries

### Future Setup (Phase 2 - Cron)

Will use Supabase scheduled functions (pg_cron):

```sql
-- Run daily at 2 AM UTC
SELECT cron.schedule('invite-link-cleanup', '0 2 * * *',
  'SELECT http_post(''https://your-edge-function-url/invite-link-cleanup'')');
```

---

## Monitoring & Alerts

### Check Recent Runs

Dashboard > `Functions` > `invite-link-cleanup` > `Logs`:

- Look for success/error messages
- Monitor row counts in summary
- Alert if no cleanup happened (might indicate problem)

### Expected Behavior

- **Normal**: 10-50 links cleaned per day (depends on user churn)
- **Elevated**: >100 links cleaned (check for malicious invites)
- **Zero**: Unusual, investigate logs

---

## Security Considerations

### Admin-Only Access

- Requires valid JWT from authenticated admin
- Uses service role key internally for cleanup
- Cannot be invoked by regular users

### Transaction Safety

- All operations wrapped in transactions
- Rollback if any operation fails (consistency guaranteed)
- Dry-run for validation before actual cleanup

### Data Integrity

- Only deletes orphaned or properly expired data
- Never modifies active invites
- Preserves audit trail (soft delete via revoke flag where appropriate)

---

## Troubleshooting

### Function logs show 500 errors

Check:

1. `SUPABASE_DB_URL` environment variable is set correctly
2. PostgreSQL connection string is valid
3. Database user has necessary permissions
4. No active long-running transactions blocking cleanup

### Cleaning up 0 records

Possible causes:

- No expired links exist (healthy state)
- Check your invite link TTL configuration
- Verify `expires_at` column is populated

### High memory usage

If processing very large result sets:

- Consider batching deletes (process 1000 records at a time)
- Monitor cold-start duration
- Consider moving to scheduled stored procedure

---

## Client Integration

Typically invoked by:

- Admin dashboard (manual cleanup)
- Scheduled job runner (automated daily)
- Never by end users (not exposed in public API)

---

## Future Enhancements (Phase 2+)

- **Cron Integration** — Automatic daily scheduling via pg_cron
- **Batch Processing** — Process large datasets in chunks (memory efficiency)
- **Email Notifications** — Alert admins of unusual cleanup patterns
- **Audit Trail** — Log all cleanup operations to `audit_log`
- **Configurable TTL** — Allow custom invite link expiration policies
- **Retention Policy** — Archive deleted links instead of hard delete
