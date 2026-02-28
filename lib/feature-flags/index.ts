export {
    FeatureFlags,
    type FeatureFlag,
    type FeatureFlagKind,
    type FeatureFlagName
} from "./feature-flags";

export {
    FeatureFlagsManager,
    type EntitlementState,
    type FeatureFlagState,
    type FlagsSubscriber
} from "./server-sync";

export {
    isUserInCohort, RECOMMENDED_COHORTS, type CohortDef,
    type CohortFlagAssignmentRow,
    type CohortRow,
    type UserCohortMembershipRow
} from "./cohorts";

// Evaluation
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

