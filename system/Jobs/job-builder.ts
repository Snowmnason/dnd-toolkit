/**
 * Job Builder
 *
 * Validates enqueue options, checks for duplicates via idempotency key,
 * constructs a canonical JobRecord from raw options, and persists it.
 *
 * Responsibilities:
 * - Ensure type and payload are present
 * - Validate payload size against configured limit
 * - Deduplicate: if a pending job with the same idempotency key exists, reuse it
 * - Build a complete JobRecord with all defaults applied
 * - Persist the new job to the correct storage adapter (via router)
 *
 * Does NOT:
 * - Schedule or execute jobs (that's JobScheduler / JobExecutor)
 * - Apply network preconditions (that's lib/middleware/jobs/job-service.ts)
 * - Normalise options (that's the middleware layer)
 */

import { logger } from '@/lib/utils/logger';
import type { EnqueueOptions, JobRecord } from '@/type-definitions/job-queue-types';
import type { StorageAdapterRouter } from './storage-adapter-router';

export interface BuilderConfig {
  maxPayloadBytes: number;
  maxRetries: number;
  baseBackoffMs: number;
  defaultJobTtlMs: number;
}

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class JobBuilder {
  constructor(
    private router: StorageAdapterRouter,
    private config: BuilderConfig,
  ) {}

  /**
   * Validate, deduplicate, build and persist a new job.
   *
   * @returns Job ID — new, or existing if idempotency key matched
   * @throws If type/payload missing or payload exceeds size limit
   */
  async enqueue(options: EnqueueOptions): Promise<string> {
    if (!options.type) throw new Error('options.type is required');
    if (!options.payload) throw new Error('options.payload is required');

    const payloadSize = JSON.stringify(options.payload).length;
    if (payloadSize > this.config.maxPayloadBytes) {
      throw new Error(
        `Payload exceeds maximum size: ${payloadSize} > ${this.config.maxPayloadBytes}`,
      );
    }

    // Idempotency deduplication — return existing job ID if key already pending
    if (options.idempotencyKey) {
      const existing = await this.findByIdempotencyKey(options.idempotencyKey);
      if (existing) {
        logger.category('jobs').debug(
          `Idempotency key already exists: ${options.idempotencyKey}, reusing ${existing.id}`,
        );
        return existing.id;
      }
    }

    const job: JobRecord = {
      id: generateUUID(),
      type: options.type,
      payload: options.payload,
      idempotencyKey: options.idempotencyKey,
      status: 'pending',
      retryCount: 0,
      maxRetries: options.maxRetries ?? this.config.maxRetries,
      backoffMs: options.baseBackoffMs ?? this.config.baseBackoffMs,
      runAt: options.runAt ?? Date.now(),
      createdAt: Date.now(),
      recurrencePattern: options.recurrencePattern,
      requiresNetwork: options.requiresNetwork,
      priority: options.priority ?? 'normal',
      ttlMs: options.ttlMs ?? this.config.defaultJobTtlMs,
      sensitive: options.sensitive ?? false,
    };

    const adapter = await this.router.getAdapterForJob(job.sensitive);
    await adapter.set(job);

    logger.category('jobs').info(
      `Enqueued job: ${job.id} (type: ${job.type}, sensitive: ${job.sensitive}, runAt: ${new Date(job.runAt).toISOString()})`,
    );

    return job.id;
  }

  private async findByIdempotencyKey(key: string): Promise<JobRecord | null> {
    const allJobs = await this.router.getAllJobs();
    return allJobs.find(job => job.idempotencyKey === key && job.status === 'pending') ?? null;
  }
}
