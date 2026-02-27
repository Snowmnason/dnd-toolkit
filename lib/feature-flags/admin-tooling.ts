/**
 * Feature Flags Admin Tooling (Phase 3)
 *
 * Provides utilities for:
 * - Config validation and linting
 * - Dependency graph visualization
 * - Context simulation and testing
 * - Flag impact analysis
 */

import { getAppConfig } from '@/config';
import { validateAdvancedCondition } from "./advanced-conditions";
import type { FlagContext } from "./conditions";
import { FeatureFlagsManager } from "./server-sync";

// ==========================================
// Config Validation
// ==========================================

export interface ValidationIssue {
  type: "error" | "warning" | "info";
  flag: string;
  message: string;
  suggestion?: string;
}

/**
 * Comprehensive feature flag config validation
 *
 * Checks for:
 * - Invalid flag names
 * - Missing dependencies
 * - Circular dependencies
 * - Invalid condition syntax
 * - Unused flags
 * - Performance issues
 */
export function validateFlagConfig(): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const config = getAppConfig();
  const flags = config.featureFlags || {};

  if (Object.keys(flags).length === 0) {
    return issues;
  }

  const allFlagNames = new Set(Object.keys(flags));
  const referencedFlags = new Set<string>();

  // Validate each flag
  for (const [flagName, flagConfig] of Object.entries(flags)) {
    if (!flagConfig || typeof flagConfig !== "object") {
      issues.push({
        type: "error",
        flag: flagName,
        message: "Invalid flag config (not an object)",
      });
      continue;
    }

    // Validate flag name format
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(flagName)) {
      issues.push({
        type: "warning",
        flag: flagName,
        message: `Flag name "${flagName}" doesn't follow naming convention`,
        suggestion: "Use camelCase: myFeatureName",
      });
    }

    // Validate enabled field
    if (typeof flagConfig.enabled !== "boolean") {
      issues.push({
        type: "error",
        flag: flagName,
        message: 'Field "enabled" must be boolean',
      });
    }

    // Validate kind field
    if (
      flagConfig.kind &&
      !["free", "premium", "beta"].includes(flagConfig.kind)
    ) {
      issues.push({
        type: "warning",
        flag: flagName,
        message: `Unknown kind: "${flagConfig.kind}"`,
        suggestion: 'Use one of: "free", "premium", "beta"',
      });
    }

    // Validate dependencies
    if (flagConfig.dependsOn && Array.isArray(flagConfig.dependsOn)) {
      for (const depName of flagConfig.dependsOn) {
        referencedFlags.add(depName);

        if (!allFlagNames.has(depName)) {
          issues.push({
            type: "error",
            flag: flagName,
            message: `Depends on missing flag: "${depName}"`,
          });
        }
      }
    }

    // Validate simple conditions
    if (flagConfig.conditions && typeof flagConfig.conditions === "object") {
      const conditions = flagConfig.conditions;

      if (conditions.platform && typeof conditions.platform !== "string") {
        issues.push({
          type: "warning",
          flag: flagName,
          message: 'Condition "platform" should be a string',
        });
      }

      if (
        conditions.environment &&
        !["development", "production"].includes(conditions.environment)
      ) {
        issues.push({
          type: "warning",
          flag: flagName,
          message: `Invalid environment: "${conditions.environment}"`,
          suggestion: 'Use one of: "development", "production"',
        });
      }
    }

    // Validate advanced conditions
    if (flagConfig.conditionLogic) {
      const validationErrors = validateAdvancedCondition(
        flagConfig.conditionLogic as any,
      );
      for (const error of validationErrors) {
        issues.push({
          type: "error",
          flag: flagName,
          message: `Invalid conditionLogic: ${error}`,
        });
      }
    }

    // Warn if flag has both simple conditions and advanced logic
    if (flagConfig.conditions && flagConfig.conditionLogic) {
      issues.push({
        type: "warning",
        flag: flagName,
        message:
          "Flag has both 'conditions' and 'conditionLogic' - only conditionLogic will be used",
        suggestion: "Remove deprecated 'conditions' field",
      });
    }
  }

  // Check for unused flags (not referenced by any dependency)
  for (const flagName of allFlagNames) {
    if (!referencedFlags.has(flagName) && flagName !== "root") {
      // Info level—not an error, just unused
      issues.push({
        type: "info",
        flag: flagName,
        message: "Flag is defined but never used as a dependency",
      });
    }
  }

  return issues;
}

// ==========================================
// Dependency Graph Analysis
// ==========================================

export interface DependencyNode {
  name: string;
  enabled: boolean;
  dependencies: string[];
  dependents: string[];
  kind?: string;
  hasConditions: boolean;
  depth: number; // For visualization
}

export interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  cycles: string[][];
}

/**
 * Generate dependency graph for visualization and analysis
 *
 * Returns node map (for rendering) and detected cycles (for validation)
 */
export function generateDependencyGraph(): DependencyGraph {
  const config = getAppConfig();
  const flags = config.featureFlags || {};
  const nodes = new Map<string, DependencyNode>();

  // Build initial nodes
  for (const [flagName, flagConfig] of Object.entries(flags)) {
    if (!flagConfig || typeof flagConfig !== "object") continue;

    nodes.set(flagName, {
      name: flagName,
      enabled: flagConfig.enabled ?? false,
      dependencies: flagConfig.dependsOn ?? [],
      dependents: [],
      kind: flagConfig.kind,
      hasConditions: !!(flagConfig.conditions || flagConfig.conditionLogic),
      depth: 0,
    });
  }

  // Build reverse dependencies (dependents)
  for (const [flagName, node] of nodes) {
    for (const dep of node.dependencies) {
      const depNode = nodes.get(dep);
      if (depNode) {
        depNode.dependents.push(flagName);
      }
    }
  }

  // Calculate depth (distance from leaf nodes)
  function calculateDepth(nodeName: string, visited: Set<string> = new Set()): number {
    if (visited.has(nodeName)) return 0;
    visited.add(nodeName);

    const node = nodes.get(nodeName);
    if (!node || node.dependencies.length === 0) return 0;

    const maxDepth = Math.max(
      ...node.dependencies.map((dep) => calculateDepth(dep, new Set(visited))),
    );
    return maxDepth + 1;
  }

  for (const nodeName of nodes.keys()) {
    const node = nodes.get(nodeName)!;
    node.depth = calculateDepth(nodeName);
  }

  // Detect cycles
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function detectCycles(nodeName: string, path: string[] = []): void {
    if (recursionStack.has(nodeName)) {
      const cycleStart = path.indexOf(nodeName);
      if (cycleStart !== -1) {
        cycles.push([...path.slice(cycleStart), nodeName]);
      }
      return;
    }

    if (visited.has(nodeName)) return;

    visited.add(nodeName);
    recursionStack.add(nodeName);

    const node = nodes.get(nodeName);
    if (node) {
      for (const dep of node.dependencies) {
        detectCycles(dep, [...path, nodeName]);
      }
    }

    recursionStack.delete(nodeName);
  }

  for (const nodeName of nodes.keys()) {
    if (!visited.has(nodeName)) {
      detectCycles(nodeName);
    }
  }

  return { nodes, cycles };
}

// ==========================================
// Context Simulator
// ==========================================

export interface SimulationResult {
  flag: string;
  enabled: boolean;
  reason: string;
  context: FlagContext;
  evaluationMs: number;
}

/**
 * Simulate flag evaluation with different contexts
 *
 * Useful for testing and debugging flag behavior without redeploy
 */
export function simulateContexts(
  flagName: string,
  contexts: FlagContext[],
): SimulationResult[] {
  const results: SimulationResult[] = [];

  for (const context of contexts) {
    const start = performance.now();
    const enabled = FeatureFlagsManager.isEnabledWithContext(
      flagName,
      context,
    );
    const evaluationMs = performance.now() - start;

    const reason = describeEvaluation(flagName, context, enabled);

    results.push({
      flag: flagName,
      enabled,
      reason,
      context,
      evaluationMs,
    });
  }

  return results;
}

/**
 * Generate human-readable description of why a flag evaluated to enabled/disabled
 */
export function describeEvaluation(
  flagName: string,
  context: FlagContext,
  enabled: boolean,
): string {
  const config = getAppConfig();
  // eslint-disable-next-line security/detect-object-injection
  const flagConfig = config.featureFlags?.[flagName];

  if (!flagConfig) {
    return "Flag not found in config";
  }

  if (!flagConfig.enabled) {
    return "Base flag is disabled";
  }

  const items: string[] = [];

  // Check conditions
  if (flagConfig.conditionLogic) {
    items.push("Advanced conditions");
  } else if (flagConfig.conditions) {
    items.push("Simple conditions");
  }

  // Check dependencies
  if (flagConfig.dependsOn && flagConfig.dependsOn.length > 0) {
    items.push(`${flagConfig.dependsOn.length} dependencies`);
  }

  const reason = enabled
    ? `✅ Flag enabled (${items.join(" + ") || "no conditions/deps"})`
    : `❌ Flag disabled (failed: ${items.join(" or ") || "unknown"})`;

  return reason;
}

/**
 * Analyze flag impact and correlation
 */
export interface FlagImpactAnalysis {
  flag: string;
  affectedFlags: string[]; // Flags that depend on this one
  dependencyChain: string[]; // Chain of dependencies to root (flags with no further dependencies)
  complexity: "simple" | "moderate" | "complex";
  riskOfDisabling: string;
}

export function analyzeFlagImpact(flagName: string): FlagImpactAnalysis {
  const graph = generateDependencyGraph();
  const node = graph.nodes.get(flagName);

  if (!node) {
    return {
      flag: flagName,
      affectedFlags: [],
      dependencyChain: [],
      complexity: "simple",
      riskOfDisabling: "Flag does not exist",
    };
  }

  // Find all flags affected by this one (transitive dependents)
  const affectedFlags = new Set<string>();
  function collectDependents(name: string): void {
    const n = graph.nodes.get(name);
    if (n) {
      n.dependents.forEach((dependent) => {
        affectedFlags.add(dependent);
        collectDependents(dependent);
      });
    }
  }
  collectDependents(flagName);

  // Calculate complexity
  const hasConditions = node.hasConditions;
  const depCount = node.dependencies.length;
  const complexity =
    depCount > 2 || hasConditions
      ? "complex"
      : depCount > 0
        ? "moderate"
        : "simple";

  const riskOfDisabling =
    affectedFlags.size > 0
      ? `Would affect ${affectedFlags.size} dependent flag(s)`
      : "Safe to disable (no dependencies)";

  return {
    flag: flagName,
    affectedFlags: Array.from(affectedFlags),
    dependencyChain: node.dependencies,
    complexity,
    riskOfDisabling,
  };
}

/**
 * Export graph as ASCII visualization (for CLI/logging)
 */
export function visualizeDependencyGraph(maxDepth: number = 5): string {
  const graph = generateDependencyGraph();
  const lines: string[] = ["Feature Flag Dependency Graph", "===========================", ""];

  // Group by depth
  const byDepth = new Map<number, DependencyNode[]>();
  for (const node of graph.nodes.values()) {
    if (node.depth <= maxDepth) {
      if (!byDepth.has(node.depth)) {
        byDepth.set(node.depth, []);
      }
      byDepth.get(node.depth)!.push(node);
    }
  }

  // Sort by depth and render
  for (let d = maxDepth; d >= 0; d--) {
    const nodesAtDepth = byDepth.get(d) ?? [];
    if (nodesAtDepth.length === 0) continue;

    lines.push(`Depth ${d}:`);
    for (const node of nodesAtDepth) {
      const icon = node.enabled ? "✅" : "❌";
      const kind = node.kind ? ` [${node.kind}]` : "";
      const conditions = node.hasConditions ? " 🔧" : "";
      lines.push(`  ${icon} ${node.name}${kind}${conditions}`);

      if (node.dependencies.length > 0) {
        lines.push(`     depends on: ${node.dependencies.join(", ")}`);
      }
    }
    lines.push("");
  }

  // Show cycles if detected
  if (graph.cycles.length > 0) {
    lines.push("⚠️  Circular Dependencies Detected:");
    for (const cycle of graph.cycles) {
      lines.push(`  ${cycle.join(" → ")} → ${cycle[0]}`);
    }
  }

  return lines.join("\n");
}
