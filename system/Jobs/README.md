# System Jobs Module

Low-level background job execution system providing persistent job storage, scheduling, and execution. Handles job persistence across app restarts, concurrent execution control, and job lifecycle management. Pure execution layer with no business logic.

## When to Use This Module

**Use this module for:**

- Executing background jobs with persistence
- Scheduling jobs with delays or cron-like patterns
- Managing job concurrency and execution limits
- Storing job state across app restarts
- Building job pipelines with dependencies

**Don't use this module for:**

- Business logic job handlers (belongs in lib/jobs)
- Job scheduling policies (belongs in lib/jobs)
- User-facing job status (belongs in hooks)
- Job queuing from UI (belongs in lib/offline)

## Architecture & Data Flow

```
Job Enqueue → Storage Adapter → Job Scheduler
                                      ↓
Job Executor → Handler Registry → Job Handler
                                      ↓
Success/Failure → Storage Update → Event Emission
```

**Key Components:**

- **BackgroundJobQueue**: Main job queue with persistence
- **JobScheduler**: Handles job timing and scheduling
- **JobExecutor**: Executes jobs with concurrency control
- **HandlerRegistry**: Registers and looks up job handlers
- **StorageAdapterRouter**: Routes to appropriate storage backend

## API Reference

### Job Queue

#### `BackgroundJobQueue.enqueue(job: JobRecord): Promise<string>`

Enqueue a job for execution.

```typescript
import { BackgroundJobQueue } from '@/system/Jobs';

const queue = new BackgroundJobQueue();
const jobId = await queue.enqueue({
  id: 'job-123',
  type: 'analytics_flush',
  payload: { events: [] },
  runAt: Date.now() + 5000, // Run in 5 seconds
  maxRetries: 3
});
```

### Job Scheduler

#### `JobScheduler.schedule(job: JobRecord): Promise<void>`

Schedule a job for future execution.

```typescript
const scheduler = new JobScheduler();
await scheduler.schedule({
  type: 'daily_cleanup',
  payload: {},
  cron: '0 2 * * *' // Daily at 2 AM
});
```

### Handler Registry

#### `HandlerRegistry.register(type: string, handler: JobHandler): void`

Register a job handler function.

```typescript
HandlerRegistry.register('analytics_flush', async (payload) => {
  await flushAnalytics(payload.events);
});
```

### Storage Adapters

#### `StorageAdapterRouter.getAdapter(jobType: string): StorageAdapter`

Get appropriate storage adapter for job type.

```typescript
const adapter = StorageAdapterRouter.getAdapter('analytics_flush');
await adapter.store(job);
```

## Dependencies

### External

- **None** – Pure execution layer

### Internal

- **`system/Storage`** – Job persistence
- **`lib/utils/logger`** – Job execution logging

## Error Handling & Edge Cases

### Job Handler Crashes

Jobs marked failed; retry logic applies.

### Storage Unavailable

Jobs held in memory until storage available.

### Concurrent Execution

Concurrency limits prevent resource exhaustion.

### Handler Not Found

Jobs fail with descriptive error.

## Performance Notes

- **Persistence**: Jobs survive app restarts
- **Concurrency**: Configurable execution limits
- **Scheduling**: Efficient timer management
- **Storage**: Backend-specific optimization

## Related Modules

- **`lib/jobs`** – Business logic job management
- **`system/Storage`** – Job data persistence
- **`hooks/jobs`** – UI integration for job status

## File Breakdown

| File | Purpose |
| --- | --- |
| `background-job-queue.ts` | Main job queue implementation |
| `job-scheduler.ts` | Job timing and scheduling logic |
| `job-executor.ts` | Job execution with concurrency control |
| `handler-registry.ts` | Job handler registration and lookup |
| `storage-adapter-router.ts` | Routes to appropriate storage backend |
| `job-builder.ts` | Job record construction utilities |