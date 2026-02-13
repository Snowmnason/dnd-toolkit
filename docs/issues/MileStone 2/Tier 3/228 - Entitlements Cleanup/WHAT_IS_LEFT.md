# Entitlements Cleanup — What's Left / Next Work

This file lists the deferred items and concrete work needed to finish entitlement lifecycle management beyond the Tier 3 foundation.

High-level deferred items

1. **Reminder delivery system**
   - Implement an in-app notification queue (store dismissals/24h re-remind logic).
   - Optionally integrate push/email providers for critical reminders.
   - Track which entitlements have been reminded and how many times.
   - Acceptance: scheduled job enqueues reminders; client displays reminders; respects `entitlements.remind_user` flag and re-reminder interval from config.

2. **Entitlement reminders job (full implementation)**
   - Complete the stub at `lib/jobs/entitlements-reminders.ts`.
   - Query expiring entitlements (within reminder window from config).
   - Check `remind_user = true`.
   - Enqueue notifications in the queue.
   - Track reminder sent/dismissed state (optional: add small table or queryable state).
   - Acceptance: job finds entitlements expiring soon, enqueues reminders, respects re-reminder interval if user dismissed.

3. **Billing and renewal flows**
   - Integrate payment provider, map subscriptions → entitlements, and implement renewal UI.
   - Modal "Renew" button → billing/subscription page.
   - Acceptance: subscription purchases create entitlements; renewals extend `expires_at` and set `is_active = true`.

4. **Analytics and metrics**
   - Track lifecycle events (expiry, warning shown, renewal clicked, dismissed, auto-cleanup).
   - Add dashboards/reports.
   - Acceptance: events exist in `lib/analytics/events.ts` and show up in analytics backend.

5. **Per-user-per-entitlement reminder overrides (optional)**
   - Allow users to opt a specific entitlement on/off independently of the global entitlement setting.
   - Add optional table `feature_flag.entitlement_reminder_overrides(user_id, entitlement_key, remind boolean, expires_at?)`.
   - Acceptance: users can toggle reminders per entitlement; API checks override before entitlement default.

6. **Testing and CI**
   - Unit tests for cleanup/reminder job logic.
   - Integration tests for job → DB update → audit log.
   - Manual tests for modal UI flow and re-reminder timing.
   - Acceptance: tests added to `__tests__` and pass in CI.

Suggested prioritization (next sprint)

- **P0**: Reminder delivery system + entitlements-reminders job completion (blocking UX). 3-5 days.  
- **P1**: Billing integration (depends on provider choice). 1-2 weeks.  
- **P2**: Analytics, audit wiring, and tests. 2-4 days.
- **P3**: Per-user overrides (optional polish). 1-2 days.

Quick notes for implementers

- The cleanup job is already in place and configurable (`lib/config/entitlements.ts`); focus on the reminder enqueue side.
- Use the existing queue patterns from `lib/jobs/` for consistency.
- Respect RLS when querying; prefer SECURITY DEFINER RPCs for server-side operations.
- The modal is minimalist by design — extend with renewal buttons when billing is ready.
- Keep the config file simple; avoid hardcoding values that might change per environment.


