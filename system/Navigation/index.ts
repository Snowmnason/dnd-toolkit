/**
 * System Navigation Layer
 *
 * App-agnostic navigation orchestrator and guard pipeline executor.
 *
 * Provides:
 * - executeRouteTransitionNav: Route transitions with guard pipeline (push/replace/dismissTo)
 * - executeHistoryTransitionNav: History operations (back/dismiss/dismissAll/dismissTo)
 * - executeUtilityTransitionNav: Utility operations (setParams/prefetch)
 * - executeExternalTransitionNav: External link opening
 * - executeStateQueriesNav: State queries (getCurrentRoute/canGoBack/etc)
 * - executeGuardPipeline: Guard execution with priority sorting and timeout handling
 * - TransactionRunner: Transaction lifecycle management
 * - Transport Adapter: Single point for router.* and Linking calls
 *
 * No app-specific logic or hardcoded values.
 * Consumes types from type-definitions (NavigationRequest, NavigationExecutionResult, etc).
 */

// Family-based navigation execution functions
export {
    executeExternalTransitionNav, executeHistoryTransitionNav, executeRouteTransitionNav, executeStateQueriesNav, executeUtilityTransitionNav
} from './app_nav';

// Guard pipeline executor
export { executeGuardPipeline, type GuardPipelineResult } from './guard_executor';

// Transaction lifecycle management
export { TransactionRunner } from './transaction_runner';

// Transport Provider (router instance lifecycle)
export { initializeRouter, isTransportReady } from './expo-router/transport_provider';

// Transport Adapter Layer (all router.* calls centralized here)
export * from './expo-router/transport_adapter';

