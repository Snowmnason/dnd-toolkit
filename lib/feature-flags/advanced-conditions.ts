/**
 * Advanced Condition Logic for Feature Flags (Phase 3)
 *
 * Supports expressive, composable conditions with:
 * - Nested logical operators (AND, OR, NOT)
 * - Built-in condition evaluators (platform, environment, userRole, time-based)
 * - Plugin system for custom evaluators
 * - Safe evaluation (no infinite recursion, proper error handling)
 *
 * Syntax:
 *
 * Simple (Phase 1):
 * {
 *   "conditions": { "platform": "web", "userRole": "admin" }  // AND logic
 * }
 *
 * Advanced (Phase 3):
 * {
 *   "conditionLogic": {
 *     "operator": "AND",
 *     "conditions": [
 *       { "type": "platform", "value": "web" },
 *       {
 *         "operator": "OR",
 *         "conditions": [
 *           { "type": "userRole", "value": "admin" },
 *           { "type": "userRole", "value": "premium_user" }
 *         ]
 *       }
 *     ]
 *   }
 * }
 */

import { logger } from "../utils/logger";
import type { FlagContext } from "./conditions";

// ==========================================
// Type Definitions
// ==========================================

export type LogicalOperator = "AND" | "OR" | "NOT";

export type ConditionType =
  | "platform"
  | "environment"
  | "userRole"
  | "time"
  | "custom";

/**
 * Built-in condition evaluator
 */
export interface BuiltInCondition {
  type: "platform" | "environment" | "userRole" | "time";
  value?: string | number | boolean;
  config?: Record<string, any>; // For time-based or other complex configs
}

/**
 * Custom condition via plugin evaluator
 */
export interface CustomCondition {
  type: "custom";
  evaluator: string; // Plugin name, e.g., "userAttribute:department"
  config?: Record<string, any>; // Config passed to plugin
}

/**
 * Single condition (built-in or custom)
 */
export type SingleCondition = BuiltInCondition | CustomCondition;

/**
 * Nested logical expression
 */
export interface LogicalExpression {
  operator: "AND" | "OR";
  conditions: (SingleCondition | LogicalExpression)[];
}

/**
 * NOT operator (unary)
 */
export interface NotExpression {
  operator: "NOT";
  condition: SingleCondition | LogicalExpression;
}

/**
 * Any condition node
 */
export type ConditionNode =
  | SingleCondition
  | LogicalExpression
  | NotExpression;

/**
 * Plugin evaluator function signature
 * Returns boolean or undefined (if unable to evaluate)
 */
export type ConditionEvaluator = (
  condition: SingleCondition | LogicalExpression | NotExpression,
  context: FlagContext,
) => boolean | undefined;

/**
 * Plugin interface for custom evaluators
 */
export interface ConditionPlugin {
  name: string; // Unique plugin identifier
  matcher: (type: string, evaluator: string) => boolean; // Matches condition type
  evaluate: ConditionEvaluator;
}

// ==========================================
// Plugin Registry
// ==========================================

/**
 * Global plugin registry for custom condition evaluators
 */
class ConditionPluginRegistry {
  private plugins: Map<string, ConditionPlugin> = new Map();
  private maxDepth = 10; // Prevent infinite recursion

  /**
   * Register a custom condition evaluator plugin
   */
  register(plugin: ConditionPlugin): void {
    if (this.plugins.has(plugin.name)) {
      logger.category("feature_flags").warn(
        `Overwriting plugin: ${plugin.name}`,
      );
    }
    this.plugins.set(plugin.name, plugin);
  }

  /**
   * Unregister a plugin
   */
  unregister(pluginName: string): boolean {
    return this.plugins.delete(pluginName);
  }

  /**
   * List all registered plugins
   */
  listPlugins(): string[] {
    return Array.from(this.plugins.keys());
  }

  /**
   * Evaluate a condition using registered plugins
   */
  evaluateWithPlugins(
    condition: SingleCondition | LogicalExpression | NotExpression,
    context: FlagContext,
    depth: number = 0,
  ): boolean | undefined {
    if (depth > this.maxDepth) {
      logger.category("feature_flags").error(
        `Max recursion depth exceeded for condition evaluation`,
      );
      return undefined;
    }

    // Try each plugin
    for (const plugin of this.plugins.values()) {
      if (plugin.matcher(
        (condition as SingleCondition).type,
        (condition as CustomCondition).evaluator,
      )) {
        return plugin.evaluate(condition, context);
      }
    }

    return undefined;
  }

  /**
   * Get max recursion depth
   */
  getMaxDepth(): number {
    return this.maxDepth;
  }

  /**
   * Set max recursion depth (for testing)
   */
  setMaxDepth(depth: number): void {
    this.maxDepth = depth;
  }

  /**
   * Clear all plugins (for testing)
   */
  clear(): void {
    this.plugins.clear();
  }
}

export const pluginRegistry = new ConditionPluginRegistry();

// ==========================================
// Evaluators
// ==========================================

/**
 * Check if a node is a LogicalExpression (with operator: AND | OR)
 */
function isLogicalExpression(node: any): node is LogicalExpression {
  return (
    node &&
    typeof node === "object" &&
    (node.operator === "AND" || node.operator === "OR") &&
    Array.isArray(node.conditions)
  );
}

/**
 * Check if a node is a NotExpression (with operator: NOT)
 */
function isNotExpression(node: any): node is NotExpression {
  return (
    node &&
    typeof node === "object" &&
    node.operator === "NOT" &&
    node.condition !== undefined
  );
}

/**
 * Evaluate a nested logical expression recursively
 *
 * Supports:
 * - AND: all conditions must be true (empty → false for safety)
 * - OR: at least one condition must be true (empty → false for safety)
 * - NOT: condition must be false
 *
 * **Important:** Built-in condition evaluators (platform, environment, userRole)
 * use case-insensitive matching to align with Phase 1 behavior. Callers should
 * pass a `resolvedContext` with platform/environment defaults to avoid undefined
 * comparisons (see isEnabledWithContext).
 *
 * Note: Empty conditions arrays should be rejected at validation time.
 * The evaluator explicitly returns false for empty arrays to handle
 * edge cases and maintain consistency with the validator's intent.
 */
export function evaluateAdvancedCondition(
  expression: ConditionNode,
  context: FlagContext,
  depth: number = 0,
): boolean {
  const maxDepth = pluginRegistry.getMaxDepth();

  if (depth > maxDepth) {
    logger.category("feature_flags").error(
      `Max recursion depth (${maxDepth}) exceeded in condition evaluation`,
    );
    return false;
  }

  // Handle NOT operator
  if (isNotExpression(expression)) {
    const conditionResult = evaluateAdvancedCondition(
      expression.condition,
      context,
      depth + 1,
    );
    return !conditionResult;
  }

  // Handle AND/OR operators
  if (isLogicalExpression(expression)) {
    // Empty conditions arrays should be rejected by validator, but implement
    // mathematically correct semantics here for safety:
    // - AND with no conditions: vacuously true (all conditions satisfied)
    // - OR with no conditions: false (no conditions to satisfy)
    if (expression.conditions.length === 0) {
      if (expression.operator === "AND") {
        logger.category("feature_flags").warn(
          `Empty AND expression. This should have been caught during validation.`,
        );
        return true; // Vacuously true: all (zero) conditions are satisfied
      } else if (expression.operator === "OR") {
        logger.category("feature_flags").warn(
          `Empty OR expression. This should have been caught during validation.`,
        );
        return false; // No conditions to satisfy
      }
    }

    if (expression.operator === "AND") {
      // All conditions must be true
      return expression.conditions.every((cond) =>
        evaluateAdvancedCondition(cond, context, depth + 1),
      );
    } else if (expression.operator === "OR") {
      // At least one condition must be true
      return expression.conditions.some((cond) =>
        evaluateAdvancedCondition(cond, context, depth + 1),
      );
    }
  }

  // Handle single condition
  const condition = expression as SingleCondition;

  if (condition.type === "platform") {
    // Case-insensitive matching to align with Phase 1 evaluators
    if (!context.platform || !condition.value) {
      return !condition.value; // Match only if both undefined/missing
    }
    return context.platform.toLowerCase() === String(condition.value).toLowerCase();
  }

  if (condition.type === "environment") {
    // Case-insensitive matching to align with Phase 1 evaluators
    if (!context.environment || !condition.value) {
      return !condition.value; // Match only if both undefined/missing
    }
    return context.environment.toLowerCase() === String(condition.value).toLowerCase();
  }

  if (condition.type === "userRole") {
    // Case-insensitive matching to align with Phase 1 evaluators
    if (!context.userRole || !condition.value) {
      return !condition.value; // Match only if both undefined/missing
    }
    return context.userRole.toLowerCase() === String(condition.value).toLowerCase();
  }

  if (condition.type === "time") {
    // Time-based evaluation (hour-of-day, day-of-week, etc.)
    return evaluateTimeCondition(condition.config);
  }

  if (condition.type === "custom") {
    const result = pluginRegistry.evaluateWithPlugins(
      condition,
      context,
      depth + 1,
    );
    return result ?? false; // Default to false if plugin can't evaluate
  }

  logger.category("feature_flags").warn(
    `Unknown condition type: ${condition.type}`,
  );
  return false;
}

/**
 * Evaluate time-based condition
 *
 * Supports:
 * - hour: 0-23 (current hour of day)
 * - dayOfWeek: 0-6 (0=Sunday, 6=Saturday)
 * - startDate, endDate: ISO date strings for seasonal features
 */
function evaluateTimeCondition(config?: Record<string, any>): boolean {
  if (!config) return true;

  const now = new Date();

  // Check hour range (optional)
  if (config.hour !== undefined) {
    const currentHour = now.getHours();
    if (Array.isArray(config.hour)) {
      // Range: [8, 18] means 8am-6pm
      if (
        currentHour < config.hour[0] ||
        currentHour >= config.hour[1]
      ) {
        return false;
      }
    } else if (currentHour !== config.hour) {
      return false;
    }
  }

  // Check day of week (optional)
  if (config.dayOfWeek !== undefined) {
    const currentDay = now.getDay();
    if (Array.isArray(config.dayOfWeek)) {
      if (!config.dayOfWeek.includes(currentDay)) {
        return false;
      }
    } else if (currentDay !== config.dayOfWeek) {
      return false;
    }
  }

  // Check date range (optional)
  if (config.startDate || config.endDate) {
    const time = now.getTime();

    if (config.startDate) {
      const start = new Date(config.startDate).getTime();
      if (time < start) return false;
    }

    if (config.endDate) {
      const end = new Date(config.endDate).getTime();
      if (time > end) return false;
    }
  }

  return true;
}

/**
 * Validate advanced condition expression for common errors
 *
 * Returns array of error messages (empty if valid)
 *
 * Notes:
 * - Empty conditions arrays are rejected: AND/OR with no conditions is logically
 *   valid but practically meaningless in a feature flag context and likely indicates
 *   a configuration error.
 * - Evaluator will also safely reject empties if they somehow bypass validation.
 */
export function validateAdvancedCondition(
  expression: ConditionNode,
  depth: number = 0,
): string[] {
  const errors: string[] = [];
  const maxDepth = pluginRegistry.getMaxDepth();

  if (depth > maxDepth) {
    errors.push(`Condition nesting exceeds maximum depth of ${maxDepth}`);
    return errors;
  }

  // Validate NOT expression
  if (isNotExpression(expression)) {
    if (!expression.condition) {
      errors.push("NOT expression missing condition");
    } else {
      errors.push(
        ...validateAdvancedCondition(expression.condition, depth + 1),
      );
    }
    return errors;
  }

  // Validate AND/OR expression
  if (isLogicalExpression(expression)) {
    if (!expression.operator) {
      errors.push("Logical expression missing operator");
    } else if (!["AND", "OR"].includes(expression.operator)) {
      errors.push(
        `Invalid operator: ${expression.operator}. Must be AND or OR`,
      );
    }

    if (!expression.conditions || !Array.isArray(expression.conditions)) {
      errors.push("Logical expression missing conditions array");
    } else if (expression.conditions.length === 0) {
      errors.push("Logical expression has empty conditions array");
    } else {
      expression.conditions.forEach((cond, idx) => {
        const subErrors = validateAdvancedCondition(cond, depth + 1);
        subErrors.forEach((err) => {
          errors.push(`conditions[${idx}]: ${err}`);
        });
      });
    }
    return errors;
  }

  // Validate single condition
  const condition = expression as SingleCondition;

  if (!condition.type) {
    errors.push("Condition missing type field");
  } else if (
    ![
      "platform",
      "environment",
      "userRole",
      "time",
      "custom",
    ].includes(condition.type)
  ) {
    errors.push(
      `Invalid condition type: ${condition.type}`,
    );
  }

  // Validate custom condition has evaluator
  if (condition.type === "custom") {
    const customCond = condition as CustomCondition;
    if (!customCond.evaluator) {
      errors.push("Custom condition missing evaluator field");
    }
  }

  return errors;
}
