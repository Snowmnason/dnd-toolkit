# Background Job Queue - QA Test Guide

Comprehensive testing scenarios for the Background Job Queue, including offline, restart, and deduplication scenarios.

---

## Test Environment Setup

### Prerequisites
- Feature flags enabled: Check `config/appsettings.dev.json`
- Device/Simulator: iOS, Android, or Web (cross-platform)
- Network toggling: Use DevTools (Web) or Airplane Mode (Native)
- Logs enabled: Set `featureFlags.loggerCategories.jobs` to `true`

### Initial State
1. Launch app from fresh install or after running `npm run reset-project`
2. Verify AppKernel logs show: `[BOOTSTRAP] ✓ feature_flags_refresh job handler registered`
3. Verify queue is empty: No pending/failed jobs in logs

---

## Test Suite 1: Basic Enqueue & Execution

### ✅ TC-1.1: Enqueue and Immediate Execution
**Steps:**
1. Open admin console
2. Run:
   ```ts
   const { getJobQueue } = await import("@/lib/jobs");
   const q = getJobQueue();
   const id = await q.enqueue({
     type: "feature_flags_refresh",
     payload: { test: true },
     idempotencyKey: "test-1.1"
   });
   console.log("Enqueued:", id);
   ```
3. Observe logs: Job should appear in logs immediately
4. Call `await q.runNext()`
5. Verify: Logs show job completed, status is "completed"

**Expected Result:** Job completes successfully, handler executes

---

### ✅ TC-1.2: Handler Receives Correct Context
**Steps:**
1. Register custom handler in console:
   ```ts
   const { getJobQueue } = await import("@/lib/jobs");
   const q = getJobQueue();
   q.registerHandler("test_context", async (payload, ctx) => {
     console.log("Context:", { jobId: ctx.jobId, retryCount: ctx.retryCount });
     return { received: true };
   });
   ```
2. Enqueue test job:
   ```ts
   await q.enqueue({
     type: "test_context",
     payload: { data: "test" },
     idempotencyKey: "test-1.2"
   });
   ```
3. Call `await q.runNext()`
4. Check console output for context

**Expected Result:** Handler receives jobId (UUID) and retryCount (0 on first run)

---

## Test Suite 2: Idempotency & Deduplication

### ✅ TC-2.1: Duplicate Enqueue Rejected
**Steps:**
1. Enqueue first job:
   ```ts
   const q = (await import("@/lib/jobs")).getJobQueue();
   const id1 = await q.enqueue({
     type: "feature_flags_refresh",
     payload: {},
     idempotencyKey: "dedup-test"
   });
   ```
2. Enqueue second job with same idempotencyKey:
   ```ts
   const id2 = await q.enqueue({
     type: "feature_flags_refresh",
     payload: {},
     idempotencyKey: "dedup-test"
   });
   ```
3. Compare IDs: `console.log("Same ID?", id1 === id2)`
4. Check queue status: Should show only 1 pending job

**Expected Result:** Both calls return same job ID, no duplicate created

---

### ✅ TC-2.2: Different Idempotency Keys Create Separate Jobs
**Steps:**
1. Enqueue two jobs with different keys:
   ```ts
   const q = (await import("@/lib/jobs")).getJobQueue();
   const id1 = await q.enqueue({
     type: "feature_flags_refresh",
     payload: {},
     idempotencyKey: "unique-key-1"
   });
   const id2 = await q.enqueue({
     type: "feature_flags_refresh",
     payload: {},
     idempotencyKey: "unique-key-2"
   });
   ```
2. Verify: `id1 !== id2`
3. Check queue status: Should show 2 pending jobs

**Expected Result:** Two distinct jobs created with different IDs

---

## Test Suite 3: Offline Job Deferral

### ✅ TC-3.1: Online-Required Job Defers When Offline
**Steps:**
1. Enable Airplane Mode (native) or toggle offline in DevTools (web)
2. Verify: NetworkDetection shows `isOnline: false` in logs
3. Enqueue online-required job:
   ```ts
   const q = (await import("@/lib/jobs")).getJobQueue();
   await q.enqueue({
     type: "feature_flags_refresh",
     payload: {},
     idempotencyKey: "offline-defer-test",
     requiresNetwork: true
   });
   ```
4. Call `await q.runNext()`
5. Check logs: Should show `[jobs] ⏸️ Deferred job...` (not executed)
6. Check status: Job should still be "pending" with updated `runAt` (5s in future)

**Expected Result:** Job not executed, rescheduled for 5 seconds later, no error logged

---

### ✅ TC-3.2: Online-Required Job Executes When Online
**Steps:**
1. Disable Airplane Mode / go online
2. Verify: NetworkDetection shows `isOnline: true`
3. Enqueue job (from TC-3.1 should still be pending):
   ```ts
   const q = (await import("@/lib/jobs")).getJobQueue();
   await q.runNext();
   ```
4. Check logs: Job should execute and complete

**Expected Result:** Job executes successfully when network available

---

### ✅ TC-3.3: Offline-Capable Job Runs Anytime
**Steps:**
1. Enable Airplane Mode
2. Enqueue offline-capable job (no `requiresNetwork`):
   ```ts
   const q = (await import("@/lib/jobs")).getJobQueue();
   await q.enqueue({
     type: "cleanup_cache", // Mock handler that doesn't need network
     payload: {},
     idempotencyKey: "offline-capable-test"
     // No requiresNetwork - defaults to false
   });
   ```
3. Manually register simple handler:
   ```ts
   q.registerHandler("cleanup_cache", async () => {
     return { cleaned: true };
   });
   ```
4. Call `await q.runNext()`
5. Verify: Job runs and completes despite being offline

**Expected Result:** Job executes successfully even without network

---

## Test Suite 4: App Restart Persistence

### ✅ TC-4.1: Pending Jobs Persist Across Restart
**Steps:**
1. Enqueue job with specific payload:
   ```ts
   const q = (await import("@/lib/jobs")).getJobQueue();
   const jobId = await q.enqueue({
     type: "feature_flags_refresh",
     payload: { testMarker: "restart-test-4.1" },
     idempotencyKey: "persist-test-4.1",
     runAt: Date.now() + 100000 // Future timestamp
   });
   console.log("Enqueued:", jobId);
   ```
2. **Force app close** (kill process, don't just background)
3. **Restart app**
4. After app ready, check queue status:
   ```ts
   const { getQueueStatus } = await import("@/lib/jobs");
   console.log(getQueueStatus());
   ```
5. Verify: Job still exists with same ID and payload

**Expected Result:** Job persists with all data intact after restart

---

### ✅ TC-4.2: Retry Count Preserved Across Restart
**Steps:**
1. Create failing handler:
   ```ts
   const q = (await import("@/lib/jobs")).getJobQueue();
   q.registerHandler("always_fail", async () => {
     throw new Error("Intentional test failure");
   });
   ```
2. Enqueue and fail job:
   ```ts
   await q.enqueue({
     type: "always_fail",
     payload: {},
     idempotencyKey: "retry-test",
     maxRetries: 5
   });
   await q.runNext(); // Job fails, retryCount becomes 1
   ```
3. Verify retry count:
   ```ts
   const { getQueueStatus } = await import("@/lib/jobs");
   const status = getQueueStatus();
   // Check job status for retryCount
   ```
4. **Force restart**
5. After restart, check that retryCount is still 1 (not reset to 0)

**Expected Result:** Retry count persists, next attempt will be retry #2

---

### ✅ TC-4.3: Running Job Reset to Pending on Crash
**Steps:**
1. Create long-running handler:
   ```ts
   const q = (await import("@/lib/jobs")).getJobQueue();
   q.registerHandler("long_job", async () => {
     return new Promise(r => setTimeout(r, 1000));
   });
   ```
2. Start job execution:
   ```ts
   await q.enqueue({
     type: "long_job",
     payload: {},
     idempotencyKey: "crash-test"
   });
   q.runNext(); // Don't await - let it run in background
   ```
3. **Immediately force app close** (while job running)
4. **Restart app**
5. Check job status: Should be "pending" (not "running")
6. Call `await q.runNext()` to retry

**Expected Result:** Job changes from "running" → "pending", can be retried

---

## Test Suite 5: Retry & Backoff

### ✅ TC-5.1: Exponential Backoff Timing
**Steps:**
1. Create failing handler:
   ```ts
   const q = (await import("@/lib/jobs")).getJobQueue();
   let attempts = 0;
   q.registerHandler("flaky_job", async () => {
     attempts++;
     if (attempts < 3) throw new Error("Still failing");
     return { recovered: true };
   });
   ```
2. Enqueue job:
   ```ts
   const jobId = await q.enqueue({
     type: "flaky_job",
     payload: { test: "backoff" },
     idempotencyKey: "backoff-test",
     maxRetries: 5
   });
   ```
3. Run and observe timing:
   ```ts
   const times = [];
   times.push(Date.now());
   await q.runNext(); // Attempt 1, fails
   console.log("Retry 1 in:", getJobNextRunTime() - Date.now(), "ms");
   
   // Wait for backoff and run again
   await new Promise(r => setTimeout(r, 1500));
   times.push(Date.now());
   await q.runNext(); // Attempt 2, fails
   console.log("Retry 2 in:", getJobNextRunTime() - Date.now(), "ms");
   
   // Should be ~2x longer than first backoff
   await new Promise(r => setTimeout(r, 2500));
   times.push(Date.now());
   await q.runNext(); // Attempt 3, succeeds
   ```

**Expected Result:** 
- First backoff: ~1 second
- Second backoff: ~2 seconds (±jitter)
- Job succeeds on 3rd attempt

---

## Test Suite 6: Network State Changes

### ✅ TC-6.1: Job Transitions From Deferred to Running
**Steps:**
1. Enable Airplane Mode
2. Enqueue online-required job:
   ```ts
   const q = (await import("@/lib/jobs")).getJobQueue();
   await q.enqueue({
     type: "feature_flags_refresh",
     payload: {},
     idempotencyKey: "network-transition",
     requiresNetwork: true
   });
   await q.runNext(); // Defers
   ```
3. Check status: Job should be "pending" with future runAt
4. **Disable Airplane Mode** (go online)
5. Wait 5 seconds
6. Call `await q.runNext()`
7. Verify: Job now executes and completes

**Expected Result:** Job automatically runs after network becomes available

---

### ✅ TC-6.2: Multiple Deferrals on Repeated Network Flaps
**Steps:**
1. Register monitoring handler:
   ```ts
   const q = (await import("@/lib/jobs")).getJobQueue();
   let deferCount = 0;
   q.registerHandler("flap_job", async () => {
     deferCount++;
     console.log("Execution attempt:", deferCount);
     if (!navigator.onLine) throw new Error("No network");
     return { success: true };
   });
   ```
2. Enqueue job:
   ```ts
   await q.enqueue({
     type: "flap_job",
     payload: {},
     idempotencyKey: "flap-test",
     requiresNetwork: true
   });
   ```
3. Toggle network multiple times:
   ```ts
   // Online → Offline → Online → Offline → Online
   ```
4. Observe: Each offline state should defer, each online attempt should try to run
5. Verify logs show deferred/deferred/executed pattern

**Expected Result:** Job defers each time offline, retries each time online, until success

---

## Test Suite 7: UI Status Tracking

### ✅ TC-7.1: Queue Status Reflects Real-Time Changes
**Steps:**
1. Get initial status:
   ```ts
   const { getQueueStatus } = await import("@/lib/jobs");
   console.log("Initial:", getQueueStatus());
   ```
2. Enqueue 3 jobs:
   ```ts
   const q = (await import("@/lib/jobs")).getJobQueue();
   for (let i = 0; i < 3; i++) {
     await q.enqueue({
       type: "feature_flags_refresh",
       payload: { index: i },
       idempotencyKey: `status-test-${i}`
     });
   }
   ```
3. Check status: `totalPending` should be 3
4. Run one job: `await q.runNext()`
5. Check status: `totalCompleted` should be 1, `totalPending` should be 2

**Expected Result:** Status updates correctly as jobs process

---

## Test Suite 8: App Resume Integration

### ✅ TC-8.1: Feature Flags Refresh Triggered on App Resume
**Steps:**
1. Register monitoring:
   ```ts
   const q = (await import("@/lib/jobs")).getJobQueue();
   q.subscribe("completed", (event) => {
     if (event.type === "feature_flags_refresh") {
       console.log("✓ Feature flags refreshed on resume");
     }
   });
   ```
2. **Background app** (minimize, don't close)
3. **Resume app** (bring to foreground)
4. Observe logs: Should see `feature_flags_refresh` job enqueued and completed within 5 seconds

**Expected Result:** Feature flag job automatically enqueued and runs on app resume

---

## Test Suite 9: Error Scenarios

### ✅ TC-9.1: Handler Not Registered
**Steps:**
1. Enqueue job with unregistered type:
   ```ts
   const q = (await import("@/lib/jobs")).getJobQueue();
   await q.enqueue({
     type: "unknown_handler",
     payload: {},
     idempotencyKey: "error-test-9.1"
   });
   ```
2. Call `await q.runNext()`
3. Check logs: Should log error about missing handler
4. Check status: Job should be marked "failed"

**Expected Result:** Job fails gracefully with clear error message

---

### ✅ TC-9.2: Max Retries Exceeded
**Steps:**
1. Create failing handler:
   ```ts
   const q = (await import("@/lib/jobs")).getJobQueue();
   q.registerHandler("always_fail", async () => {
     throw new Error("Permanent failure");
   });
   ```
2. Enqueue with low max retries:
   ```ts
   await q.enqueue({
     type: "always_fail",
     payload: {},
     idempotencyKey: "max-retry-test",
     maxRetries: 2
   });
   ```
3. Run until failed:
   ```ts
   for (let i = 0; i < 5; i++) {
     await new Promise(r => setTimeout(r, 1500)); // Wait for backoff
     await q.runNext();
   }
   ```
4. Check status: After 2 retries, job should be marked "failed"
5. Check logs: Should show "Max retries exceeded"

**Expected Result:** Job stops retrying after max retries, marked as failed

---

## Checklist

- [ ] All TC-1.x tests pass (basic enqueue/execution)
- [ ] All TC-2.x tests pass (deduplication)
- [ ] All TC-3.x tests pass (offline deferral)
- [ ] All TC-4.x tests pass (persistence)
- [ ] All TC-5.x tests pass (backoff)
- [ ] All TC-6.x tests pass (network transitions)
- [ ] All TC-7.x tests pass (status tracking)
- [ ] All TC-8.x tests pass (app resume)
- [ ] All TC-9.x tests pass (error handling)
- [ ] Tests pass on Web platform
- [ ] Tests pass on iOS simulator
- [ ] Tests pass on Android simulator
- [ ] Logs are clear and helpful
- [ ] No memory leaks detected

---

## Known Limitations & Future Work

- Jobs run sequentially (concurrency limit = 1 by default)
- No UI for viewing/managing failed jobs yet
- No scheduled job UI (runAt UI integration pending)
- Recurring jobs not yet supported

---

## Support

For issues or unclear test steps, check:
- [lib/jobs README](../../../lib/jobs/README.md) – Full API reference
- [USAGE_GUIDE.md](./USAGE_GUIDE.md) – Usage patterns
- Logs with `logger.category("jobs")` – Detailed execution logs
