/**
 * AppNav Orchestrator
 *
 * Main system-layer navigation orchestrator.
 *
 * Manages the complete transaction lifecycle:
 * 1. Create transaction (ID, timing)
 * 2. Execute guard pipeline
 * 3. Collect errors and metadata
 * 4. Return typed NavigationDecision
 *
 * App-agnostic: no hardcoded values, no app-specific imports.
 * Designed to work with any routing system by consuming/returning types from type-definitions.
 */

import { logger } from '@/lib/utils';
import type {
    NavigationContext,
    NavigationDecision,
    NavigationGuardConfig,
    NavigationTransaction,
} from '@/type-definitions';
import { executeGuardPipeline, type GuardPipelineResult } from './guard-executor';
import { TransactionRunner } from './transaction-runner';

/**
 * AppNav - App-agnostic navigation orchestrator
 *
 * Entry point for the navigation middleware system.
 * Coordinates transaction creation, guard execution, and result collection.
 */
export class AppNav {
  /**
   * Execute a navigation action through the guard pipeline
   *
   * @param context Navigation context (from/to route, params, user info)
   * @param guardsToRun Array of guards to execute
   * @returns Navigation decision (allow, redirect, abort, or modal_then_redirect)
   * @throws On unrecoverable errors (logs internally)
   */
  static async execute(
    context: NavigationContext,
    guardsToRun: NavigationGuardConfig[]
  ): Promise<NavigationDecision> {
    // Create transaction runner for tracking
    const transaction = new TransactionRunner(
      context.fromRoute,
      context.toRoute,
      context.triggeredBy
    );

    const transactionId = transaction.getId();

    try {
      // Log transaction start
      logger.category('navigation').debug(
        `Transaction ${transactionId} started: ${context.fromRoute} → ${context.toRoute} (triggered by: ${context.triggeredBy})`
      );

      // Execute guard pipeline
      const pipelineResult: GuardPipelineResult = await executeGuardPipeline(
        guardsToRun,
        context
      );

      const decision = pipelineResult.decision;
      const elapsedMs = transaction.getElapsedMs();

      // Log decision
      if (decision.status === 'allow') {
        logger.category('navigation').debug(
          `Transaction ${transactionId} allowed in ${elapsedMs}ms`
        );
      } else if (decision.status === 'redirect') {
        logger.category('navigation').debug(
          `Transaction ${transactionId} redirecting to ${(decision as any).target} (${(decision as any).reason}) in ${elapsedMs}ms`
        );
      } else if (decision.status === 'abort') {
        logger.category('navigation').warn(
          `Transaction ${transactionId} aborted: ${(decision as any).reason} in ${elapsedMs}ms`
        );
      } else if (decision.status === 'modal_then_redirect') {
        logger.category('navigation').debug(
          `Transaction ${transactionId} modal+redirect (${(decision as any).reason}) in ${elapsedMs}ms`
        );
      }

      // Log any non-fatal errors from guards
      if (pipelineResult.errors.length > 0) {
        pipelineResult.errors.forEach((err) => {
          logger.category('navigation').warn(
            `Guard "${err.guard}" error in phase ${err.phase}: ${err.error}`
          );
        });
      }

      return decision;
    } catch (error) {
      const elapsedMs = transaction.getElapsedMs();

      // Log system-level error
      logger.category('navigation').error(
        `Transaction ${transactionId} crashed in ${elapsedMs}ms: ${error instanceof Error ? error.message : String(error)}`
      );

      // Return abort decision on unrecoverable error
      return {
        status: 'abort',
        error: error instanceof Error ? error.message : 'Navigation pipeline error',
        reason: 'System error in navigation pipeline',
      };
    }
  }

  /**
   * Create a transaction snapshot for audit/analytics
   * Useful for recording the full transaction state after execution.
   *
   * @param context Navigation context
   * @param decision Final decision
   * @param guardsExecuted List of guards that ran
   * @returns Transaction record
   */
  static createTransactionRecord(
    context: NavigationContext,
    decision: NavigationDecision,
    guardsExecuted: {
      name: string;
      priority: 'pre' | 'normal' | 'post';
      status: 'allowed' | 'denied' | 'error';
      durationMs: number;
    }[],
    elapsedMs: number
  ): NavigationTransaction {
    const transaction: NavigationTransaction = {
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status:
        decision.status === 'allow'
          ? 'allowed'
          : decision.status === 'redirect'
            ? 'redirected'
            : decision.status === 'abort'
              ? 'aborted'
              : 'allowed',
      fromRoute: context.fromRoute,
      toRoute: context.toRoute,
      decision,
      latencyMs: elapsedMs,
      timestamp: new Date(),
      userId: context.userId,
      guardsExecuted,
    };

    return transaction;
  }
}
