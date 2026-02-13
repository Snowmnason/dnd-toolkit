# Entitlements Cleanup — Usage Guide

Purpose
-------
This file documents the minimal Tier 3 foundation added for entitlement lifecycle management so developers and operators can deploy and extend it later.

Quick summary
- Per-entitlement `remind_user` boolean determines if a user is reminded when the entitlement expires.
- Grace period (default: 7 days after expiry) before marking entitlements inactive.
- Configurable reminder window, re-reminder interval, and max reminder count in the app config under the `entitlements` section (`config/appsettings.json` / `config/appsettings.dev.json`).
- Background job `entitlements-cleanup.ts` marks expired entitlements inactive.
- Placeholder modal exists at `components/modals/EntitlementExpiredModal.tsx` (basic Close button only).
- Delta migration available at `supabase/migrations/006_add_remind_user_entitlements.sql` for existing databases.

Configuration
--------------
Behavior settings live in the app config. Edit `config/appsettings.json` (production) or `config/appsettings.dev.json` (development) and modify the `entitlements` section. Example:

```json
"entitlements": {
  "gracePeriodDays": 7,
  "reminderWindowDays": 7,
  "rereminderIntervalHours": 24,
  "maxRemindersPerExpiry": 5,
  "dryRunMode": false,
  "debugLogging": false
}
```

Adjust these values to change job behavior per environment without modifying code.

Where the code lives
- Base migration (fresh DB): `supabase/migrations/003_feature_flags_schema.sql` (contains `remind_user`).
- Delta migration (existing DBs): `supabase/migrations/006_add_remind_user_entitlements.sql`.
-- Config: `config/appsettings.json` / `config/appsettings.dev.json` (see `entitlements` section).
- DB helpers: `lib/database/entitlements.ts` (setEntitlementReminderFlag, fetchRemindableEntitlements).
- Jobs: `lib/jobs/entitlements-cleanup.ts` (main), `lib/jobs/entitlements-reminders.ts` (stub).
- Modal component: `components/modals/EntitlementExpiredModal.tsx`.
- Hook: `hooks/entitlements/useEntitlementExpiredModal.ts` (state management).
- Docs: `docs/Important Notes/Database/SCHEMA.md`, `docs/Important Notes/Database/RLS.md`.

Deploying the migration
1. For new deployments: the base migration `003_feature_flags_schema.sql` already contains the `remind_user` column.
2. For existing deployments: run the delta migration `006_add_remind_user_entitlements.sql` against the database.

Example using `psql` (service account or CI runner with DB access):
```bash
psql "$DATABASE_URL" -f supabase/migrations/006_add_remind_user_entitlements.sql
```

Notes on rolling changes
- The delta migration is additive and idempotent (`ADD COLUMN IF NOT EXISTS`); it is safe to run multiple times.
- After it has been applied in production/staging, you can optionally delete the delta file from the repo (but keep a copy in release notes).

Database schema
- `feature_flag.entitlements.remind_user` (boolean, default true) — controls whether this entitlement triggers reminders.
- RLS policies on `feature_flag.entitlements` already allow authenticated users to read entitlements they own.
- No new policies required for the `remind_user` column.

Using the DB helpers
```typescript
import { setEntitlementReminderFlag, fetchRemindableEntitlements } from '@/lib/database/entitlements';

// Disable reminders for a specific entitlement
await setEntitlementReminderFlag(entitlementId, false);

// Fetch all entitlements that should remind this user
const entitlementsToRemind = await fetchRemindableEntitlements(userId);
```

Running the cleanup job
```typescript
import { handleEntitlementsCleanup } from '@/lib/jobs/entitlements-cleanup';
import { getJobQueue } from '@/lib/jobs';

const queue = getJobQueue();

// Register the handler during app bootstrap
queue.registerHandler('entitlements_cleanup', async (payload, ctx) => {
  return await handleEntitlementsCleanup(payload, ctx);
});

// Trigger the job
queue.enqueue('entitlements_cleanup', { gracePeriodDays: 7, dryRun: false });
```

Extensibility notes
- When adding per-user-per-entitlement reminder overrides, create a small table `feature_flag.entitlement_reminder_overrides(user_id, entitlement_key, remind boolean, ...)` and query it alongside the entitlement flag.
- If enabling notifications (push/email), implement a notification queue to respect the `remind_user` flag and re-reminder interval.


