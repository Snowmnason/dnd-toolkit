# API Request Layer – Plan Guide (Issue 035)

## Goals (in scope)
- Introduce a lightweight request manager (`lib/api/request-manager.ts`) that centralizes fetches, dedupes in-flight requests, and retries with backoff.
- Provide a fail-open toggle so callers can choose to return errors quickly (don’t block UI/offline scenarios) instead of hard-failing.
- Optional per-call rate limiting (simple token-bucket or cooldown) to avoid flooding Supabase/API.
- Integrate an error hook to forward failures to Sentry now; leave clear extension points for offline buffering later.
- Refactor key hooks/data loaders to use the manager, starting with high-traffic reads (world list/detail, notes). Reduce duplicate Supabase calls.
- For auth/session flows: consult cached session first to cut calls, but still require server validation before granting access (no offline bypass).

## Out of scope (document only)
- Full offline mode or queued writes.
- Offline Sentry buffering; just leave a stub/hook for future use.
- Allowing auth bypass when offline; cache is for pre-check/optimistic UX only.

## Request manager shape (proposed)
- Location: `lib/api/request-manager.ts`.
- Core API:
  ```ts
  type RequestOptions = {
    dedupeKey?: string;         // Key to dedupe in-flight requests
    dedupe?: boolean;           // Enable dedupe; defaults true when dedupeKey is provided
    retries?: number;           // Default 3
    retryDelayMs?: number;      // Default 500ms, backoff *= 2
    failOpen?: boolean;         // If true, surface error immediately (callers decide UI), default false
    rateLimitKey?: string;      // Optional bucket key
    rateLimit?: { tokens: number; refillMs: number; }; // Simple token bucket
    onError?: (error: unknown) => void; // Defaults to shared Sentry hook
  };

  async function request<T>(fetcher: () => Promise<T>, options?: RequestOptions): Promise<T>
  ```
- Behavior:
  - Dedupes by `dedupeKey` (Map of in-flight Promises). Cleans up on settle.
  - Retries with exponential backoff until retries exhausted; surfaces last error.
  - `failOpen`: when true, skip retries/backoff and return/throw immediately so UI can fallback without blocking (useful offline).
  - Rate limiting: optional token bucket per `rateLimitKey`; if empty and failOpen is true, short-circuit with an error so UI can degrade gracefully.
  - Hooks: `onError` calls a shared reporter (Sentry) with context (dedupeKey, rateLimitKey, attempt count).

## Sentry/error handling
- Provide a shared `reportRequestError(error, context)` in the manager; default `onError` uses it.
- Keep a stub for offline queuing (e.g., `queueErrorForFlush`) but leave unimplemented.

## Auth/session considerations
- For login/session restore: check cached session/token first (existing auto-login) to reduce Supabase calls.
- Still require Supabase validation before granting access; no offline bypass.
- Use `failOpen` carefully: for auth flows, keep `failOpen = false` so failures surface; for non-critical reads, callers may opt-in to fail-open.

## Targets to refactor first
1) World list fetch
2) World detail fetch
3) Notes fetch/loaders
(Optionally later: items/treasure, combat events, story notes once pattern is stable.)

## Keys & conventions
- `dedupeKey`: `${resource}:${id}` (e.g., `world:123`, `notes:world-123`).
- `rateLimitKey`: match resource (`world`, `notes`) to share buckets.
- Default options: retries=3, retryDelayMs=500, dedupe=true when key provided, failOpen=false.

## Rollout steps
1) Implement manager with dedupe, retry/backoff, fail-open, optional rate limiting, Sentry hook stub.
2) Add lightweight tests (unit) for dedupe, retries/backoff, and failOpen behavior.
3) Refactor targeted hooks/data loaders to use the manager; keep signatures stable for callers.
4) Verify auth flows still validate with Supabase; use cache only as pre-check.
5) Add short docs/comments on how to extend with offline buffering later.

## Future hooks (not now)
- Offline cache/queue for writes and error reports.
- Smarter backoff/rate-limit coordination (global budgets, jitter tuned per endpoint).
- Metrics/telemetry for request success/failure rates.
