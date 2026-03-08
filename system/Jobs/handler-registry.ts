/**
 * Handler Registry
 *
 * Manages the mapping of job type strings to their async handler functions.
 * Used by the orchestrator and executor to register and look up job handlers.
 *
 * Responsibilities:
 * - Register/unregister handlers by job type
 * - Look up handlers for execution
 * - Guard against missing registrations
 */

import { logger } from '@/lib/utils/logger';
import type { JobHandler } from '@/type-definitions/job-queue-types';

export class HandlerRegistry {
  private handlers: Map<string, JobHandler> = new Map();

  /**
   * Register a handler for a job type
   * @throws If jobType or handler is falsy
   */
  register(jobType: string, handler: JobHandler): void {
    if (!jobType) throw new Error('jobType must be a non-empty string');
    if (!handler) throw new Error('handler must be a function');

    this.handlers.set(jobType, handler);
    logger.category('jobs').debug(`Registered handler for job type: ${jobType}`);
  }

  /**
   * Unregister a handler for a job type
   */
  unregister(jobType: string): void {
    this.handlers.delete(jobType);
    logger.category('jobs').debug(`Unregistered handler for job type: ${jobType}`);
  }

  /**
   * Check if a handler is registered for a job type
   */
  has(jobType: string): boolean {
    return this.handlers.has(jobType);
  }

  /**
   * Get the handler for a job type, or undefined if not registered
   */
  get(jobType: string): JobHandler | undefined {
    return this.handlers.get(jobType);
  }
}
