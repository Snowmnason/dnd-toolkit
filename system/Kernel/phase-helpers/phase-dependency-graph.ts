/**
 * Phase Dependency Graph
 *
 * Defines explicit dependencies between kernel phases and validates
 * that phases run in correct order. Enables strong data flow:
 * - config → independent phases (preload, network, storage)
 * - network → services
 * - network + services → auth
 * - storage + preload → jobSetup
 * - all above → featureFlags
 *
 * Sequential execution with dependency enforcement prevents:
 * - Running auth before network is initialized
 * - Running services before network type is detected
 * - Running dependent phases before their requirements complete
 */

export type PhaseName =
  | "config"
  | "preload"
  | "network"
  | "storage"
  | "services"
  | "jobSetup"
  | "auth"
  | "featureFlags"
  | "registration";

/**
 * Phase dependency map: each phase lists its required predecessor phases
 * Phases with no dependencies can run after config
 * Sequential execution: each phase waits for all dependencies to complete
 */
export const PHASE_DEPENDENCIES = new Map<PhaseName, PhaseName[]>([
  ["config", []],
  ["preload", []],
  ["network", []],
  ["storage", []],
  ["services", ["network"]],
  ["jobSetup", ["storage", "preload"]],
  ["auth", ["network", "services"]],
  ["featureFlags", ["network", "storage", "services", "jobSetup", "auth"]],
  ["registration", ["services", "jobSetup", "auth", "featureFlags"]],
]);

/**
 * Check if a phase can run given the set of completed phases
 *
 * @param phaseName The phase to check
 * @param completedPhases Set of phases that have already completed
 * @returns true if all dependencies are satisfied, false otherwise
 *
 * @example
 * const completed = new Set(['config', 'network']);
 * canRunPhase('services', completed); // true (network is done)
 * canRunPhase('auth', completed); // false (services not done yet)
 */
export function canRunPhase(
  phaseName: PhaseName,
  completedPhases: Set<PhaseName>
): boolean {
  const deps = PHASE_DEPENDENCIES.get(phaseName) || [];
  return deps.every((dep) => completedPhases.has(dep));
}

/**
 * Get ordered list of phases respecting dependencies
 * Returns phases in execution order: config first, then others respecting dependencies
 *
 * @param phases Subset of phases to order (e.g., for testing specific paths)
 * @returns Phases in topologically sorted order
 */
export function getPhaseExecutionOrder(
  phases: PhaseName[] = Array.from(PHASE_DEPENDENCIES.keys())
): PhaseName[] {
  const order: PhaseName[] = [];
  const remaining = new Set(phases);
  const completed = new Set<PhaseName>();

  // Repeatedly find and add phases whose dependencies are met
  while (remaining.size > 0) {
    let foundPhase: PhaseName | null = null;

    for (const phase of remaining) {
      if (canRunPhase(phase, completed)) {
        foundPhase = phase;
        break;
      }
    }

    if (!foundPhase) {
      // Circular dependency or missing dependency
      throw new Error(
        `Cannot resolve phase order. Remaining: ${Array.from(remaining).join(", ")}`
      );
    }

    order.push(foundPhase);
    completed.add(foundPhase);
    remaining.delete(foundPhase);
  }

  return order;
}

/**
 * Check if a phase is non-recoverable (failure should crash app)
 * These phases represent core app functionality
 *
 * @param phaseName The phase to check
 * @returns true if phase failure is non-recoverable, false if can be skipped
 */
export function isNonRecoverablePhase(phaseName: PhaseName): boolean {
  const nonRecoverable: Set<PhaseName> = new Set([
    "config", // App config is foundational
    "storage", // Storage init failure prevents safe state
    "preload", // Preload failure prevents UI rendering
    "jobSetup", // Job infrastructure is critical
  ]);

  return nonRecoverable.has(phaseName);
}

/**
 * Get phases that can be conditionally skipped
 * These phases can fail without crashing the app if properly degraded
 *
 * @returns Set of phases that support graceful degradation
 */
export function getSkippablePhases(): Set<PhaseName> {
  return new Set<PhaseName>([
    "network", // Can enter offline mode
    "services", // Can degrade to offline behavior
    "auth", // Can use local auth state
    "featureFlags", // Can use hardcoded fallback flags
    "registration", // Can signal missing registrations, continue startup
  ]);
}

/**
 * Validate that dependencies are consistent and acyclic
 * Throws if circular dependency or invalid phase reference found
 *
 * @returns true if valid
 * @throws Error if validation fails
 */
export function validatePhaseGraph(): boolean {
  // Check for circular dependencies using DFS
  const visited = new Set<PhaseName>();
  const recursionStack = new Set<PhaseName>();

  function hasCycle(phase: PhaseName): boolean {
    visited.add(phase);
    recursionStack.add(phase);

    const deps = PHASE_DEPENDENCIES.get(phase) || [];
    for (const dep of deps) {
      if (!visited.has(dep)) {
        if (hasCycle(dep)) {
          return true;
        }
      } else if (recursionStack.has(dep)) {
        return true; // Back edge found = cycle
      }
    }

    recursionStack.delete(phase);
    return false;
  }

  // Check all phases
  const allPhases = Array.from(PHASE_DEPENDENCIES.keys());
  for (const phase of allPhases) {
    if (!visited.has(phase)) {
      if (hasCycle(phase)) {
        throw new Error(`Circular dependency detected in phase: ${phase}`);
      }
    }
  }

  // Check that all referenced phases exist
  for (const [phase, deps] of PHASE_DEPENDENCIES.entries()) {
    for (const dep of deps) {
      if (!PHASE_DEPENDENCIES.has(dep)) {
        throw new Error(
          `Phase "${phase}" depends on non-existent phase "${dep}"`
        );
      }
    }
  }

  return true;
}
