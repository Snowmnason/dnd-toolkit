/**
 * Supabase Error Translation Layer
 *
 * Translates provider-specific Supabase error codes (PGRST*, PostgreSQL 23xxx,
 * etc.) into provider-agnostic ERROR_CODES.DATABASE.* and ERROR_CODES.AUTH.*
 * values understood by the rest of the app.
 *
 * Rule: App code must NEVER see raw Supabase codes. All translation happens here.
 */

import { AuthErrorCode, DatabaseErrorCode, ERROR_CODES } from '../../../maps/ERROR_CODES';

// ============================================================================
// DATABASE ERROR TRANSLATION
// ============================================================================

/**
 * Translate a Supabase/PostgreSQL error code + HTTP status to a canonical
 * DATABASE error code.
 *
 * Priority order:
 *  1. HTTP status (most reliable — present for every response)
 *  2. PostgreSQL class codes (23xxx, 42xxx)
 *  3. PostgREST codes (PGRST*)
 *  4. Generic patterns
 *  5. UNKNOWN fallback
 *
 * @example
 * mapSupabaseErrorCode('23505', 409) // DATABASE_UNIQUE_VIOLATION
 * mapSupabaseErrorCode('PGRST116', 408) // DATABASE_TIMEOUT
 * mapSupabaseErrorCode(undefined, 404) // DATABASE_NOT_FOUND
 */
export function mapSupabaseErrorCode(
  code: string | undefined,
  status?: number,
): DatabaseErrorCode {
  // ── HTTP status ────────────────────────────────────────────────────────────
  if (status === 404) return ERROR_CODES.DATABASE.NOT_FOUND;
  if (status === 401 || status === 403) return ERROR_CODES.DATABASE.PERMISSION_DENIED;
  if (status === 409) return ERROR_CODES.DATABASE.CONFLICT;
  if (status === 408 || status === 504) return ERROR_CODES.DATABASE.TIMEOUT;
  if (status === 0) return ERROR_CODES.DATABASE.CONNECTION_FAILED;

  if (!code) {
    if (status && status >= 500) return ERROR_CODES.DATABASE.QUERY_FAILED;
    return ERROR_CODES.DATABASE.UNKNOWN;
  }

  const c = String(code);

  // ── PostgreSQL class codes ────────────────────────────────────────────────
  if (c === '23505') return ERROR_CODES.DATABASE.UNIQUE_VIOLATION;   // unique_violation
  if (c.startsWith('23')) return ERROR_CODES.DATABASE.CONSTRAINT_VIOLATION; // integrity_constraint_violation class
  if (c.startsWith('42')) return ERROR_CODES.DATABASE.SYNTAX_ERROR;  // syntax_error_or_access_rule_violation class
  if (c.startsWith('28')) return ERROR_CODES.DATABASE.PERMISSION_DENIED; // invalid_authorization_specification class

  // ── PostgREST codes ────────────────────────────────────────────────────────
  if (c === 'PGRST116') return ERROR_CODES.DATABASE.TIMEOUT;         // Request timeout
  if (c === 'PGRST301') return ERROR_CODES.DATABASE.PERMISSION_DENIED; // JWT expired
  if (c === 'PGRST302') return ERROR_CODES.DATABASE.PERMISSION_DENIED; // JWT invalid
  if (c.startsWith('PGRST1')) return ERROR_CODES.DATABASE.NOT_FOUND; // PGRST1xx: query/row not found
  if (c.startsWith('PGRST')) return ERROR_CODES.DATABASE.QUERY_FAILED; // remaining PGRST

  // ── Network / connection errors ────────────────────────────────────────────
  if (c === 'NetworkError' || c === 'FetchError') return ERROR_CODES.DATABASE.CONNECTION_FAILED;
  if (c === 'ETIMEDOUT' || c === 'ECONNREFUSED' || c === 'ECONNRESET') {
    return ERROR_CODES.DATABASE.CONNECTION_FAILED;
  }

  // ── Fallback ───────────────────────────────────────────────────────────────
  if (status && status >= 500) return ERROR_CODES.DATABASE.QUERY_FAILED;
  return ERROR_CODES.DATABASE.UNKNOWN;
}

// ============================================================================
// AUTH ERROR TRANSLATION (Supabase GoTrue codes → ERROR_CODES.AUTH.*)
// ============================================================================



/**
 * Translate a Supabase GoTrue auth code to a canonical AUTH error code.
 *
 * @example
 * mapSupabaseAuthCode('invalid_credentials') // AUTH_INVALID_CREDENTIALS
 * mapSupabaseAuthCode('23505')               // AUTH_EMAIL_ALREADY_EXISTS
 * mapSupabaseAuthCode('RATE_LIMIT')          // AUTH_RATE_LIMIT
 */
export function mapSupabaseAuthCode(code: string | undefined): AuthErrorCode {
  if (!code) return ERROR_CODES.AUTH.UNKNOWN;

  switch (code) {
    case 'invalid_credentials':
      return ERROR_CODES.AUTH.INVALID_CREDENTIALS;
    case '23505':
    case 'user_already_exists':
      return ERROR_CODES.AUTH.EMAIL_ALREADY_EXISTS;
    case 'user_not_found':
      return ERROR_CODES.AUTH.USER_NOT_FOUND;
    case 'email_not_confirmed':
    case 'EMAIL_NOT_CONFIRMED':
      return ERROR_CODES.AUTH.EMAIL_NOT_CONFIRMED;
    case 'password_too_short':
    case 'weak_password':
      return ERROR_CODES.AUTH.WEAK_PASSWORD;
    case 'RATE_LIMIT':
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return ERROR_CODES.AUTH.RATE_LIMIT;
    case 'NETWORK_ERROR':
    case 'ETIMEDOUT':
    case 'FetchError':
    case 'NetworkError':
      return ERROR_CODES.AUTH.UNKNOWN; // network failures in auth context map to UNKNOWN
    default:
      return ERROR_CODES.AUTH.UNKNOWN;
  }
}
