# Background Job Queue Module

Foundation-level persistent job queue for managing deferred, retryable background work across app restarts, network interruptions, and concurrent execution.

## When to Use This Module

**Use the job queue for:**

- **Scheduled/recurring tasks** – Feature flag refreshes, periodic syncs, analytics batching
- **Retryable operations** – Anything that can fail temporarily and should be reattempted with backoff
- **Offline-tolerant work** – Jobs that survive app crashes and network outages
- **Deduplication** – Prevent duplicate execution of the same logical operation via idempotency keys
- **Observability** – Track job completion, failures, and retry attempts

**Don't use the job queue for:**

- **Blocking synchronous work** – All handlers must be async/Promise-based
- **Long-running operations** – Jobs should complete in <60 seconds (future: worker thread support)
- **High-frequency events** – E.g., every keystroke or scroll; use event listeners instead
- **Real-time operations** – Where sub-second latency is required; use direct API calls
- **User-initiated mutations** – Use `OfflineMutationQueue` instead (optimistic updates, conflict resolution)

## Quick Start

### Initialize the Queue

```typescript
import { getJobQueue } from "@/lib/jobs";

// During app bootstrap (after kernel.phases.appReady)
const queue = getJobQueue();
await queue.initialize();
```

### Register Handlers

Handlers are async functions executed when jobs run. **Handlers must be idempotent** (safe to retry).

```typescript
// Register during app bootstrap
queue.registerHandler("feature_flags_refresh", async (payload, ctx) => {
  console.log(`Refreshing flags (attempt ${ctx.retryCount + 1})`);

  const result = await fetchFeatureFlags(payload.worldId);
  return result; // Cached for later retrieval
});

queue.registerHandler("analytics_flush", async (payload, ctx) => {
  await sendAnalyticsEvents(payload.events);
});
```

### Enqueue a Job

```typescript
// Simple enqueue (runs ASAP)
await queue.enqueue({
  type: "feature_flags_refresh",
  payload: { worldId: "world_123" },
});

// With deduplication (skip if pending)
await queue.enqueue({
  type: "feature_flags_refresh",
  payload: { worldId: "world_123" },
  idempotencyKey: `ff-refresh:world_123`,
});

// Scheduled for future execution
await queue.enqueue({
  type: "analytics_flush",
  payload: { events: [] },
  runAt: Date.now() + 5000, // Run in 5 seconds
});

// With custom retry config
await queue.enqueue({
  type: "analytics_flush",
  payload: { events: [] },
  maxRetries: 3, // Retry up to 3 times (vs default 5)
  baseBackoffMs: 2000, // Start with 2s delay (vs default 1s)
});

// With priority level (default: "normal")
await queue.enqueue({
  type: "feature_flags_refresh",
  payload: { worldId: "world_123" },
  priority: "high", // Runs before "normal" and "low" priority jobs
});

// With automatic cleanup (TTL - time-to-live)
// Job will be automatically deleted 24 hours after completion
await queue.enqueue({
  type: "analytics_flush",
  payload: { events: [] },
  ttlMs: 86400000, // 24 hours in milliseconds
});
```

### Run Jobs

```typescript
// Run available jobs
const processed = await queue.runNext();
console.log(`Processed ${processed} jobs`);

// Check job status
const job = await queue.getStatus(jobId);
console.log(`Job ${jobId}: ${job?.status}`);

// Peek at next job without running
const nextJob = await queue.peek();
if (nextJob) {
  console.log(`Next job: ${nextJob.type} at ${nextJob.runAt}`);
}

// Get all jobs of a type
const pendingAnalytics = await queue.getJobs("analytics_flush", "pending");
```

### Offline-Aware Jobs

Jobs can specify network requirements for intelligent offline handling:

#### Online-Required Jobs (requiresNetwork: true)

```typescript
// Feature flag refresh MUST run online
await queue.enqueue({
  type: "feature_flags_refresh",
  payload: { worldId: "world_123" },
  requiresNetwork: true, // Defer if offline, retry when online
});

// If offline:
// - Job is NOT attempted
// - Rescheduled for 5 seconds later
// - Retried automatically when network returns
```

#### Offline-Capable Jobs (requiresNetwork: false or undefined)

```typescript
// Local cache update works offline
await queue.enqueue({
  type: "save_to_local_cache",
  payload: { key: "user_data", value: { name: "Alice" } },
  requiresNetwork: false, // Default: runs anytime
});

// Works in all network states:
// - Online: runs immediately
// - Offline: runs immediately (no network call)
```

#### Hybrid Jobs (requiresNetwork: "defer")

```typescript
// Profile sync: full sync if online, save locally if offline
await queue.enqueue({
  type: "profile_sync",
  payload: { userId: "user_123" },
  requiresNetwork: "defer", // Try online, defer gracefully if offline
});

// Smart behavior:
// - If online: sync with server
// - If offline: defer (no error), retry when online
// - No failed jobs or error handling needed
```

#### How It Works

When `runNext()` executes:

```
For each job:
  Check requiresNetwork:

  If requiresNetwork === true (online-required):
    If offline → defer 5s (no attempt, no error)
    If online → execute

  If requiresNetwork === "defer" (hybrid):
    If offline → defer 5s (graceful wait)
    If online → execute

  If requiresNetwork === false or undefined (offline-capable):
    Execute (online or offline)
```

**Network-deferred jobs:**

- Stay in `pending` status (don't increment retry counter)
- Rescheduled for 5 seconds later
- Logged as "deferred" (not failed)
- Automatically retry when network returns

### Listen to Events

```typescript
const unsubscribe = queue.subscribe((event) => {
  if ("result" in event) {
    // JobCompletedEvent
    console.log(`Job ${event.jobId} completed:`, event.result);
  } else {
    // JobFailedEvent
    console.log(`Job ${event.jobId} failed: ${event.error}`);
    if (event.retryable) {
      console.log(
        `Will retry at ${new Date(event.nextRetryAt!).toISOString()}`,
      );
    }
  }
});

// Unsubscribe when done
unsubscribe();
```

### React Hook for Queue Access

Use `useJobQueueManager` hook in React components for convenient queue access:

```typescript
import { useJobQueueManager } from "@/hooks";

export function MyComponent() {
  const {
    queue,
    isInitialized,
    enqueue,
    getStatus,
    cancel,
    runNext,
  } = useJobQueueManager();

  if (!isInitialized) {
    return <div>Initializing queue...</div>;
  }

  const handleEnqueue = async () => {
    try {
      const jobId = await enqueue({
        type: "feature_flags_refresh",
        payload: { worldId: "world_123" },
        priority: "high",
      });
      console.log("Enqueued job:", jobId);
    } catch (error) {
      console.error("Failed to enqueue:", error);
    }
  };

  const checkJobStatus = async () => {
    const job = await getStatus("job-id-123");
    console.log("Job status:", job?.status);
  };

  return (
    <div>
      <button onClick={handleEnqueue}>Enqueue Job</button>
      <button onClick={checkJobStatus}>Check Status</button>
    </div>
  );
}
```

**Hook provides:**

- `queue` – The singleton BackgroundJobQueue instance
- `isInitialized` – Whether queue is ready
- `enqueue()` – Enqueue a new job
- `getStatus()` – Get job status by ID
- `cancel()` – Cancel a pending job
- `getJobs()` – Get all jobs of a type
- `getJobCount()` – Count jobs by status
- `clearByType()` – Clear all jobs of a type
- `runNext()` – Manually run next batch

## Architecture & Data Flow

### Job Lifecycle

```
ENQUEUE
  ↓
  ├─ Validate payload size
  ├─ Check idempotency key (skip if duplicate pending)
  ├─ Create JobRecord (id, type, payload, status="pending")
  └─ Persist to storage
    ↓
  RUN_NEXT (triggered by: on-demand, network reconnect, app resume)
    ↓
    ├─ Load pending jobs from storage (sorted by runAt)
    ├─ Respect concurrency limits (global + per-type)
    └─ For each job:
      ├─ Update status → "running"
      ├─ Invoke registered handler
      │   ├─ Success
      │   │   ├─ Store result in job record
      │   │   ├─ Mark status → "completed"
      │   │   ├─ Emit JobCompletedEvent
      │   │   └─ Cache result
      │   │
      │   └─ Failure
      │       ├─ Classify error (retryable vs permanent)
      │       ├─ If retryable & retryCount < maxRetries
      │       │   ├─ Increment retryCount
      │       │   ├─ Calculate exponential backoff
      │       │   ├─ Set status → "pending", runAt → future time
      │       │   ├─ Emit JobFailedEvent (retryable=true, nextRetryAt)
      │       │   └─ Persist to storage
      │       │
      │       └─ If permanent or max retries reached
      │           ├─ Mark status → "failed"
      │           ├─ Store lastError
      │           ├─ Emit JobFailedEvent (retryable=false)
      │           └─ Persist to storage
      ↓
  MONITOR
    ├─ On app restart: Reset stalled jobs (running → pending if older than 10min)
    ├─ On network reconnect: Trigger queue flush (debounced 1s)
    └─ Subscribers notified of completion/failure
```

### Storage

Jobs are persisted to **FastCache** by default (non-sensitive operations). For sensitive operations involving PII or auth tokens, use **SecureStorageAdapter**:

```typescript
// Default: FastCache (non-sensitive)
const queue = getJobQueue();

// For sensitive data: use SecureStorageAdapter
import { SecureStorageAdapter } from "@/lib/jobs";
const queue = new BackgroundJobQueue({
  storageAdapter: new SecureStorageAdapter(),
});

// Or per-job via enqueue option
await queue.enqueue({
  type: "refresh_auth_token",
  payload: { token: "secret..." },
  storageAdapter: new SecureStorageAdapter(), // Override default
});
```

**Storage Adapter Options:**

- **FastCacheAdapter** (default): Non-sensitive background work (feature flags, analytics, cache refresh)
  - Lower latency, suitable for high-frequency jobs
  - Use for: Cache refreshes, telemetry, generic housekeeping
- **SecureStorageAdapter**: Sensitive operations with encryption at rest
  - All data encrypted via AES-CTR on all platforms (web, iOS, Android, desktop)
  - Higher latency due to encryption/decryption overhead
  - Use for: Auth tokens, PII, encryption keys, compliance-sensitive operations

### Concurrency

Control how many jobs run simultaneously:

```typescript
// Global: max 1 job at a time (default)
new BackgroundJobQueue({ concurrency: 1 });

// Global: max 3 jobs at a time
new BackgroundJobQueue({ concurrency: 3 });

// Per-type overrides
new BackgroundJobQueue({
  concurrency: 1, // Global default
  concurrencyPerType: {
    feature_flags_refresh: 1, // Always serial
    analytics_flush: 3, // Up to 3 in parallel
  },
});
```

## API Reference

### BackgroundJobQueue

Core queue class.

#### Methods

**`initialize(): Promise<void>`**

- Initialize queue on app startup
- Loads existing jobs from storage
- Resets stalled jobs (running → pending if >10 minutes old)
- Must be called before enqueueing or running jobs

**`registerHandler(jobType: string, handler: JobHandler): void`**

- Register a handler for a job type
- Called during app bootstrap
- Handlers are async functions: `(payload, context) => Promise<any>`

**`enqueue(options: EnqueueOptions): Promise<string>`**

- Enqueue a new job
- Returns job ID
- Deduplicates by idempotency key if provided
- Throws if payload exceeds size limit (default: 100KB)

```typescript
interface EnqueueOptions {
  type: string;
  payload: Record<string, any>;
  idempotencyKey?: string;
  runAt?: number;
  maxRetries?: number;
  baseBackoffMs?: number;
  recurrencePattern?: string; // Future
}
```

**`runNext(): Promise<number>`**

- Process available pending jobs
- Respects batch size and concurrency limits
- Returns count of jobs processed
- Call regularly or trigger on network reconnect / app resume

**`getStatus(jobId: string): Promise<JobRecord | null>`**

- Get full job record by ID
- Returns null if not found

**`peek(): Promise<JobRecord | null>`**

- Preview next ready job without executing
- Useful for debugging or pre-loading data

**`getJobs(type?: string, status?: JobStatus): Promise<JobRecord[]>`**

- Query jobs by type and/or status
- Both filters optional

**`getPendingCount(): Promise<number>`**

- Count jobs in pending status

**`cancel(jobId: string): Promise<boolean>`**

- Cancel a job (only if pending)
- Returns true if cancelled, false if not found or not cancelable

**`clearByType(type: string): Promise<number>`**

- Delete all jobs of a type
- Returns count deleted

**`subscribe(subscriber: JobEventSubscriber): () => void`**

- Listen to job completion/failure events
- Returns unsubscribe function

#### Configuration

```typescript
interface JobQueueConfig {
  maxRetries?: number; // Default: 5
  baseBackoffMs?: number; // Default: 1000ms
  batchSize?: number; // Default: 3 jobs per runNext()
  storageAdapter?: StorageAdapter; // Default: FastCacheAdapter
  concurrency?: number; // Default: 1 (global max concurrent)
  concurrencyPerType?: Record<string, number>; // Per-type overrides
  maxPayloadBytes?: number; // Default: 100KB
  stalledThresholdMs?: number; // Default: 10 minutes
  overflowPolicy?: "dropOldestFailed" | "rejectNew"; // Storage overflow
  reconnectDebounceMs?: number; // Default: 1000ms
}
```

### Backoff Utilities

```typescript
import {
  calculateBackoffDelay,
  calculateNextRetryTime,
  isRetryable,
  formatDelay,
} from "@/lib/jobs";

// Calculate retry delay with exponential backoff + jitter
const delay = calculateBackoffDelay(retryCount, baseDelayMs);
// Result: 1s, 2s, 4s, 8s, 16s, capped at 32s

// Calculate next retry timestamp
const nextRetry = calculateNextRetryTime(retryCount, baseDelayMs);
// Returns: now + backoff delay

// Check if error should be retried
const shouldRetry = isRetryable(error);
// Retries: 5xx, 429, network errors
// Skips: 4xx, 401, 403

// Format delay for logging
const formatted = formatDelay(1500); // "1.5s"
```

### Events

**JobCompletedEvent**

```typescript
{
  jobId: string;
  type: string;
  result: any; // Handler return value
  durationMs: number;
}
```

**JobFailedEvent**

```typescript
{
  jobId: string;
  type: string;
  error: string; // Error message
  retryCount: number;
  retryable: boolean; // Will be retried?
  nextRetryAt?: number; // When if retryable
}
```

## Retry & Backoff Strategy

- **Exponential backoff**: `delay = base * (2 ^ retryCount)` capped at 32 seconds
- **Jitter**: ±20% random variance to prevent thundering herd
- **Max retries**: 5 by default (configurable per job)
- **Retriable errors**: 5xx, 429 rate limit, network errors
- **Permanent errors**: 4xx (except 429), 401, 403

## Error Handling

Handlers should throw errors or return values that the queue can classify:

```typescript
// Throw an Error (simple case)
queue.registerHandler("my_job", async (payload, ctx) => {
  try {
    await riskyOperation();
  } catch (error) {
    throw error; // Queue will classify by status code/message
  }
});

// Return error object (fine-grained control)
queue.registerHandler("my_job", async (payload, ctx) => {
  try {
    await riskyOperation();
  } catch (error) {
    if (error.code === 409) {
      // Conflict: permanent error, don't retry
      throw error;
    }
    // Network/5xx: retryable, will backoff automatically
    throw error;
  }
});
```

## Integration with App Kernel

The job queue is automatically initialized during app bootstrap in the **NETWORK phase** of AppKernel. No additional setup required—just register handlers and enqueue jobs.

### Handler Registration

Register handlers during app bootstrap (before or after app ready):

```typescript
import { getJobQueue } from "@/lib/jobs";

async function setupJobHandlers() {
  const queue = getJobQueue();

  queue.registerHandler("feature_flags_refresh", async (payload, ctx) => {
    const { worldId } = payload as { worldId: string };
    const flags = await fetchFeatureFlags(worldId);
    return { success: true, count: flags.length };
  });

  queue.registerHandler("profile_sync", async (payload, ctx) => {
    const { userId } = payload as { userId: string };
    await syncProfile(userId);
    return { success: true };
  });
}

// Call during app bootstrap
setupJobHandlers();
```

### Automatic Integration Features

Once initialized by AppKernel, the queue automatically:

1. **Network Reconnection** – Detects offline→online transitions and flushes pending jobs
2. **Stalled Job Recovery** – Resets jobs stuck in "running" state for >10 minutes
3. **Analytics** – Tracks job completion/failure for debugging

**Note:** Periodic background polling is not built-in; jobs are processed on-demand via `runNext()`, network reconnection, or manual triggers. For automatic periodic processing, call `runNext()` from your app's interval handler or use `AppKernel` to schedule it.

### Manual Queue Flush (if needed)

```typescript
// For testing or external triggers
const processed = await queue.runNext();
console.log(`Processed ${processed} jobs`);
```

### UI Status Display

Get current queue status for display in UI by querying jobs directly:

```typescript
const queue = getJobQueue();

// Get all jobs with type filtering
const allJobs = await queue.getJobs();
const pendingJobs = await queue.getJobs(undefined, "pending");
const failedJobs = await queue.getJobs(undefined, "failed");

// Display in UI
allJobs.forEach((job, index) => {
  console.log(`${job.type} (${index + 1} of ${allJobs.length}): ${job.status}`);
  console.log(`  Payload: ${JSON.stringify(job.payload).length} bytes`);
  console.log(`  Retries: ${job.retryCount}/${job.maxRetries}`);
});

// Filter to show only pending/running
const active = allJobs.filter(
  (j) => j.status === "pending" || j.status === "running",
);
console.log(`${active.length} jobs in progress`);
```

Each job in the result is a `JobRecord` with:

- `type` – Job type (e.g., "upload_document", "create_world")
- `status` – Current status ("pending", "running", "completed", "failed")
- `payloadSizeBytes` (calculated) – Approximate job payload size
- `retryCount` / `maxRetries` – Retry information
- `runAt` – When job should run
- `createdAt` – When job was created

### Bootstrap Integration

The job queue is integrated into the app kernel and initialized automatically:

```typescript
// In app root component (e.g., app/_layout.tsx) - no additional setup needed
import { useAppKernel } from "@/lib/kernel/use-app-kernel";

export default function RootLayout() {
  const kernel = useAppKernel();

  if (!kernel.phases.appReady) {
    return <SplashScreen />;
  }

  // Queue is already initialized and listening to network changes
  // Just register handlers and enqueue jobs

  return (
    <Stack screenOptions={{ contentStyle: { backgroundColor: "$background" } }}>
      {/* Your screens */}
    </Stack>
  );
}
```

The queue automatically:

- **Network detection** – Listens to `NetworkDetection` and flushes pending jobs on reconnect (debounced 1s)
- **Stalled job recovery** – Resets jobs running >10 minutes on app start
- **Analytics integration** – Tracks job completion/failure events via subscribers

## Performance Notes

- **Enqueue**: <2ms overhead (validation, storage write)
- **Batch run (3 jobs)**: <50ms overhead (excluding handler execution)
- **Storage**: FastCache uses in-memory + localStorage; check quota before large batches
- **Stalled job detection**: ~10-50ms per 100 jobs on startup
- **Backoff calculation**: <1ms per job

## Testing

See `__tests__/lib/jobs/queue.test.ts` for comprehensive unit tests covering:

- Job enqueueing and deduplication
- Handler registration and execution
- Retry logic with exponential backoff
- Job status tracking
- Storage persistence and crash recovery
- Concurrency limits (global + per-type)
- Event subscriptions

Run tests:

```bash
npm run test -- __tests__/lib/jobs/queue.test.ts
```

## Related Modules

- **OfflineMutationQueue** (`lib/offline/mutation-queue.ts`) – For user-driven mutations with optimistic updates
- **OnlineSyncManager** (`lib/offline/sync-manager.ts`) – Manages periodic syncs and feature flag refreshes
- **QueryCache** (`lib/cache/query-cache.ts`) – Caching and invalidation patterns
- **NetworkDetection** (`lib/network/network-detection.ts`) – Cross-platform network status
- **SecureStorage** (`lib/storage/SecureStorage.ts`) – Encrypted persistent storage
- **FastCache** (`lib/storage/FastCache.ts`) – In-memory ephemeral caching

## Migration & Versioning

When job record schemas change, update `lib/storage/cache-versioning.ts`:

1. Increment `CURRENT_CACHE_VERSION`
2. Add migration function transforming old schema to new
3. Test migration in unit tests
4. Document breaking changes in `CACHE_VERSIONING.md`

Example:

```typescript
// cache-versioning.ts
const CURRENT_CACHE_VERSION = 3; // Increment from 2

function migrateJobRecordsV2_to_V3(jobs: any[]): any[] {
  return jobs.map((job) => ({
    ...job,
    recurrencePattern: job.recurrence || undefined, // Rename field
  }));
}
```

## FAQ

**Q: Can I have jobs run in parallel?**
A: Yes, set `concurrency > 1` or use `concurrencyPerType` for fine-grained control.

**Q: What happens if a handler crashes?**
A: The job stays in "running" state. On app restart, it's reset to "pending" (stalled recovery).

**Q: Can jobs be cancelled after starting?**
A: No, only pending jobs can be cancelled. Started jobs must complete or timeout (future feature).

**Q: How do I debug a failing job?**
A: Check `job.lastError`, subscribe to `JobFailedEvent`, and enable `logger.category("jobs")`.

**Q: Can I store large payloads?**
A: Default limit is 100KB. Payloads exceeding this are rejected. Store only IDs and use payload to fetch details.

**Q: How do I know if a job completed successfully?**
A: Subscribe to `JobCompletedEvent` or query `queue.getStatus(jobId).status === "completed"`.

## Limitations & Future Work

### Current Limitations

- **No distributed queues** – Single-device only (intended for local scheduling)
- **No job cancellation once started** – Can only cancel pending jobs
- **No job timeouts** – Long-running handlers can block queue (future: add timeout + cancellation)
- **No Worker threads** – Long jobs (>60s) not suitable; future: offload to workers
- **No recurring jobs** – `recurrencePattern` field accepted but not used (future: add cron-like scheduling)

### Planned Enhancements

- **Periodic polling** – Built-in timer-based background processing (alternative to manual triggers)
- **Job timeouts** – Automatic timeout + handler cancellation via AbortSignal
- **Recurring jobs** – Support `recurrencePattern` for cron-like scheduling
