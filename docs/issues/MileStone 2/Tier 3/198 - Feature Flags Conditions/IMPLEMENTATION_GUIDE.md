# Feature Flags Conditions - Implementation Guide

## Current Architecture Overview

The feature flags conditions system is implemented across multiple modules with clear separation of concerns. This guide documents the current implementation to facilitate maintenance, debugging, and rollback scenarios.

## Core Components

### 1. Configuration Schema (`lib/config/loader.ts`)

**Location**: `lib/config/loader.ts` lines 120-140

**Current Schema**:
```typescript
{
  enabled: boolean;
  description?: string;
  kind?: "free" | "premium" | "beta";
  dependsOn?: string[]; // Soft dependencies

  // Phase 1: Simple conditions (AND logic)
  conditions?: {
    platform?: string;
    environment?: string;
    userRole?: string;
  };

  // Phase 3: Advanced condition logic
  conditionLogic?: {
    operator: "AND" | "OR" | "NOT";
    conditions?: any[]; // Nested conditions
    condition?: any;    // For NOT operator
  };
}
```

**Key Points**:
- Both `conditions` and `conditionLogic` coexist
- `conditionLogic` takes precedence when present
- Schema uses `any[]` for flexibility in nested structures

### 2. Simple Conditions (`lib/feature-flags/conditions.ts`)

**Location**: `lib/feature-flags/conditions.ts` (136 lines)

**Core Functions**:
- `evaluateConditions()`: Main evaluator for simple AND logic
- `matchPlatform()`, `matchEnvironment()`, `matchUserRole()`: Individual evaluators

**Current Implementation**:
```typescript
export function evaluateConditions(
  conditions: FlagConditions | undefined,
  context: FlagContext,
): boolean {
  if (!conditions) return true;

  const currentPlatform = context.platform || getPlatformName();
  const currentEnvironment = context.environment || getAppConfig().environment;
  const currentRole = context.userRole;

  return (
    matchPlatform(conditions.platform, currentPlatform) &&
    matchEnvironment(conditions.environment, currentEnvironment) &&
    matchUserRole(conditions.userRole, currentRole)
  );
}
```

**Dependencies**: `getAppConfig()`, `getPlatformName()`

### 3. Advanced Conditions (`lib/feature-flags/advanced-conditions.ts`)

**Location**: `lib/feature-flags/advanced-conditions.ts` (461 lines)

**Core Components**:
- `ConditionNode` types: `SingleCondition`, `LogicalExpression`, `NotExpression`
- `evaluateAdvancedCondition()`: Recursive evaluator with depth limiting
- `ConditionPluginRegistry`: Singleton for custom evaluators

**Current Implementation Structure**:
```typescript
export type ConditionNode =
  | SingleCondition
  | LogicalExpression
  | NotExpression;

export function evaluateAdvancedCondition(
  node: ConditionNode,
  context: FlagContext,
  depth: number = 0,
): boolean {
  // Recursion safety: max depth 10
  if (depth > 10) throw new Error("Max recursion depth exceeded");

  // Handle different node types...
}
```

**Built-in Evaluators**:
- Platform, Environment, UserRole (delegates to simple evaluators)
- Time-based: `evaluateTimeCondition()`
- Custom: Via plugin registry

**Plugin System**:
```typescript
export class ConditionPluginRegistry {
  private plugins = new Map<string, ConditionPlugin>();

  register(plugin: ConditionPlugin): void {
    this.plugins.set(plugin.name, plugin);
  }

  evaluate(evaluatorName: string, condition: any, context: FlagContext): boolean {
    const plugin = this.plugins.get(evaluatorName);
    if (!plugin) return false;

    const result = plugin.evaluate(condition, context);
    return result ?? false; // Fail-secure
  }
}

export const pluginRegistry = new ConditionPluginRegistry();
```

### 4. Server-Sync Integration (`lib/feature-flags/server-sync.ts`)

**Location**: `lib/feature-flags/server-sync.ts` lines 1425-1460

**Current Integration Logic**:
```typescript
// In _resolveFlag() method
if (flagConfig.conditionLogic) {
  // Phase 3: Advanced conditions take precedence
  try {
    const validationErrors = validateAdvancedCondition(
      flagConfig.conditionLogic as any,
    );
    if (validationErrors.length > 0) {
      logger.category('feature-flags').error("Invalid conditionLogic...`);
      return false;
    }

    const conditionsPass = evaluateAdvancedCondition(
      flagConfig.conditionLogic as any,
      context,
    );
    if (!conditionsPass) return false;
  } catch (error) {
    logger.category('feature-flags').error(`Error evaluating advanced conditions...`);
    return false;
  }
} else if (flagConfig.conditions) {
  // Phase 1: Fall back to simple conditions
  const conditionsPass = evaluateConditions(flagConfig.conditions, context);
  if (!conditionsPass) return false;
}
```

**Validation at Bootstrap**:
```typescript
// In validateFlagDependencies()
if (flagConfig.conditionLogic) {
  const validationErrors = validateAdvancedCondition(
    flagConfig.conditionLogic as any,
  );
  if (validationErrors.length > 0) {
    logger.category('feature-flags').warn(`Invalid conditionLogic for flag...`);
  }
}
```

## Data Flow

### Flag Evaluation Flow

```
FeatureFlagsManager.isEnabledWithContext(flagName, context)
    ↓
_resolveFlag(flagName, context, memo)
    ↓
Check conditionLogic (Phase 3) → evaluateAdvancedCondition()
    ↓ OR
Check conditions (Phase 1) → evaluateConditions()
    ↓
Check dependencies → recursive _resolveFlag() calls
    ↓
Return boolean result
```

### Context Resolution

```typescript
// In _makeContextKey() and evaluation
const platform = context.platform || getPlatformName();
const environment = context.environment || getAppConfig().environment;
const role = context.userRole || getCachedUserRole(); // From entitlements
```

## Caching Strategy

### Evaluation Cache (`lib/feature-flags/cache.ts`)

**Location**: `lib/feature-flags/cache.ts` (280 lines)

**Current Implementation**:
- LRU cache with max 1000 entries per category
- Cache key: `${flagName}::${platform}::${environment}::${role}`
- Cache invalidation on flag updates and role changes

**Integration in Server-Sync**:
```typescript
private _resolveFlag(flagName: string, context: FlagContext, memo: Map<string, boolean>) {
  const cacheKey = this._makeContextKey(flagName, context);
  const cached = this.evaluationCache.get(cacheKey);
  if (cached !== undefined) return cached;

  // ... evaluation logic ...

  memo.set(cacheKey, result);
  return result;
}
```

## Admin Tooling (`lib/feature-flags/admin-tooling.ts`)

**Location**: `lib/feature-flags/admin-tooling.ts` (483 lines)

**Current Tools**:
- `validateFlagConfig()`: Config linting and validation
- `generateDependencyGraph()`: Dependency analysis with cycle detection
- `simulateContexts()`: Context simulation for testing
- `analyzeFlagImpact()`: Impact analysis and risk assessment
- `visualizeDependencyGraph()`: ASCII visualization

**Key Implementation Details**:
```typescript
export function validateFlagConfig(): ValidationIssue[] {
  const config = getAppConfig();
  const flags = config.featureFlags || [];

  // Check each flag for issues...
  if (flagConfig.conditionLogic) {
    const errors = validateAdvancedCondition(flagConfig.conditionLogic as any);
    // ... add validation issues
  }
}
```

## Telemetry (`lib/feature-flags/telemetry.ts`)

**Location**: `lib/feature-flags/telemetry.ts` (370 lines)

**Current Metrics**:
- Condition evaluation success/failure/timing
- Cache hit/miss/invalidation rates
- Flag usage counts and enable rates
- Dependency resolution performance

**Global Instance**:
```typescript
export const featureFlagsTelemetry = new FeatureFlagsTelemetry();
```

**Integration Points**:
- Automatic recording in `FeatureFlagsManager._resolveFlag()`
- Health checks via `performHealthCheck()`
- Report generation for monitoring

## Error Handling & Safety

### Recursion Protection
- Advanced conditions: Max depth 10 in `evaluateAdvancedCondition()`
- Dependency resolution: Cycle detection in `_detectCycle()`

### Fail-Safe Behavior
- Invalid conditions → false (flag disabled)
- Plugin evaluation errors → false (fail-secure)
- Missing dependencies → logged warnings, non-blocking

### Validation
- Bootstrap validation of all conditionLogic
- Runtime validation before evaluation
- Comprehensive error logging

## Rollback Scenarios

### To Phase 1 Only (Remove Advanced Conditions)

1. **Remove conditionLogic from config schema**:
   ```typescript
   // In lib/config/loader.ts
   // Remove conditionLogic field from FeatureFlagConfig
   ```

2. **Remove advanced condition imports**:
   ```typescript
   // In lib/feature-flags/server-sync.ts
   // Remove evaluateAdvancedCondition, validateAdvancedCondition imports
   ```

3. **Simplify evaluation logic**:
   ```typescript
   // In _resolveFlag()
   // Remove conditionLogic check, keep only conditions check
   ```

4. **Remove advanced condition files**:
   - Delete `lib/feature-flags/advanced-conditions.ts`
   - Delete `lib/feature-flags/admin-tooling.ts`
   - Delete `lib/feature-flags/telemetry.ts`

### To No Conditions (Config-Only Flags)

1. **Remove condition evaluation entirely**:
   ```typescript
   // In _resolveFlag()
   // Remove all condition checks, return true after dependency checks
   ```

2. **Remove condition-related code**:
   - Delete conditions.ts
   - Remove condition fields from config schema

## Testing Strategy

### Test Coverage
- **conditions.test.ts**: Simple condition evaluators (20 tests)
- **advanced-conditions.test.ts**: Advanced logic, plugins, telemetry (49 tests)
- **server-sync-cache.test.ts**: Cache integration (15 tests)

### Test Categories
- Unit tests for individual evaluators
- Integration tests for full flag resolution
- Plugin system tests
- Cache performance tests
- Admin tooling validation tests

## Performance Characteristics

### Current Benchmarks
- Simple conditions: < 1ms evaluation
- Advanced conditions: 1-5ms (depends on complexity)
- Cache hit rate: > 95% for repeated evaluations
- Memory usage: ~50KB for cache (1000 entries)

### Optimization Points
- LRU cache prevents unbounded growth
- Memoization in recursive evaluation
- Plugin registry uses Map for O(1) lookups
- Validation cached at bootstrap

## Maintenance Notes

### Adding New Condition Types
1. Add to `ConditionType` union in advanced-conditions.ts
2. Implement evaluator function
3. Add to `evaluateAdvancedCondition()` switch
4. Update validation logic
5. Add tests

### Custom Plugin Development
1. Implement `ConditionPlugin` interface
2. Register with `pluginRegistry.register()`
3. Handle errors gracefully (return boolean)
4. Document evaluator name and config schema

### Monitoring & Debugging
1. Use `validateFlagConfig()` for config issues
2. Check telemetry reports for performance problems
3. Use `visualizeDependencyGraph()` for complex setups
4. Review logs for evaluation errors

## File Dependencies

```
lib/feature-flags/
├── server-sync.ts (main integration)
├── conditions.ts (simple evaluators)
├── advanced-conditions.ts (advanced logic + plugins)
├── cache.ts (LRU cache)
├── admin-tooling.ts (validation + analysis)
├── telemetry.ts (monitoring)
└── README.md (documentation)

Depends on:
├── lib/config/loader.ts (schema + config access)
├── lib/utils/logger.ts (logging)
└── lib/config/platform-config.ts (platform detection)
```