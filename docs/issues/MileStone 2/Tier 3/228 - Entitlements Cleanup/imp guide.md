# 228 - Entitlements Cleanup (Tier 3)

Date: 2026-02-13

## Summary

This Tier 3 implementation adds scoped, minimal work to prepare entitlement lifecycle foundations. Users get reminders per entitlement (not globally), with configurable grace periods and reminder windows. No billing or heavy notification systems implemented — those are deferred to later milestones.

## What was added

### Database
- `UserSettings` TypeScript interface in `lib/database/users.ts` for type safety.
- Per-entitlement `remind_user` boolean on `feature_flag.entitlements` (default: `true` = always remind users).
- Base migration `003_feature_flags_schema.sql` includes `remind_user` column for fresh deployments.
- Delta migration `006_add_remind_user_entitlements.sql` for updating existing databases.

### Backend
- Entitlement settings live in the app config files `config/appsettings.json` and `config/appsettings.dev.json` (see the `entitlements` section). These control grace period, reminder window, re-reminder interval and debug mode per environment.
- DB helpers in `lib/database/entitlements.ts`:
  - `setEntitlementReminderFlag(entitlementId, remindUser)` — toggle reminder for a specific entitlement.
  - `fetchRemindableEntitlements(userId)` — query entitlements where `is_active=true` AND `remind_user=true`.
- Background job `lib/jobs/entitlements-cleanup.ts` that:
  - Marks expired entitlements (past grace period) as `is_active=false`.
  - Uses config values instead of hardcoded defaults.
  - Supports dry-run mode for testing.
- Background job stub `lib/jobs/entitlements-reminders.ts` (deferred implementation).

### UI
- Minimal placeholder modal `components/modals/EntitlementExpiredModal.tsx` with entitlement name and Close button.
- Modal barrel export updated (`components/modals/index.ts`).
- Hook `hooks/entitlements/useEntitlementExpiredModal.ts` for managing modal state/callbacks.
- Hook barrel export added (`hooks/entitlements/index.ts`).
- Modal wired into `app/_layout.tsx` with barrel imports.

### Documentation
- Updated `docs/Important Notes/Database/SCHEMA.md` to reflect `remind_user` on `feature_flag.entitlements` (default: true) and note that user-level reminders are per-entitlement.
- Removed global `remind_user` from `public.user_settings` documentation.
- This issue folder includes `USAGE_GUIDE.md` and `WHAT_IS_LEFT.md`.

## Design notes

- **Per-entitlement reminders**: Each entitlement has a `remind_user` flag. This allows:
  - Admins to grant entitlements that should/should not trigger reminders.
  - Users experience reminders when they acquire an entitlement close to expiry (not a global preference).
  - Multiple entitlements can be active simultaneously; each may or may not have reminders enabled.
- **Grace period**: Default 7 days post-expiry before marking `is_active=false`. Users can still renew during this window.
- **Reminder window**: Default 7 days before expiry. Job checks which entitlements expire in this window and whose `remind_user=true`.
- **Re-reminder interval**: Default 24 hours if user dismisses without choosing renewal. (Implementation deferred.)
- **Configuration-driven**: All settings in `lib/config/entitlements.ts` so ops can adjust behavior without code changes.

## Notes

- `002_worlds_schema.sql` intentionally unchanged.
- Audit coverage: existing `audit.audit_events` trigger on `feature_flag.entitlements` (from 004) automatically logs changes.
- No UI/notification system beyond placeholder modal; that work is deferred.

## Next steps (deferred)

- Reminder notification system (in-app queue, push, email).
- Billing/subscription integration.
- Analytics instrumentation.
- Extension: per-user-per-entitlement reminder overrides (optional table).

## Deployment

- **Fresh DBs**: Base migration `003_feature_flags_schema.sql` contains `remind_user` column.
- **Existing DBs**: Run delta migration `006_add_remind_user_entitlements.sql`.
- **Config**: Adjust `entitlements` in `config/appsettings.json` or `config/appsettings.dev.json` to control behavior per environment.
