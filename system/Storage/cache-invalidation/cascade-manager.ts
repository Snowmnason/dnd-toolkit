import { logger } from '@/lib/utils/logger';

/**
 * Represents a registered cascade dependency mapping.
 */
export interface CascadeMapping {
  parentPattern: string;
  childPatterns: string[];
}

/**
 * Manages parent-child cache key dependency relationships.
 * Allows registration of cascade patterns and querying dependencies for invalidation.
 */
class CascadeManagerImpl {
  private cascades: Map<string, string[]> = new Map();

  /**
   * Register a parent-child cascade relationship.
   * Parent pattern invalidation will cascade to all child patterns.
   * Supports glob patterns: `world:*` matches `world:123`, `members:world:*` matches `members:world:123`
   *
   * @param parentPattern - The parent cache key pattern (glob supported)
   * @param childPatterns - Array of child cache key patterns to invalidate
   * @throws Error if circular dependency detected
   */
  registerCascade(parentPattern: string, childPatterns: string[]): void {
    // Check for circular dependencies
    this.detectCircularDependency(parentPattern, childPatterns);

    // Store the cascade mapping
    this.cascades.set(parentPattern, childPatterns);

    logger.category('storage').debug('Cascade registered', {
      parentPattern,
      childPatterns,
      totalCascades: this.cascades.size,
    });
  }

  /**
   * Get all child patterns that should be invalidated when a key is invalidated.
   * Matches the key against all registered parent patterns using glob matching.
   *
   * @param key - The cache key being invalidated
   * @returns Array of child patterns that match this key
   */
  getCascadeDependencies(key: string): string[] {
    const dependencies: string[] = [];

    for (const [parentPattern, childPatterns] of this.cascades) {
      if (this.matchesPattern(key, parentPattern)) {
        dependencies.push(...childPatterns);
      }
    }

    return dependencies;
  }

  /**
   * Get all registered cascades (for debugging/monitoring).
   * @returns Array of all cascade mappings
   */
  getAllCascades(): CascadeMapping[] {
    return Array.from(this.cascades.entries()).map(([parentPattern, childPatterns]) => ({
      parentPattern,
      childPatterns,
    }));
  }

  /**
   * Clear all cascade registrations.
   */
  reset(): void {
    this.cascades.clear();
    logger.category('storage').debug('All cascades reset');
  }

  /**
   * Detect if registering this cascade would create a circular dependency.
   * Throws Error if cycle detected.
   * @private
   */
  private detectCircularDependency(parentPattern: string, newChildPatterns: string[]): void {
    // Build a graph-walk that includes the new edges being added so we can
    // detect cycles that would be introduced by registering the new mapping.
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const getChildren = (pattern: string): string[] => {
      // Include the new child patterns when inspecting the parent we're about to add
      if (pattern === parentPattern) return [...(this.cascades.get(pattern) || []), ...newChildPatterns];
      return this.cascades.get(pattern) || [];
    };

    const hasCycle = (pattern: string): boolean => {
      if (recursionStack.has(pattern)) return true;
      if (visited.has(pattern)) return false;

      visited.add(pattern);
      recursionStack.add(pattern);

      const children = getChildren(pattern);
      for (const child of children) {
        if (hasCycle(child)) return true;
      }

      recursionStack.delete(pattern);
      return false;
    };

    // If any of the new children create a path back to the parent, it's a cycle
    for (const childPattern of newChildPatterns) {
      if (hasCycle(childPattern)) {
        throw new Error(`Circular cascade dependency detected: "${childPattern}" → ... → "${parentPattern}"`);
      }
    }
  }

  /**
   * Test if a cache key matches a given pattern.
   * Supports glob patterns: `*` matches any characters, literals match exactly.
   * @private
   */
  private matchesPattern(key: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape regex special chars
      .replace(/\*/g, '.*'); // Convert * to .* for glob matching

    // eslint-disable-next-line security/detect-non-literal-regexp
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(key);
  }
}

/**
 * Singleton instance of the cascade manager.
 */
export const CascadeManager = new CascadeManagerImpl();
