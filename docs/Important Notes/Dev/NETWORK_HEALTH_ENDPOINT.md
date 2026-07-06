# Network Health Endpoint

Developer reminder for the app's web connectivity check path.

## Current Status

This is already implemented.

- `system/Network/network-detection.ts` uses a backend health endpoint for periodic web ping checks.
- `system/Services/backend-availability.ts` builds the health URL from config and supports an explicit override.
- `lib/database/edge/functions/health/README.md` documents the current Supabase health function used by that flow.

The repo is no longer in the earlier state where connectivity depended on the public Cloudflare trace endpoint.

## Current Flow

The current runtime flow is:

1. network detection schedules periodic web pings
2. the ping path asks `getBackendHealthUrl()` for the target URL
3. it sends a `HEAD` request to that endpoint
4. the result is used to update connectivity state and latency tracking

This is already the owned-infrastructure version of the older reminder.

## Why Keep This Note

This is no longer an upcoming feature reminder.

It is still useful as a small dev note because backend changes can accidentally break connectivity checks.

Things to protect:

- keep the endpoint path stable
- keep the endpoint callable by `GET` or `HEAD`
- update `getBackendHealthUrl()` if backend routing changes
- avoid auth changes that would turn the health path into a false offline signal

## Workflow Caveat

The current health function is documented as dashboard-managed rather than CLI-managed.

If deployment workflow changes later, update the reference docs so the repo stays aligned with the real deployment path.