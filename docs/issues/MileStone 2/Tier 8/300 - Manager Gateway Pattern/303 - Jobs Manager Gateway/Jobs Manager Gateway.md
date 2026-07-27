# Jobs Manager Gateway: Consolidate Background Queue & Add Generic Capabilities

**Status:** Proposed  
**Track:** `jobs`, `architecture`, `managers`, `async-foundation`  
**Parent Issue:** [Manager Gateway Pattern](./Manager%20Gateway%20Pattern.md) — Phase 4: Standardize JobsManager alongside other managers  
**Related Siblings:** [Analytics Manager Gateway](./Analytics%20Manager%20Gateway.md), [Error Manager Consolidation](./Error%20Manager%20Consolidation.md) (Phase 2/3 siblings)  
**Impact:** HIGH — Consolidates bespoke offline queues into single job system; adds missing capabilities; establishes foundation for generic fire-and-forget work across app  
**Estimate:** 2–3 weeks (phased)

---

## Problem

Jobs system is partially implemented and missing critical features:

**Current gaps:**
- Breadcrumb-queue and analytics-buffer use bespoke offline persistence instead of job queue (duplication)
- Job queue lacks **batching** — each job=1 request (expensive for analytics, breadcrumbs, sync)
- Job queue lacks **TTL deduplication** — can't skip re-sending items sent within 24h window
- Job queue lacks **per-type rate-limit backoff** — can't pause a job type when provider rate-limits
- Exporter-registry has in-memory dispatch queue without persistence (events lost on crash)
- No generic one-off task API — modules with fire-and-forget work can't use jobs without custom handler setup
- Jobs is seen as "sync + analytics only" instead of foundational async infrastructure

**Result:** Inconsistent offline handling; duplicate retry/dedup logic; missed opportunity to unify fire-and-forget pattern across app.

---

## Solution

**Manager Gateway approach for Jobs:**
- `JobsManager` (lib/jobs) — Single orchestration entry point ✅ (already correct)
- `jobService` (middleware) — Preconditions & normalization ✅ (already correct)
- `BackgroundJobQueue` (system) — Portable infrastructure ✅ (needs feature additions)

**Add to Job Queue:**
1. **Batching** — Group N jobs into single handler invocation/HTTP request
2. **TTL deduplication** — Track "successfully sent" in window; skip retrying duplicates
3. **Per-type rate-limit backoff** — Pause whole job type on `retryAfterMs` response
4. **Generic task handler** — Simple `enqueue({ type: 'generic_task', handler: fn })` API
5. **Job callbacks** — Allow jobs to schedule follow-on tasks or side effects on completion

**Migrate to Jobs:**
- `breadcrumb-queue.ts` → Use job queue with batching + dedup
- `exporter-registry.ts` → Dispatch queue → Job queue with persistence
- `analytics-buffer.ts` → Already migrated (#301); retire

---

## Codebase Status

### Already Correct ✅
- **JobsManager** — Single entry point; follows manager gateway pattern
- **jobService** — Middleware preconditions; network checks
- **analytics_send_event job** — Works, but no batching
- **Sync orchestrator** — Coordinates auth/manual sync correctly

### Needs Enhancement ⚠️
- **BackgroundJobQueue** — Missing: batching, dedup, rate-limit backoff, generic tasks
- **breadcrumb-queue.ts** — Bespoke implementation (should migrate to jobs)
- **exporter-registry.ts** — In-memory queue (should use job queue)
- **Job handlers** — All registered in bootstrap phase; no runtime flexibility

### System Violations 🔴
- `breadcrumb-queue.ts` duplicates retry/backoff logic
- `exporter-registry.ts` bypasses storage; events lost on crash
- No cross-module fire-and-forget pattern; modules roll their own offline handling

---

## Architecture Model

```
Presentation/Hooks
    ↓
JobsManager (lib/jobs)
    ├─ enqueue(type, payload)
    ├─ enqueue({ type: 'generic_task', handler: fn }) — NEW: Generic tasks
    ├─ subscribe(callback) — NEW: Job completion/failure callbacks
    └─ performSync(...) — Existing: Orchestrate sync operations
    ↓
jobService (middleware)
    ├─ Network preconditions
    ├─ Storage routing
    └─ Normalization
    ↓
BackgroundJobQueue (system)
    ├─ Handler registry (includes dynamic handlers)
    ├─ Job persistence (storage adapter)
    ├─ Batching orchestration — NEW
    ├─ Deduplication logic — NEW
    ├─ Rate-limit backoff — NEW
    ├─ Concurrency control
    └─ Retry scheduling with exponential backoff
```

**Key principle:** All async, retryable, offline-tolerant work flows through jobs. No parallel offline-queue implementations.

---

## Implementation Phases

### Phase 1: JobsManager Audit & Coordination

**Goal:** Verify JobsManager follows all manager patterns; add missing coordination logic.

**Scope:**
- Audit: JobsManager has all needed methods (enqueue, getJob, subscribe, cancel, performSync)
- Coordination: Verify sync orchestration doesn't bypass managers or create lib-to-lib coupling
- Documentation: Update managers/jobs/README.md with clear entry point description
- No new features in Phase 1; just audit and document

**Acceptance:**
- [ ] JobsManager documented as single entry point
- [ ] All internal calls go through manager (no direct queue access outside middleware)
- [ ] Sync orchestration reviewed for coupling
- [ ] Job types clearly registered with handlers at bootstrap

**Related:** [Job Handler Registry & Bootstrap](./Job%20Handler%20Registry%20Bootstrap.md) (child issue, optional cleanup)

---

### Phase 2: Add Batching to Job Queue

**Goal:** Allow multiple queued jobs to run as single handler invocation; reduces requests.

**Problem it solves:**
- Today: 100 analytics events = 100 separate job invocations = 100 HTTP requests (or 100 retry loops)
- Goal: 100 events = 1 batched job invocation = 1 HTTP request

**Scope:**

#### 1. Job Config: Add `batchSize` and `batchWindowMs`

```typescript
interface JobEnqueueOptions {
  // ... existing fields
  batchSize?: number;        // NEW: max items per batch (default 1, no batching)
  batchWindowMs?: number;    // NEW: wait up to N ms to collect batch (default 0, fire ASAP)
}

interface JobType {
  // Handler definition during registration
  batchSize?: number;        // e.g., 10 for analytics
  batchWindowMs?: number;    // e.g., 1000 ms for analytics
  isBatchHandler?: boolean;  // Handler accepts array payload instead of single item
}
```

#### 2. Batch Collector in BackgroundJobQueue

```typescript
// Collect pending jobs of same type into batches
private batchCollector = new Map<string, BatchedJob[]>();

// When runNext() encounters a batchable job:
// 1. Collect up to batchSize matching jobs
// 2. Wait up to batchWindowMs for more to arrive
// 3. Pass array to handler as single invocation
// 4. Mark all jobs in batch as completed/failed together
```

#### 3. Update Job Executor

Handler can now receive:
- Single item (today): `handler(payload, ctx)`
- Batch: `handler([item1, item2, item3], ctx)` if `isBatchHandler: true`

#### 4. Update Analytics Job

```typescript
// lib/jobs/core/analytics-send-event-job.ts
export function registerAnalyticsSendEventJob(queue: BackgroundJobQueue): void {
  queue.registerHandler('analytics_send_event', 
    async (payloads: AnalyticsEventPayload[]) => {
      // Handle both single item and batch
      const items = Array.isArray(payloads) ? payloads : [payloads];
      await sendAnalyticsEventBatch(items);
      return { sentAt: Date.now(), count: items.length };
    },
    {
      batchSize: 50,           // Batch up to 50 events
      batchWindowMs: 2000,     // Wait up to 2s for more
      isBatchHandler: true,
    }
  );
}
```

**Acceptance:**
- [ ] `batchSize` and `batchWindowMs` configurable per job type
- [ ] Batch collector accumulates jobs correctly
- [ ] analytics_send_event batches up to 50 events
- [ ] Tests: Single event still works; batch of 10 works; timeout works
- [ ] ESLint clean; job queue tests pass

---

### Phase 3: Add TTL Deduplication to Job Queue

**Goal:** Skip re-sending items already sent within time window (prevents duplicate charges, quota waste).

**Problem it solves:**
- Breadcrumb: Same error breadcrumb sent 10 times in retry loop → wastes provider quota
- Analytics: Same event retried 5 times → charged 5× for one action
- Goal: "If we sent this within 24h, skip it"

**Scope:**

#### 1. Dedup Store

```typescript
interface DedupEntry {
  fingerprint: string;           // Hash of (type + payload)
  lastSuccessSentAt: number;     // ms since epoch
  expiresAt: number;             // When entry expires (lastSuccessSentAt + ttl)
}

// Stored alongside job queue in storage
// Periodically cleaned up (old entries discarded)
```

#### 2. Add to Job Types Registry

```typescript
interface JobType {
  // ... existing fields
  dedup?: {
    ttlMs: number;               // e.g., 24 * 60 * 60 * 1000 for 24h
    fingerprintFields: string[]; // Which payload fields to hash for dedup
  };
}
```

#### 3. Fingerprint Generator

```typescript
function generateFingerprint(jobType: string, payload: any, fields: string[]): string {
  const relevant = fields.reduce((acc, f) => ({
    ...acc,
    [f]: payload[f],
  }), {});
  return sha256(JSON.stringify([jobType, relevant]));
}
```

#### 4. Dedup Check Before Handler Execution

```typescript
// In job-executor.ts, before calling handler:
if (job.type.dedup) {
  const fp = generateFingerprint(job.type.id, job.payload, job.type.dedup.fingerprintFields);
  const entry = await dedupStore.get(fp);
  
  if (entry && entry.expiresAt > Date.now()) {
    // Already sent recently; mark job as completed and skip handler
    await markJobCompleted(job, { dedupped: true, lastSentAt: entry.lastSuccessSentAt });
    return;
  }
}
```

#### 5. Record Success in Dedup Store

```typescript
// After handler succeeds:
if (job.type.dedup) {
  const fp = generateFingerprint(...);
  await dedupStore.set(fp, {
    lastSuccessSentAt: Date.now(),
    expiresAt: Date.now() + job.type.dedup.ttlMs,
  });
}
```

#### 6. Configure Job Types

```typescript
// Breadcrumb events
registerHandler('send_breadcrumbs', handler, {
  batchSize: 10,
  dedup: {
    ttlMs: 24 * 60 * 60 * 1000,  // 24h
    fingerprintFields: ['level', 'message', 'category'], // Dedup on content
  },
});

// Analytics events
registerHandler('analytics_send_event', handler, {
  batchSize: 50,
  dedup: {
    ttlMs: 24 * 60 * 60 * 1000,  // 24h
    fingerprintFields: ['event', 'worldId'],  // Dedup on event type + context
  },
});
```

**Acceptance:**
- [ ] Dedup store persisted alongside job queue
- [ ] Dedup check prevents duplicate handler invocations
- [ ] Fingerprints match expected values (unit tests)
- [ ] TTL cleanup removes expired entries
- [ ] Jobs marked as dedupped track stats (not counted as retry failures)
- [ ] ESLint clean; tests pass

---

### Phase 4: Add Per-Type Rate-Limit Backoff

**Goal:** When provider rate-limits a job type, pause ALL jobs of that type for N ms.

**Problem it solves:**
- Today: Provider returns 429 + `retryAfterMs: 60000`; only that job backs off individually
- Goal: All jobs of type wait 60s before any retry attempt

**Scope:**

#### 1. Rate-Limit State per Job Type

```typescript
private rateLimitState = new Map<string, {
  blockedUntil: number;   // ms since epoch
  retryAfterMs: number;   // How long provider said to wait
}>();
```

#### 2. Check Before Running Job

```typescript
// In runNext(), before executing job:
if (rateLimitState.has(job.type)) {
  const state = rateLimitState.get(job.type)!;
  if (state.blockedUntil > Date.now()) {
    // Still blocked; defer job
    await deferJob(job, state.blockedUntil - Date.now());
    return 0; // No jobs run this tick
  }
}
```

#### 3. Detect Rate Limit in Handler Error

```typescript
// After handler fails:
if (error.statusCode === 429) {
  const retryAfterMs = parseRetryAfter(error.headers['retry-after']);
  
  // Block entire job type
  rateLimitState.set(job.type, {
    blockedUntil: Date.now() + retryAfterMs,
    retryAfterMs,
  });
  
  logger.warn(`Job type "${job.type}" rate-limited until ${new Date(Date.now() + retryAfterMs)}`);
  
  // Re-throw so backoff scheduler picks it up
  throw error;
}
```

#### 4. Clear Rate-Limit State on Success

```typescript
// After handler succeeds:
rateLimitState.delete(job.type);
```

**Acceptance:**
- [ ] Rate-limit state tracked per job type
- [ ] All jobs of type defer when rate-limited
- [ ] `retryAfterMs` parsed from error response
- [ ] Rate-limit state clears on success
- [ ] Tests: Single rate-limit blocks type; multiple jobs wait together
- [ ] ESLint clean; tests pass

---

### Phase 5: Add Generic One-Off Task API

**Goal:** Allow modules to enqueue simple async work without registering a handler.

**Problem it solves:**
- Today: To enqueue fire-and-forget work, need to register handler at bootstrap
- Goal: `JobsManager.enqueueTask(async () => { ... })` — run later, offline-safe

**Scope:**

#### 1. Generic Task Type

```typescript
interface GenericTaskPayload {
  handlerCode: string;     // Serialized function code (or just: function blob)
  context?: Record<string, any>;  // Variables to pass to handler
}

// OR (simpler for most cases):
interface GenericTaskPayload {
  fn: () => Promise<void>;  // Direct function reference
  context?: Record<string, any>;
}
```

#### 2. Register Generic Task Handler

```typescript
// In job setup:
queue.registerHandler('generic_task', async (payload: GenericTaskPayload) => {
  const { fn, context } = payload;
  // Reconstruct or call function with context
  await fn.call(context);
  return { completedAt: Date.now() };
});
```

#### 3. Add Convenience Method to JobsManager

```typescript
export const JobsManager = {
  // ... existing methods

  async enqueueTask(
    fn: () => Promise<void>,
    options?: Partial<EnqueueOptions>
  ): Promise<string> {
    return this.enqueue({
      type: 'generic_task',
      payload: { fn },
      requiresNetwork: options?.requiresNetwork ?? false,
      priority: options?.priority ?? 'normal',
      ...options,
    });
  },
};
```

#### 4. Usage Examples

```typescript
// In any module:
import { JobsManager } from '@/lib/jobs';

// Simple fire-and-forget:
await JobsManager.enqueueTask(async () => {
  await expensiveOperation();
  console.log('Done!');
});

// With context:
await JobsManager.enqueueTask(
  async function() {
    await this.api.syncData();
  },
  { requiresNetwork: true, priority: 'high' }
);

// Replace hand-rolled offline queues:
// Before: Manual retry loop + storage
// After: JobsManager.enqueueTask(...)
```

**Acceptance:**
- [ ] `JobsManager.enqueueTask(fn)` API works
- [ ] Tasks enqueue as `generic_task` job type
- [ ] Tasks persist and retry on failure
- [ ] Tasks don't require handler registration
- [ ] Tests: Task runs, succeeds, fails, retries
- [ ] Documented in hooks/useEnqueueTask hook

---

### Phase 6: Job Callbacks (Optional Enhancement)

**Goal:** Allow jobs to schedule follow-on tasks or side effects on completion.

**Examples:**
- After sync completes → send notification
- After analytics batch sent → clear local queue
- After error breadcrumbs flushed → mark resolved in UI

**Scope:**

```typescript
interface JobCallbackConfig {
  onSuccess?: (result: any) => Promise<void>;
  onFailure?: (error: any) => Promise<void>;
  onRetry?: (retryCount: number) => Promise<void>;
}

// Register callback during enqueue:
await JobsManager.enqueue({
  type: 'analytics_send_event',
  payload: { events: [...] },
  onSuccess: async (result) => {
    console.log(`Sent ${result.count} events`);
  },
  onFailure: async (error) => {
    logger.error(`Failed to send events: ${error}`);
  },
});
```

**Implementation:** Store callbacks in job metadata; execute after handler completes.

**Acceptance:**
- [ ] Callbacks attached to job at enqueue
- [ ] onSuccess called after handler succeeds
- [ ] onFailure called if handler fails (not on dedup)
- [ ] onRetry called when retry scheduled
- [ ] Tests: All callback types fire correctly

---

## Migration Plan (Phase 3, separate issue)

Once job queue has batching + dedup + rate-limit backoff:

1. **Migrate breadcrumb-queue** → Register as `send_breadcrumbs` job with batch/dedup config
2. **Migrate exporter-registry** → Dynamic dispatch → Job queue with persistence
3. **Retire bespoke implementations** → Delete breadcrumb-queue.ts, analytics-buffer.ts variants

**Related:** [Breadcrumb & Exporter Migration to Jobs](./Breadcrumb%20Exporter%20Migration.md) (child issue)

---

## Acceptance Criteria

### Phase 1: Manager Audit
- [ ] JobsManager documented as single entry point for all job operations
- [ ] All call sites use JobsManager (no direct queue access)
- [ ] Sync orchestration reviewed for lib-to-lib coupling
- [ ] Job handler registration centralized at bootstrap

### Phase 2: Batching
- [ ] Batch collector accumulates jobs by type
- [ ] `batchSize` and `batchWindowMs` configurable per type
- [ ] Batch handlers receive array payloads
- [ ] analytics_send_event batches up to 50 events per request
- [ ] Tests: Single, batch, timeout scenarios all work
- [ ] Performance: 100 events = 2–4 HTTP requests (vs. 100 today)

### Phase 3: Deduplication
- [ ] Dedup store persists and expires entries
- [ ] Fingerprints match payload content (not payload size)
- [ ] Dedupped jobs marked as completed (not retried)
- [ ] 24h TTL prevents duplicate charges
- [ ] Tests: Dedup fires for matching content; expires after TTL

### Phase 4: Rate-Limit Backoff
- [ ] Rate-limit state blocks entire job type
- [ ] All jobs of type defer during block window
- [ ] `retryAfterMs` parsed correctly
- [ ] State clears on success
- [ ] Tests: Single rate-limit blocks type; multiple jobs wait

### Phase 5: Generic Tasks
- [ ] `JobsManager.enqueueTask(fn)` works
- [ ] Tasks enqueue as `generic_task` jobs
- [ ] Tasks persist, retry, and complete
- [ ] No handler registration needed
- [ ] Tests: Task runs, fails, retries

### Phase 6: Callbacks (Optional)
- [ ] Callbacks fire on success/failure/retry
- [ ] Multiple callbacks per job supported
- [ ] Callbacks don't block main job handler

### Overall
- [ ] Job queue feature-complete for analytics, breadcrumbs, generic tasks
- [ ] All job types batched where sensible (analytics, breadcrumbs, sync)
- [ ] Dedup prevents duplicate events
- [ ] Rate-limit backoff reduces provider errors
- [ ] One-off tasks reduce duplicate offline handling across modules
- [ ] ESLint clean; all tests pass

---

## Benefits

- **Unified offline handling** — All retryable work (analytics, breadcrumbs, tasks) uses same queue
- **Better performance** — Batching reduces requests by 90% for high-volume events
- **Privacy-friendly** — Dedup prevents over-sending; reduces provider quota waste
- **Resilient** — Rate-limit backoff prevents cascade failures
- **Flexible** — Generic tasks enable fire-and-forget across modules
- **Maintainable** — One retry/dedup/backoff implementation instead of three
- **Foundation for future** — Ready for background work during low-CPU windows, job priorities, etc.

---

## Related Architecture Docs

- [Manager Gateway Pattern](./Manager%20Gateway%20Pattern.md) — Parent strategic issue
- [copilot-instructions.md](../../copilot-instructions.md) — Dependency boundaries
- [lib/jobs/README.md](../../lib/jobs/README.md) — Job queue API reference
- [system/Jobs/README.md](../../system/Jobs/README.md) — System layer documentation

---

## Notes

- **Not in scope:** Job scheduling language, cron syntax, or complex retry policies beyond exponential backoff
- **Future enhancement:** Run jobs during low-CPU windows (progressive web app optimization)
- **Future enhancement:** Job priorities (high/normal/low) already in system; just need UI to expose
- **Modules to refactor later:** Once generic tasks work, modules with fire-and-forget patterns (image sync, offline mutations, cache cleanup) can migrate to JobsManager
