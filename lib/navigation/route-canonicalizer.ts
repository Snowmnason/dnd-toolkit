/**
 * Route Canonicalizer
 *
 * Handles:
 * - Path normalization (lowercase, trim slashes, resolve .. segments)
 * - Pattern matching (exact, glob, regex)
 * - Route resolution for case-insensitive lookups
 */

/**
 * Canonicalize a path to a normalized format
 *
 * Transformations:
 * - Convert to lowercase
 * - Trim leading/trailing slashes
 * - Resolve .. segments
 * - Collapse multiple slashes
 *
 * @param input Raw path (e.g., '/Main/World-List', '/select//', '../main')
 * @returns Canonical path (e.g., '/main/world-list')
 */
export function canonicalizePath(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  const path = input.toLowerCase();
  const segments = path.split('/').filter((seg) => seg.length > 0);

  const resolved: string[] = [];
  for (const segment of segments) {
    if (segment === '..') {
      resolved.pop();
    } else if (segment !== '.') {
      resolved.push(segment);
    }
  }

  return '/' + resolved.join('/');
}

/**
 * Match a path against a pattern
 *
 * Supports three match types:
 * - Exact: '/main/world-list' matches '/main/world-list'
 * - Glob: '/main/*' matches '/main/world-list', '/main/settings'
 * - Regex: General expression patterns for advanced matching
 */
export function matchRoute(
  path: string,
  pattern: string | RegExp,
): boolean {
  const canonPath = canonicalizePath(path);

  if (typeof pattern === 'string') {
    if (pattern.includes('*')) {
      const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*');
      // eslint-disable-next-line security/detect-non-literal-regexp -- pattern is sanitized above
      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(canonPath);
    }

    return canonicalizePath(pattern) === canonPath;
  }

  return pattern.test(canonPath);
}

/**
 * Resolve user input to an official route path from a list of known routes
 *
 * @param input User-provided path (may have case variations)
 * @param knownRoutes List of official route paths
 * @returns Matching route path, or undefined
 */
export function resolveRoute(
  input: string,
  knownRoutes: string[],
): string | undefined {
  const canonical = canonicalizePath(input);

  for (const route of knownRoutes) {
    if (canonicalizePath(route) === canonical) {
      return route;
    }
  }

  return undefined;
}
