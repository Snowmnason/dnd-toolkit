/**
 * PII Redaction Patterns & Utilities
 *
 * Comprehensive patterns for detecting and redacting personally identifiable information (PII)
 * in logs and error messages. Supports both prefixed fields (e.g., "email: user@example.com")
 * and standalone values (e.g., bare email addresses in error messages).
 *
 * Patterns organized by:
 * 1. Prefixed patterns - Field name + value (e.g., email="user@example.com")
 * 2. Standalone patterns - Values without prefix (e.g., bare email in message)
 * 3. Combined - Both patterns applied in order
 */

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

/**
 * Redact PII from a string value using all available patterns.
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
