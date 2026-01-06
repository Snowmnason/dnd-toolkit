# Global Error Boundary & Crash Reporting

This note describes how we capture unhandled UI errors and report them to Sentry. It is intended for future collaborators to understand the moving pieces and where to extend/debug.

## Components
- **Global React error boundary**: `lib/error/ErrorBoundary.tsx` (`AppErrorBoundary`)
- **Logger**: `lib/utils/logger` (console + structured logging)

## How the Error Boundary works
- Wraps the app tree and catches render/commit-time errors from React components.
- On error, it:
  - Sets `hasError` so a fallback UI can render.
  - Logs the error and component stack via `logger.error`.
  - Calls `Sentry.captureException(error, { contexts: { react: { componentStack }}})`.
  - If Sentry is unavailable (e.g., web without DSN), it logs a warning instead of crashing.
- Consumers can pass `renderFallback(error, retry)` to show a custom crash screen and let the user retry; `retry` resets the boundary state.

## Request errors
- Request-level Sentry reporting is documented separately in [035 - Api Requesting](../035%20-%20Api%20Requesting/).

## Sentry configuration
- DSN is read from app config/env (see `app.json` and `.env` vars like `EXPO_PUBLIC_SENTRY_DSN`).
- Uses `@sentry/react-native`, which works for native and web; if DSN is missing or Sentry cannot initialize, reporting is skipped gracefully.
- No PII is added by default; only error object and component stack are sent.

## Runtime behavior
- Web/Native/Desktop all share the same boundary and reporting code.
- If Sentry is unreachable, the app continues to function; logging still goes to console.
- In production builds, the boundary prevents hard crashes from bubbling to the shell; users see the fallback UI if provided.

## Where to hook in or extend
- **Customize fallback UI**: provide `renderFallback` to `AppErrorBoundary` at the app root.
- **Add context**: extend `Sentry.captureException` calls (boundary or request manager) with more context (user, world, feature flags) as needed—ensure no sensitive data is added.
- **Filter noise**: adjust request keys/contexts in `request-manager` to reduce duplicate events.

## Operational notes
- To verify reporting: trigger a test error in dev with a valid DSN; check Sentry for the event and ensure component stack/request context appear.
- If events are missing: confirm DSN is present in env, Sentry is initialized, and network egress is allowed.
- If the UI shows blank without fallback: ensure `AppErrorBoundary` wraps the root and `renderFallback` is wired where desired.
