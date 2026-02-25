# Background Job Queue - Usage Guide

Quick reference for using the BackgroundJobQueue to schedule reliable background tasks.

## Overview

The Background Job Queue persists and retries background work across app restarts. Use it for:
- **Feature flag refresh** – Update subscription/feature state from server
- **Periodic syncs** – Refresh data on a schedule
- **Deferred work** – Tasks that can wait and retry safely

**Do NOT use for:**
- User mutations (use [OfflineMutationQueue](../../lib/offline/README.md) instead)
- High-frequency tasks (polling should use native background APIs)
- Sensitive auth operations (handle those via AppKernel auth phase)

---

## Basic Usage

### 1. Register a Handler (During Bootstrap)

Handlers are registered in `lib/kernel/app-kernel.ts` during the NETWORK phase:

```typescript
const { getJobQueue } = await import("@/lib/jobs");
const queue = getJobQueue();

queue.registerHandler("feature_flags_refresh", async (payload, ctx) => {
  const { SubscriptionManager } = await import("@/lib/premium");
  await SubscriptionManager.refresh();
  return { updatedAt: Date.now() };
});
```

**Handler Requirements:**
- Must be **idempotent** (safe to retry multiple times)
- Must be **async** (return Promise)
- Context includes: `jobId` and `retryCount` (for logging)
- Can throw errors or return results

### 2. Enqueue a Job

Enqueue when you want to trigger background work:

```typescript
import { getJobQueue } from "@/lib/jobs";

const queue = getJobQueue();
const jobId = await queue.enqueue({
  type: "feature_flags_refresh",
  payload: { worldId: "world_123" },
  idempotencyKey: `ff-refresh:world_123`, // Prevents duplicate enqueues
  requiresNetwork: true, // Defers job if offline
});
```

**Enqueue Options:**
- `type` (required) – Handler type name
- `payload` (required) – Job-specific data
- `idempotencyKey` (optional) – Prevent duplicate jobs with same key
- `runAt` (optional) – When to run (default: now)
- `requiresNetwork` (optional) – Network requirement mode (see below)

---

## Network-Aware Jobs

Three modes for handling offline scenarios:

### Mode 1: Offline-Capable (default)
```typescript
// No requiresNetwork needed - job runs anytime
await queue.enqueue({
  type: "save_local_cache",
  payload: { data: "..." },
  // requiresNetwork: false (default)
});
```
✅ Runs even if offline  
❌ Handler receives no network status

### Mode 2: Online-Required
```typescript
await queue.enqueue({
  type: "feature_flags_refresh",
  payload: {},
  requiresNetwork: true, // Defer if offline
});
```
✅ Gracefully defers if offline (no error)  
✅ Auto-retries when network returns  
❌ Won't run until online

### Mode 3: Hybrid
```typescript
await queue.enqueue({
  type: "profile_sync",
  payload: { userId: "..." },
  requiresNetwork: "defer", // Try online, defer if offline
});
```
✅ Runs online if possible  
✅ Falls back to offline mode if needed  
⚠️ Handler must handle both scenarios

---

## Integration Points

### On App Resume
When the app resumes (foreground), `OnlineSyncManager.resume()` automatically:
1. Triggers sync of queued mutations
2. Enqueues a `feature_flags_refresh` job

This ensures features are up-to-date when user returns.

### On Network Reconnect
The job queue checks network status in `runNext()`:
- If job requires network but offline → defer 5s, retry when online
- If job is offline-capable → runs immediately
- Hybrid jobs attempt online first, defer if fails

---

## Monitoring

### Check Queue Status

```typescript
import { getQueueStatus } from "@/lib/jobs";

const status = getQueueStatus();
console.log(status);
// {
//   totalPending: 5,
//   totalRunning: 1,
//   totalCompleted: 42,
//   totalFailed: 2,
//   byType: {
//     "feature_flags_refresh": { pending: 1, running: 0, completed: 20, failed: 0 }
//   }
// }
```

### Listen for Job Events

```typescript
const queue = getJobQueue();

queue.subscribe("completed", (event) => {
  console.log(`Job ${event.jobId} completed in ${event.durationMs}ms`);
});

queue.subscribe("failed", (event) => {
  console.log(`Job ${event.jobId} failed: ${event.error}`);
});
```

---

## Error Handling

### Automatic Retry
Jobs with network errors automatically retry with exponential backoff:
- 1st retry: 1 second delay
- 2nd retry: 2 seconds delay
- 3rd retry: 4 seconds delay
- ... (capped at 32 seconds)

### Permanent Failures
After max retries (default: 5), job is marked `failed` but stays in queue for debugging.

### Custom Error Handling
In your handler:
```typescript
queue.registerHandler("my_job", async (payload, ctx) => {
  try {
    await someRiskyOperation();
  } catch (error) {
    // Automatic retry on network errors
    if (error.message.includes("network")) {
      throw error; // Queue will retry
    }
    // Non-retryable errors should be handled by handler
    logger.category('other').error("Permanent failure", error);
    return { failed: true, reason: error.message };
  }
});
```

---

## Best Practices

✅ **Do:**
- Keep handlers **idempotent** (can run multiple times safely)
- Use **idempotencyKey** to prevent duplicate jobs
- Log with `logger.category("jobs")` for debugging
- Return a result object for tracking completion
- Use `requiresNetwork: true` for server-dependent work

❌ **Don't:**
- Assume jobs run once (they may retry)
- Modify global state in handlers (use callbacks instead)
- Enqueue jobs without checking for duplicates
- Use for high-frequency polling (use native APIs instead)
- Ignore network status (use appropriate `requiresNetwork` mode)

---

## Examples

### Example 1: Feature Flags Refresh (Server-Dependent)
```typescript
// In app-kernel.ts bootstrap
queue.registerHandler("feature_flags_refresh", async (payload, ctx) => {
  logger.category("jobs").info(`Refreshing feature flags (retry: ${ctx.retryCount})`);
  const { SubscriptionManager } = await import("@/lib/premium");
  await SubscriptionManager.refresh();
  return { updatedAt: Date.now() };
});

// Enqueue on app resume (automatic in OnlineSyncManager)
await queue.enqueue({
  type: "feature_flags_refresh",
  payload: { triggeredAt: Date.now() },
  idempotencyKey: `ff-refresh:${Date.now()}`,
  requiresNetwork: true,
});
```

### Example 2: Local Cache Cleanup (Offline-Capable)
```typescript
queue.registerHandler("cleanup_cache", async (payload, ctx) => {
  const { QueryCache } = await import("@/lib/cache");
  await QueryCache.prune({ olderThan: 24 * 60 * 60 * 1000 });
  return { prunedAt: Date.now() };
});

// Enqueue for cleanup
await queue.enqueue({
  type: "cleanup_cache",
  payload: {},
  runAt: Date.now() + 60000, // Run in 1 minute
});
```

### Example 3: Hybrid Sync (Online-Preferred)
```typescript
queue.registerHandler("profile_sync", async (payload, ctx) => {
  const { supabase } = await import("@/lib/database/supabase");
  
  // Try to sync with server
  if (supabase && isSupabaseConfigured()) {
    const result = await supabase.from("profiles").update(payload.data);
    if (!result.error) return { synced: true };
  }
  
  // Fall back to local cache if offline/unavailable
  const { QueryCache } = await import("@/lib/cache");
  await QueryCache.set(payload.cacheKey, payload.data);
  return { cached: true };
});
```

---

## Testing

See [background-jobs.md](../../../A%20Testing%20Guide/Both/background-jobs.md) for QA test scenarios including offline, restart, and deduplication testing.

---

## Troubleshooting

**Q: Job never runs**
- Check: Is it in `pending` status? Run `getQueueStatus()`
- Solution: Call `getJobQueue().runNext()` to process next job
- Automatic: Jobs run on app resume via `OnlineSyncManager.resume()`

**Q: Job keeps retrying indefinitely**
- Check: Is handler throwing error every time?
- Solution: Ensure handler is idempotent and catches non-retryable errors
- View: Check logs with `logger.category("jobs")`

**Q: Duplicates being enqueued**
- Check: Are you using idempotencyKey?
- Solution: Always use `idempotencyKey: unique-identifier`
- Verify: `getQueueStatus()` shows duplicates in pending

**Q: Jobs not deferred when offline**
- Check: Is `requiresNetwork` set?
- Solution: Use `requiresNetwork: true` for network-dependent jobs
- Verify: Check NetworkDetection.getStatus().isOnline in logs

---

## Related Documentation

- [lib/jobs README](../../../lib/jobs/README.md) – Full API reference
- [OfflineMutationQueue](../../../lib/offline/README.md) – For user mutations (create/update/delete)
- [OnlineSyncManager](../../../lib/offline/README.md#online-sync-manager) – Automatic sync on reconnect
- [NetworkDetection](../../../lib/network/README.md) – Network status monitoring
