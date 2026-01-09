/**
 * URI Helpers for D&D Toolkit Navigation
 * 
 * Provides utilities for:
 * - Case-insensitive route normalization
 * - URL parameter building and preservation
 * - Parameter validation and merging
 * - Deep link parameter extraction
 */

export type RouteParams = Record<string, string | number | boolean | undefined>;

/**
 * Normalize a route path to lowercase for case-insensitive matching
 */
export function normalizePath(path: string): string {
  return path.toLowerCase().trim();
}

/**
 * Build a route with parameters
 * @example buildRoute('/main/characters-npcs', { worldId: '123', tab: 'npcs' })
 * // => '/main/characters-npcs?worldId=123&tab=npcs'
 */
export function buildRoute(path: string, params?: RouteParams): string {
  if (!params || Object.keys(params).length === 0) {
    return path;
  }

  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      queryParams.append(key, String(value));
    }
  });

  const queryString = queryParams.toString();
  return queryString ? `${path}?${queryString}` : path;
}

/**
 * Preserve specific params from current route when navigating
 * @example preserveParams({ worldId: '123', userRole: 'player', tab: 'monsters' }, ['worldId', 'userRole'])
 * // => { worldId: '123', userRole: 'player' }
 */
export function preserveParams(
  currentParams: RouteParams,
  keysToPreserve: string[]
): RouteParams {
  const preserved: RouteParams = Object.create(null);
  keysToPreserve.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(currentParams, key)) {
      // eslint-disable-next-line security/detect-object-injection
      const value = currentParams[key];
      if (value !== undefined) {
        // eslint-disable-next-line security/detect-object-injection
        preserved[key] = value;
      }
    }
  });
  return preserved;
}

/**
 * Merge new params with existing, with new params taking precedence
 * @example mergeParams({ worldId: '123' }, { userRole: 'dm', worldId: '456' })
 * // => { worldId: '456', userRole: 'dm' }
 */
export function mergeParams(
  existingParams: RouteParams,
  newParams: RouteParams
): RouteParams {
  const merged: RouteParams = Object.create(null);

  const assignSafe = (source: RouteParams) => {
    Object.keys(source).forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        // eslint-disable-next-line security/detect-object-injection
        merged[key] = source[key];
      }
    });
  };

  assignSafe(existingParams);
  assignSafe(newParams);

  return merged;
}

/**
 * Check if route params include all required keys
 * @example hasRequiredParams({ worldId: '123' }, ['worldId', 'userRole'])
 * // => false (missing userRole)
 */
export function hasRequiredParams(
  params: RouteParams,
  required: string[]
): boolean {
  return required.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(params, key) &&
      // eslint-disable-next-line security/detect-object-injection
      params[key] !== undefined &&
      // eslint-disable-next-line security/detect-object-injection
      params[key] !== ''
  );
}

/**
 * Validate and sanitize route parameters
 * Returns sanitized params or undefined if validation fails
 */
export function validateParams(
  params: RouteParams,
  schema: {
    required?: string[];
    optional?: string[];
    validators?: Record<string, (value: any) => boolean>;
  }
): RouteParams | undefined {
  const { required = [], optional = [], validators = {} } = schema;

  // Check required params
  if (!hasRequiredParams(params, required)) {
    return undefined;
  }

  // Filter to allowed keys
  const allowedKeys = [...required, ...optional];
  const sanitized: RouteParams = Object.create(null);

  Object.entries(params).forEach(([key, value]) => {
    if (allowedKeys.includes(key) && Object.prototype.hasOwnProperty.call(params, key)) {
      // Run custom validator if present
      // eslint-disable-next-line security/detect-object-injection
      if (validators[key] && !validators[key](value)) {
        return; // Skip invalid param
      }
      // eslint-disable-next-line security/detect-object-injection
      sanitized[key] = value;
    }
  });

  return sanitized;
}

/**
 * Extract params from URL search string
 * @example extractParamsFromUrl('?worldId=123&userRole=dm')
 * // => { worldId: '123', userRole: 'dm' }
 */
export function extractParamsFromUrl(search: string): RouteParams {
  const params: RouteParams = Object.create(null);
  const searchParams = new URLSearchParams(search);

  searchParams.forEach((value, key) => {
    // eslint-disable-next-line security/detect-object-injection
    params[key] = value;
  });

  return params;
}

/**
 * Compare two paths for case-insensitive equality
 */
export function pathEquals(pathA: string, pathB: string): boolean {
  return normalizePath(pathA) === normalizePath(pathB);
}

/**
 * Check if a path starts with a given prefix (case-insensitive)
 */
export function pathStartsWith(path: string, prefix: string): boolean {
  return normalizePath(path).startsWith(normalizePath(prefix));
}

/**
 * Build a navigation target with preserved params
 * Convenience wrapper combining buildRoute and preserveParams
 */
export function buildNavigationTarget(
  targetPath: string,
  currentParams: RouteParams,
  keysToPreserve: string[],
  additionalParams?: RouteParams
): string {
  const preserved = preserveParams(currentParams, keysToPreserve);
  const merged = additionalParams ? mergeParams(preserved, additionalParams) : preserved;
  return buildRoute(targetPath, merged);
}
