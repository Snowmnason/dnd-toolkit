# Jobs Module

Persistent background job queue for managing deferred, retryable work across app restarts, network interruptions, and concurrent execution. Supports idempotency keys, exponential backoff, offline awareness, and status tracking.

## When to Use This Module

**Use the job queue for:**

- Scheduled/recurring tasks (feature flag refreshes, analytics batching)
- Retryable operations (anything that can fail temporarily and should retry with backoff)
- Offline-tolerant work (jobs that survive app crashes and network outages)
- Deduplication (prevent duplicate execution via idempotency keys)
- Observability (track job completion, failures, retry attempts)

**Don't use the job queue for:**

- Blocking synchronous work (all handlers must be async)
- Long-running operations (jobs should complete in <60 seconds)
- High-frequency events (use listeners instead, not job queue)
- Real-time operations (use direct API calls instead)
- User-initiated mutations (use `lib/offline/mutation-queue` for optimistic updates)

## Architecture & Data Flow

```
Register Handler (per job type)
        ↓
Enqueue Job (with payload, retry config, idempotency key)
        ↓
Persist to Storage (via StorageAdapter)
        ↓
runNext() executes next pending job
        ↓
Handler runs with context (retryCount, abortSignal)
        ↓
Success: Mark completed, emit JobCompletedEvent
Failure: Calculate backoff, schedule retry, emit JobFailedEvent
Network Unavailable (requiresNetwork=true): Defer until online
```

**Key Features:**

- **Persistent**: Jobs survive app crashes via encrypted storage
- **Idempotent**: Handlers must be safe to retry; dedup via idempotency keys
- **Offline-Aware**: Jobs with `requiresNetwork:true` defer until online
- **Exponential Backoff**: Failed jobs retry with calculated delay (1s base, 2x multiplier, jitter)
- **Concurrency Control**: Global + per-job-type concurrency limits
- **Status Tracking**: Pending, running, completed, failed states

## API Reference

### Initialize

#### `getJobQueue(): BackgroundJobQueue`

Get or create singleton job queue instance. Call during app bootstrap.

```typescript
const queue = getJobQueue();
await queue.initialize();
```

### Register Handlers

#### `registerHandler(jobType: string, handler: JobHandler): void`

Register async handler for job type. Called once at bootstrap.

```typescript
queue.registerHandler("feature_flags_refresh", async (payload, ctx) => {
  // ctx.retryCount: number of retries so far
  // ctx.abortSignal: can be used for cancellation (future)
  const result = await fetchFeatureFlags(payload.worldId);
  return result; // Cached for later
});
```

**Handlers must be idempotent** – Safe to call multiple times with same payload.

### Enqueue Jobs

#### `enqueue(options: EnqueueOptions): Promise<string>`

Enqueue a job. Returns job ID.

```typescript
// Simple: run ASAP
await queue.enqueue({
  type: "feature_flags_refresh",
  payload: { worldId: "world_123" },
});

// With deduplication (skip if pending)
await queue.enqueue({
  type: "feature_flags_refresh",
  payload: { worldId: "world_123" },
  idempotencyKey: "ff-refresh:world_123",
});

// Scheduled: run in 5 seconds
await queue.enqueue({
  type: "analytics_flush",
  payload: { events: [] },
  runAt: Date.now() + 5000,
});

// Custom retry: max 3 attempts instead of default 5
await queue.enqueue({
  type: "analytics_flush",
  payload: { events: [] },
  maxRetries: 3,
  baseBackoffMs: 2000,
});

// Priority: runs before "normal" and "low"
await queue.enqueue({
  type: "feature_flags_refresh",
  payload: { worldId: "world_123" },
  priority: "high",
});

// Offline-aware: defer if no network
await queue.enqueue({
  type: "sync_to_server",
  payload: { data: {...} },
  requiresNetwork: true,
});
```

### Run Jobs

#### `runNext(): Promise<number>`

Run next available pending job. Returns 1 if job ran, 0 if none available. Call periodically (or set up background polling).

```typescript
const processed = await queue.runNext();
console.log(`Processed ${processed} job(s)`);
```

#### `getStatus(jobId: string): Promise<JobStatus | null>`

Get current job status (pending, running, completed, failed).

```typescript
const job = await queue.getStatus(jobId);
console.log(job?.status, job?.lastError);
```

#### `peek(): Promise<JobRecord | null>`

Peek at next pending job without running it.

```typescript
const nextJob = await queue.peek();
if (nextJob) {
  console.log(`Next: ${nextJob.type} at ${new Date(nextJob.runAt)}`);
}
```

#### `getJobs(jobType: string, status: JobStatus): Promise<JobRecord[]>`

Get all jobs of a type with status.

```typescript
const pending = await queue.getJobs("analytics_flush", "pending");
```

### Subscriptions

#### `subscribe(callback: (event: JobEvent) => void): () => void`

Subscribe to job events (JobCompletedEvent, JobFailedEvent, etc.). Returns unsubscribe function.

```typescript
const unsubscribe = queue.subscribe((event) => {
  if (event.type === "JobCompletedEvent") {
    console.log(`Job ${event.jobId} completed`);
  }
});
```

## Dependencies

### External

- **`@capacitor/preferences`** – Persistent storage on mobile
- **`expo-file-system`** – File system access (mobile)
- **`@react-native-async-storage/async-storage`** – Async storage on React Native

### Internal

- **`lib/storage` (SecureStorage, FastCache)** – Encrypted persistent job storage
- **`lib/network` (NetworkDetection)** – Offline state detection
- **`lib/utils/logger`** – Job execution logging

## Error Handling & Edge Cases

### Handler Crash

If handler crashes, job stays "running". On app restart, stalled jobs are reset to "pending" and retried.

### Network Unavailable

Jobs with `requiresNetwork: true` are deferred when offline. Rescheduled every 5 seconds until network returns.

### Large Payloads

Default limit is 100KB. Payloads exceeding this are rejected. Store only IDs; fetch full data in handler.

### Stale Jobs

Jobs that fail after max retries stay failed. Check `queue.getJobs(type, "failed")` to manually inspect or clean up.

## Performance Notes

- Jobs persist to encrypted storage; lookup is O(n) over pending jobs
- Handlers should complete in <60s (future: timeout support)
- Concurrency limits prevent queue from being overwhelmed; configure per use case
- Idempotency keys enable safe retries without deduplication overhead

## Related Modules

- **`lib/offline/mutation-queue`** – For user-initiated mutations with optimistic updates
- **`lib/offline/sync-manager`** – Manages periodic syncs; uses job queue internally
- **`lib/cache`** – QueryCache for caching query results
- **`lib/network`** – NetworkDetection for offline awareness
- **`lib/storage`** – SecureStorage for encrypted persistence
- **`lib/analytics`** – Can enqueue analytics batching as jobs

## File Breakdown

| File | Purpose |
| --- | --- |
| `queue.ts` (981 lines) | Main BackgroundJobQueue class (enqueue, runNext, handlers, subscriptions) |
| `types/` | TypeScript interfaces (JobRecord, JobHandler, JobEvent, StorageAdapter) |
| `backoff.ts` | Exponential backoff calculation with jitter |
| `adapters/` | Storage adapters (FastCache, SecureStorage, memory) |
| `entitlements-cleanup.ts` | Auto-cleanup job for expired entitlements |
| `entitlements-reminders.ts` | Reminder job for soon-to-expire entitlements |
| `index.ts` | Barrel export of public API |
