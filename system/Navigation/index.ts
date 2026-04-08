/**
 * System Navigation Layer
 *
 * App-agnostic navigation orchestrator and guard pipeline executor.
 *
 * Provides:
 * - AppNav: Main orchestrator for navigation decisions
 * - TransactionRunner: Transaction lifecycle management (ID, timeout, latency)
 * - executeGuardPipeline: Guard execution with priority sorting and timeout handling
 *
 * No app-specific logic or hardcoded values.
 * Consumes types from type-definitions (NavigationContext, NavigationDecision, etc.).
 */

export { AppNav } from './app-nav';
export { executeGuardPipeline, type GuardPipelineResult } from './guard-executor';
export { TransactionRunner } from './transaction-runner';

