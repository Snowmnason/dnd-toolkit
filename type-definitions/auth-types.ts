/**
 * Auth-specific type definitions
 *
 * Centralized home for auth domain types that can grow during the auth refactor.
 * Examples: session types, profile types, entitlement types.
 *
 * This avoids circular dependencies and keeps auth contracts separate from implementation.
 */

/**
 * Actions triggered by email links (Supabase redirects)
 */
export type EmailLinkAction = 'signup-confirm' | 'reset-password' | 'world-invite' | undefined;

/**
 * Parameters extracted from email link URL
 */
export interface EmailLinkParams {
  /** Action from URL query param: ?action=signup-confirm */
  action: EmailLinkAction;
  /** Invite token from URL query param: ?token=xyz */
  token?: string;
  /** World name from URL query param: ?worldName=Tavern */
  worldName?: string;
  /** Raw window.location.hash for token extraction (web only, pass '' on native) */
  hashFragment?: string;
}

/**
 * Result of processing an email link
 */
export interface EmailLinkResult {
  /** True if processing succeeded (or was handled) */
  success: boolean;
  /** Route to navigate to after processing (undefined if modal is shown instead) */
  redirect?: string;
  /** If true, show the invite sign-in modal instead of redirecting */
  requiresInviteSignInModal?: boolean;
  /** World name for the invite modal display */
  inviteWorldName?: string;
  /** Error message if processing failed */
  error?: string;
}
