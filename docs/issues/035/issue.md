## Problem
Supabase/API calls are scattered throughout the codebase with no retry logic, request deduplication, or rate limiting protection. 

## Why it Matters
- Flaky network = failed requests, no retries
- Multiple components may fetch identical payloads in parallel and duplicate work
- No protection from rate limiting or server overload

## Proposed Solution
- Implement an API request layer (`lib/api/request-manager.ts`)
  - Centralizes all requests
  - Deduplicates in-flight requests by key
  - Adds retries with exponential backoff
  - Optionally supports rate limiting/flood control
- Refactor hooks/data loaders to use this service

## Example Implementation
```typescript
export const RequestManager = {
  pendingRequests: new Map<string, Promise<any>>(),
  async fetch<T>(key: string, fetcher: () => Promise<T>, options?:  { dedupe?: boolean; retries?: number; retryDelay?: number }): Promise<T> {
    if (options?.dedupe && this.pendingRequests.has(key)) return this.pendingRequests.get(key)!;
    const request = this.withRetry(fetcher, options?. retries ??  3, options?. retryDelay ??  1000);
    if (options?.dedupe) {
      this.pendingRequests.set(key, request);
      request.finally(() => this.pendingRequests.delete(key));
    }
    return request;
  },
  async withRetry<T>(fn: () => Promise<T>, retries: number, delay: number): Promise<T> {
    try { return await fn(); } catch (error) {
      if (retries <= 0) throw error;
      await new Promise(r => setTimeout(r, delay));
      return this.withRetry(fn, retries-1, delay*2);
    }
  }
};
```

## Benefits
- Fewer duplicate requests
- Robust to transient network/server failures
- Effective rate limiting and flood protection

## Plan (in-scope)
- Build lightweight request layer in `lib/api/request-manager.ts` with dedupe + retry/backoff and a "fail-open" switch (can short-circuit to caller so UI doesn’t hang when offline/disabled).
- Provide optional rate limiting hook (basic token bucket or simple cooldown) that can be toggled per-call.
- Add error hook to forward failures to Sentry; no offline queue yet, just a clear extension point for future buffering.
- Refactor key data loaders/hooks to use the manager; start with high-traffic reads (world list, world detail, notes) to reduce duplicate Supabase calls.
- For auth-sensitive flows (login/session restore), first check cached session/credentials (existing auto-login) to cut Supabase calls; still require server validation before granting access (no offline bypass).

## Out of scope (document only)
- Full offline mode, cached write queue, or delayed Sentry shipping (leave hook stubs/comments only).
- Broad auth bypass when offline—must still validate with Supabase; cache is only for pre-checks/optimistic UX.

## Delivery checkpoints
1) Implement `request-manager` with dedupe + retry/backoff + fail-open flag + optional rate limiting toggle.
2) Wire Sentry reporting hook and surface extension point for offline buffering (commented/stubbed).
3) Migrate targeted hooks/data loaders (world list/detail, notes) to the manager; verify no behavior regressions.
4) Add doc/comments on how to disable requests when offline and how to extend to offline caching later.
