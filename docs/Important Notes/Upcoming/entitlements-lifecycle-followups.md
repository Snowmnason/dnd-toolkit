# Entitlements Lifecycle Follow-Ups

Future work that remains after the entitlement cleanup and expiry foundation landed.

## Current Status

The foundation is already present in code.

- `lib/database/entitlements.ts` and the repository layer already expose `remind_user` and expiry-related reads.
- `components/modals/EntitlementExpiredModal.tsx` already exists as a basic expired-entitlement UI surface.
- entitlement reminder config already exists in `config/appsettings.json` and `config/appsettings.dev.json`.
- `lib/jobs/entitlements/entitlements-reminders.ts` exists, but it is still a placeholder job.

So this is no longer greenfield work. The repo has the data fields, config knobs, and some UI scaffolding already.

## What Is Still Missing

### Reminder Job Completion

The clearest unfinished item is the reminder job.

Current state:

- the job file exists
- it logs startup
- it returns a deferred placeholder result
- it does not yet query expiring entitlements or enqueue reminder UI

That means the reminder pipeline is discoverable in code, but not functionally active.

### Reminder Delivery Flow

The repo still needs a real delivery path for expiring entitlements.

Likely future flow:

1. query entitlements expiring within the configured reminder window
2. respect `remind_user` and any future dismissal or re-reminder state
3. enqueue an in-app reminder
4. allow dismiss or renew actions
5. re-remind only after the configured interval when appropriate

### Renewal And Billing Integration

The UI language already anticipates a renew path, but there is no full billing or subscription flow wired here yet.

This becomes relevant when:

- subscription purchases create entitlements
- renewal actions extend `expires_at`
- expired entitlement UI can take the user to a real purchase or renewal destination

### Reminder Analytics And Auditability

The job stub and earlier issue notes both point at the same future need: track reminder behavior.

Useful future signals:

- reminder shown
- reminder dismissed
- renew clicked
- entitlement expired
- entitlement auto-cleaned

## Example Future Flow

```text
Entitlement nearing expiry
        ↓
reminder job finds it inside reminderWindowDays
        ↓
job checks remind_user + re-reminder rules
        ↓
in-app reminder is enqueued
        ↓
user dismisses or opens renew flow
        ↓
job respects dismissal window before reminding again
```

## Priority

Medium.

The reminder job is the most concrete follow-up. Renewal and billing remain important, but they depend on broader subscription infrastructure.