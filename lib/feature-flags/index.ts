/**
 * Feature Flags Module Barrel Export
 *
 * Public API: Use manager functions (getFlag, isEnabledWithContext, etc.)
 * Internal: FeatureFlags and FeatureFlagsManager singletons are private
 *
 * The manager wraps both config-driven and server-driven flags with fallback logic:
 * - Online: Server flags (with conditions, cohorts, overrides)
 * - Offline: Config flags (simple enabled/disabled)
 */

// Manager API (primary entry point for hooks/managers)
export {
    clearAllOverrides, clearOverride, getAllFlags, getByKind,
    getEntitlement, getFlag, getKind, isEnabledWithContext, setOverride, subscribe,
    toggle,
    toggleKind, verifyDeviceClock
} from './feature-flags-manager';

// Types (needed for type annotations)
export type {
    FeatureFlag,
    FeatureFlagKind,
    FeatureFlagName
} from "./local-flags";

// Evaluation (used by manager internally, also available for advanced use)
export {
    evaluateConditions,
    matchEnvironment,
    matchPlatform,
    matchUserRole,
    type FlagConditions,
    type FlagContext
} from "./evaluation/conditions";

export {
    evaluateAdvancedCondition,
    pluginRegistry,
    validateAdvancedCondition,
    type BuiltInCondition,
    type ConditionEvaluator,
    type ConditionNode,
    type ConditionPlugin,
    type ConditionType,
    type CustomCondition,
    type LogicalExpression,
    type LogicalOperator,
    type NotExpression,
    type SingleCondition
} from "./evaluation/advanced-conditions";

// NOTE: useFeatureFlags is NOT exported here to avoid circular dependency
// Import directly from hooks/feature/use-feature-flags instead
// NOTE: useEntitlement is NOT exported here to avoid circular dependency
// Import directly from hooks/feature/use-entitlements instead

// Admin Tooling
export {
    analyzeFlagImpact,
    describeEvaluation,
    generateDependencyGraph,
    simulateContexts,
    validateFlagConfig,
    visualizeDependencyGraph,
    type DependencyGraph,
    type DependencyNode,
    type FlagImpactAnalysis,
    type SimulationResult,
    type ValidationIssue
} from "./admin/admin-tooling";

