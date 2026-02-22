/**
 * Centralized PII/Sensitive Data Redaction Manager
 *
 * Provides comprehensive field-level and string-based PII/token redaction for zero-trust data handling.
 * Used across modules (offline queue, analytics, logs, etc.) to ensure no sensitive information
 * is persisted, logged, or transmitted.
 *
 * Features:
 * - Object field redaction: Deterministic rules for structured data (emails, tokens, passwords, etc.)
 * - String pattern redaction: Regex-based redaction for unstructured text and logs
 * - Circular reference handling: Prevents infinite loops in nested objects
 * - Custom rule support: Extend with application-specific PII patterns
 * - Validation: Detect remaining sensitive fields after redaction
 */

// ============================================================================
// PII Pattern Constants (for string-based redaction)
// ============================================================================

/**
 * Patterns for detecting PII preceded by field names.
 * Used as primary pattern - catches field: value formats.
 */
export const PREFIXED_PII_PATTERNS = [
  // Email: email="...", email: ..., email:..., email=...
  /\bemail["\s:=]+(["\']?[\w\.\-\+]+@[\w\.\-]+\.\w+)/gi,

  // Token (JWT, API, session): token="...", JWT tokens contain uppercase, hyphens, underscores, dots
  /\b(token|jwt|authorization)["\s:=]+(["\']?[A-Za-z0-9_\-\.]+)/gi,

  // Session ID: session="...", session: ...
  /\bsession["\s:=]+(["\']?[a-zA-Z0-9\-_\.]+)/gi,

  // User ID: userid="...", userId: ..., user_id=...
  /\b(userid|user_id|uid)["\s:=]+(["\']?[a-zA-Z0-9\-_\.]+)/gi,

  // UUID: id="..." (only if looks like UUID - 36 chars with hyphens)
  /\bid["\s:=]+(["\']?[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/gi,

  // API Key: apikey="...", api_key: ..., key: ... (in API contexts)
  /\b(apikey|api_key)["\s:=]+(["\']?[A-Za-z0-9_\-\.]+)/gi,

  // Phone number: phone="...", tel: ... (+1-555-123-4567 or (555)123-4567)
  /\b(phone|tel|telephone)["\s:=]+(["\']?[\+\d\-\(\)\s]{10,15})/gi,

  // URL parameters with sensitive values: ?email=..., ?token=..., ?key=...
  /[?&](email|token|jwt|apikey|api_key|session|userid|user_id)=([A-Za-z0-9%_\-\.@]+)/gi,
] as const;

/**
 * Standalone patterns for detecting PII without field name prefix.
 * Used as fallback - catches bare values in error messages, logs, etc.
 *
 * More conservative to avoid false positives on benign strings.
 */
export const STANDALONE_PII_PATTERNS = [
  // Email format: user@domain.com (but not URLs)
  // Negative lookbehind for protocol to avoid matching URLs
  /(?<!:\/\/)(?<!\w)[\w\.\-\+]+@[\w\.\-]+\.\w{2,}/gi,

  // JWT format: eyJhbGc... (starts with ey, contains dots)
  /\bey[A-Za-z0-9_\-\.]+\.[A-Za-z0-9_\-\.]+\.[A-Za-z0-9_\-\.]+/gi,

  // UUID: 8-4-4-4-12 hex format (strict)
  /\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/gi,

  // API Key patterns: long alphanumeric strings (32+ chars, common for keys)
  // Only match if it's clearly a key (surrounded by delimiters, not in normal text)
  /\b([A-Za-z0-9_\-\.]{32,})\b(?=["\'\s,\)\]\}]|$)/gi,
] as const;

/**
 * Combined pattern array - all patterns to apply in order.
 * Prefixed patterns first (more specific), then fallback to standalone.
 */
export const ALL_PII_PATTERNS = [
  ...PREFIXED_PII_PATTERNS,
  ...STANDALONE_PII_PATTERNS,
] as const;

// ============================================================================
// Object Field Redaction
// ============================================================================

/**
 * Redaction rule for sensitive fields
 */
export interface RedactionRule {
  /** Field names to redact (case-insensitive matching) */
  fields: string[];
  /** If true, redact entire parent object when field matches */
  redactParent?: boolean;
  /** Replacement value (default: undefined to delete field) */
  replacement?: string | null;
}

/**
 * Interface for the RedactionManager
 */
export interface IRedactionManager {
  defaultRules: RedactionRule[];
  shouldRedact(fieldPath: string, rules: RedactionRule[]): boolean;
  findMatchingRule(
    fieldPath: string,
    rules: RedactionRule[],
  ): RedactionRule | undefined;
  redactObject(
    obj: Record<string, any>,
    rules?: RedactionRule[],
    path?: string,
  ): Record<string, any> | undefined;
  _redactObjectImpl(
    obj: Record<string, any>,
    rules?: RedactionRule[],
    path?: string,
    visited?: Set<any>,
  ): Record<string, any> | undefined;
  validateRedaction(
    obj: Record<string, any>,
    forbiddenFields?: string[],
  ): string[];
}

/**
 * Centralized PII/Redaction Manager instance
 *
 * Implements deterministic PII/token redaction for zero-trust data handling.
 */
export const RedactionManager: IRedactionManager = {
  /**
   * Standard redaction rules for common sensitive fields
   */
  defaultRules: [
    // Authorization headers and tokens
    { fields: ['authorization', 'auth', 'token', 'refreshToken', 'idToken'] },
    // Session/identity
    { fields: ['password', 'secret', 'privateKey', 'api_key', 'apiKey'] },
    // Personal identifiable information
    { fields: ['email', 'phone', 'ssn', 'creditCard', 'bankAccount'] },
    // OAuth tokens
    { fields: ['access_token', 'refresh_token', 'oauth_token'] },
  ] as RedactionRule[],

  /**
   * Check if a field path should be redacted based on rules
   *
   * @param fieldPath - Dot-separated path (e.g., "user.email", "password")
   * @param rules - Redaction rules to apply
   * @returns true if field should be redacted
   */
  shouldRedact(fieldPath: string, rules: RedactionRule[]): boolean {
    const normalizedPath = fieldPath.toLowerCase();
    return rules.some((rule) =>
      rule.fields.some((field) => {
        const normalizedField = field.toLowerCase();
        // Match exact field or path segment
        return (
          normalizedPath === normalizedField ||
          normalizedPath.endsWith(`.${normalizedField}`) ||
          normalizedPath.startsWith(`${normalizedField}.`)
        );
      }),
    );
  },

  /**
   * Find the matching rule for a field path using the same logic as shouldRedact
   * Reuses path-matching logic (exact, suffix, prefix) to ensure consistency
   *
   * @param fieldPath - Path to match
   * @param rules - Rules to search
   * @returns The first matching rule, or undefined if no match
   */
  findMatchingRule(
    fieldPath: string,
    rules: RedactionRule[],
  ): RedactionRule | undefined {
    const normalizedPath = fieldPath.toLowerCase();
    return rules.find((rule) =>
      rule.fields.some((field) => {
        const normalizedField = field.toLowerCase();
        // Match exact field or path segment (same as shouldRedact)
        return (
          normalizedPath === normalizedField ||
          normalizedPath.endsWith(`.${normalizedField}`) ||
          normalizedPath.startsWith(`${normalizedField}.`)
        );
      }),
    );
  },

  /**
   * Recursively redact sensitive fields from an object
   *
   * @param obj - Object to redact
   * @param rules - Redaction rules
   * @param path - Current path (used internally for recursion)
   * @param visited - Set of visited objects to prevent circular references
   * @returns Redacted copy of object
   */
  redactObject(
    obj: Record<string, any>,
    rules: RedactionRule[] = RedactionManager.defaultRules,
    path: string = '',
  ): Record<string, any> | undefined {
    // Use internal implementation with circular reference tracking
    return this._redactObjectImpl(obj, rules, path, new Set());
  },

  /**
   * Internal implementation that tracks visited objects
   * @internal
   */
  _redactObjectImpl(
    obj: Record<string, any>,
    rules: RedactionRule[] = RedactionManager.defaultRules,
    path: string = '',
    visited: Set<any> = new Set(),
  ): Record<string, any> | undefined {
    // Prevent circular references
    if (visited.has(obj)) {
      return undefined; // Break circular reference
    }
    visited.add(obj);

    try {
      // Check if any field in this object matches a rule with redactParent
      // Only apply to nested objects (path is not empty)
      if (path) {
        const matchingRule = RedactionManager.findMatchingRule(path, rules);
        if (matchingRule?.redactParent) {
          return undefined; // Redact entire object
        }
      }

      const redacted: Record<string, any> = {};

      for (const [key, value] of Object.entries(obj)) {
        const fieldPath = path ? `${path}.${key}` : key;

        // Skip redacted fields
        if (RedactionManager.shouldRedact(fieldPath, rules)) {
          continue;
        }

        // Recursively redact nested objects
        if (value !== null && typeof value === 'object') {
          if (Array.isArray(value)) {
            // eslint-disable-next-line security/detect-object-injection
            redacted[key] = value
              .map((item) => {
                if (item !== null && typeof item === 'object') {
                  return RedactionManager._redactObjectImpl(
                    item,
                    rules,
                    fieldPath,
                    visited,
                  );
                }
                return item;
              })
              .filter((item) => item !== undefined);
          } else {
            const nestedRedacted = RedactionManager._redactObjectImpl(
              value,
              rules,
              fieldPath,
              visited,
            );
            if (nestedRedacted !== undefined) {
              // eslint-disable-next-line security/detect-object-injection
              redacted[key] = nestedRedacted;
            }
          }
        } else {
          // eslint-disable-next-line security/detect-object-injection
          redacted[key] = value;
        }
      }

      return redacted;
    } finally {
      visited.delete(obj);
    }
  },

  /**
   * Validate that no sensitive fields remain in object
   * Used in tests to ensure redaction worked
   *
   * @param obj - Object to check
   * @param forbiddenFields - Fields that should not exist
   * @returns Array of found forbidden fields (empty if clean)
   */
  validateRedaction(
    obj: Record<string, any>,
    forbiddenFields: string[] = [
      'token',
      'password',
      'authorization',
      'email',
      'phone',
    ],
  ): string[] {
    const found: string[] = [];

    const checkObject = (current: any, path: string = ''): void => {
      if (current === null || typeof current !== 'object') {
        return;
      }

      for (const [key, value] of Object.entries(current)) {
        const fieldPath = path ? `${path}.${key}` : key;
        const normalizedKey = key.toLowerCase();

        // Check if key matches forbidden field
        if (forbiddenFields.some((field) => normalizedKey.includes(field.toLowerCase()))) {
          found.push(fieldPath);
        }

        // Recurse into nested objects
        if (value !== null && typeof value === 'object') {
          if (Array.isArray(value)) {
            value.forEach((item) => {
              if (typeof item === 'object') {
                checkObject(item, fieldPath);
              }
            });
          } else {
            checkObject(value, fieldPath);
          }
        }
      }
    };

    checkObject(obj);
    return found;
  },
};

/**
 * Helper to create custom redaction strategies
 *
 * @param customRules - Additional rules to apply alongside defaults
 * @returns Redaction function with merged rules
 */
export function createCustomRedactor(customRules: RedactionRule[]) {
  return (obj: Record<string, any>) =>
    RedactionManager.redactObject(obj, [
      ...RedactionManager.defaultRules,
      ...customRules,
    ]);
}

// ============================================================================
// String Pattern-Based PII Redaction
// ============================================================================

/**
 * Redact PII from a string value using regex patterns.
 *
 * Covers both prefixed patterns (field: value formats) and standalone patterns
 * (bare values in error messages, logs, etc.).
 *
 * @param value - String or object to redact
 * @param options - Redaction options
 * @returns Redacted string with PII replaced by [REDACTED]
 *
 * @example
 * ```ts
 * redactPII("email: user@example.com") // "email: [REDACTED]"
 * redactPII("user@example.com") // "[REDACTED]"
 * redactPII({ token: "eyJhbG..." }) // "{\"token\": \"[REDACTED]\"}"
 * ```
 */
export function redactPII(
  value: unknown,
  options?: { includeStandalone?: boolean },
): string {
  if (value === null || value === undefined) return "";

  let str = typeof value === "string" ? value : JSON.stringify(value);
  const { includeStandalone = true } = options || {};

  // Always apply prefixed patterns (field-specific)
  for (const pattern of PREFIXED_PII_PATTERNS) {
    str = str.replace(pattern, "[REDACTED]");
  }

  // Apply standalone patterns if enabled (more aggressive, may catch false positives)
  if (includeStandalone) {
    for (const pattern of STANDALONE_PII_PATTERNS) {
      str = str.replace(pattern, "[REDACTED]");
    }
  }

  return str;
}

/**
 * Check if a string appears to contain PII (for debugging/auditing).
 *
 * @param value - String to check
 * @returns true if any PII pattern matches
 */
export function containsPII(value: string): boolean {
  if (typeof value !== "string") return false;

  for (const pattern of ALL_PII_PATTERNS) {
    if (pattern.test(value)) {
      return true;
    }
  }

  return false;
}
