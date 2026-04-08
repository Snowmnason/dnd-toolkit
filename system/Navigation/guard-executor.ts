/**
 * Guard Executor
 *
 * Executes the guard pipeline in priority order:
 * 1. Pre-guards (early exit, lightweight checks)
 * 2. Normal guards (main business logic)
 * 3. Post-guards (side effects, logging)
 *
 * Stops on first non-allow decision.
 * Collects errors per guard without stopping pipeline (non-fatal errors).
 */

import type {
    NavigationContext,
    NavigationDecision,
    NavigationGuardConfig,
} from '@/type-definitions';

/**
 * GuardExecutionResult - Result from executing a single guard
 */
interface GuardExecutionResult {
  name: string;
  priority: 'pre' | 'normal' | 'post';
  status: 'allowed' | 'denied' | 'error';
  decision?: NavigationDecision;
  durationMs: number;
  error?: Error;
}

/**
 * GuardPipelineResult - Result from the entire guard pipeline
 */
export interface GuardPipelineResult {
  decision: NavigationDecision;
  guardsExecuted: GuardExecutionResult[];
  errors: { guard?: string; error: string; phase?: 'pre' | 'normal' | 'post' }[];
}

/**
 * Execute a guard with timeout
 */
async function executeGuardWithTimeout(
  guard: NavigationGuardConfig,
  context: NavigationContext,
  timeoutMs: number
): Promise<GuardExecutionResult> {
  const startMs = Date.now();

  try {
    // Skip guard if skipIf condition is met
    if (guard.skipIf && guard.skipIf(context)) {
      return {
        name: guard.name,
        priority: guard.priority,
        status: 'allowed',
        durationMs: Date.now() - startMs,
      };
    }

    // Create timeout promise
    const timeoutPromise = new Promise<NavigationDecision>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Guard "${guard.name}" exceeded timeout of ${timeoutMs}ms`));
      }, timeoutMs);
    });

    // Race guard execution against timeout
    const decision = (await Promise.race([
      guard.check(context),
      timeoutPromise,
    ])) as NavigationDecision;

    return {
      name: guard.name,
      priority: guard.priority,
      status: decision.status === 'allow' ? 'allowed' : 'denied',
      decision,
      durationMs: Date.now() - startMs,
    };
  } catch (error) {
    return {
      name: guard.name,
      priority: guard.priority,
      status: 'error',
      durationMs: Date.now() - startMs,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Execute the guard pipeline
 *
 * 1. Sort guards by priority (pre → normal → post)
 * 2. Execute each guard with timeout
 * 3. Stop on first non-allow decision
 * 4. Collect errors without stopping pipeline
 *
 * @param guards Array of guard configurations
 * @param context Navigation context to pass to guards
 * @returns Pipeline execution result with decision and metadata
 */
export async function executeGuardPipeline(
  guards: NavigationGuardConfig[],
  context: NavigationContext
): Promise<GuardPipelineResult> {
  const guardsExecuted: GuardExecutionResult[] = [];
  const errors: { guard?: string; error: string; phase?: 'pre' | 'normal' | 'post' }[] = [];

  // Sort guards by priority: pre → normal → post
  const sortedGuards = [...guards].sort((a, b) => {
    const priorityOrder = { pre: 0, normal: 1, post: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  // Default timeout: 5 seconds per guard
  const defaultTimeoutMs = 5000;

  // Execute guards sequentially in priority order
  for (const guard of sortedGuards) {
    const timeoutMs = guard.timeoutMs || defaultTimeoutMs;
    const result = await executeGuardWithTimeout(guard, context, timeoutMs);

    guardsExecuted.push(result);

    // If guard errored, collect error but continue
    if (result.status === 'error') {
      errors.push({
        guard: guard.name,
        error: result.error?.message || 'Unknown error',
        phase: guard.priority,
      });
      // Continue to next guard on error (non-fatal)
      continue;
    }

    // If guard denied (non-allow), stop pipeline and return decision
    if (result.status === 'denied' && result.decision) {
      return {
        decision: result.decision,
        guardsExecuted,
        errors,
      };
    }
  }

  // If all guards allowed (or errored non-fatally), return allow
  return {
    decision: { status: 'allow' },
    guardsExecuted,
    errors,
  };
}
