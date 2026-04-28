/**
 * Email Link Entry System
 *
 * Centralizes URL-param-driven auth entry in pure lib code (no React).
 * Processes email links from Supabase redirects (signup-confirm, password-reset, world-invite).
 *
 * Usage (from hooks/auth/use-auth-link-observer.ts):
 *   const result = await processEmailLinkEntry({
 *     action: 'world-invite',
 *     token: inviteToken,
 *     worldName: 'Tavern',
 *     hashFragment: window.location.hash
 *   });
 *   if (result.requiresInviteSignInModal) {
 *     // Hook shows modal and saves token to pendingInviteStorage
 *   } else if (result.redirect) {
 *     // Hook navigates to result.redirect
 *   }
 */

import { AuthStateManager, getCurrentSession, restoreSession } from '@/lib/auth';
import { processInviteForUser } from '@/lib/auth/account/invite-system';
import { logger } from '@/lib/utils/logger';
import type { EmailLinkParams, EmailLinkResult } from '@/type-definitions/auth-types';

/**
 * Modal UX Reference (from deleted auth-redirect.tsx)
 * These outcomes are wired by use-auth-link-observer.ts via NavModal:
 *
 * | Modal | Trigger | Heading | Body | Button | Action |
 * |-------|---------|---------|------|--------|--------|
 * | Welcome | `signup-confirm` success | "Welcome to DnD Toolkit!" | Account confirmed. Ready to start. | "Get started" | → `/select/world-selection` |
 * | Invite (logged out) | `world-invite`, no session | "You're invited to [worldName]!" | You have been invited to join. Sign in or create an account to accept. | "Accept later" | → `/` (pending invite stays saved; user signs in normally) |
 * | | | | | "Decline invite" | clear pending invite → `/` |
 * | Already member | `world-invite`, already member | "You're already a member!" | You already belong to this world. | "Go to my worlds" | → `/select/world-selection` |
 * | Error | Any failure | "Something went wrong." | This link may be invalid or expired. | "Back to home" | → `/` |
 *
 * // TODO(auth-refactor): wire these NavModal outcomes
 */

/**
 * Process an email link entry point.
 * Handles token restoration, session checks, and routing decisions.
 *
 * @param params - URL parameters extracted from the email link
 * @returns Result indicating navigation/modal outcome or error
 */
export async function processEmailLinkEntry(params: EmailLinkParams): Promise<EmailLinkResult> {
  try {
    const { action, token, worldName, hashFragment } = params;

    logger.category('auth').debug('Processing email link entry', { action });

    // Phase 1: Hash token extraction (web, signup-confirm / reset-password paths)
    let hasValidSession = false;

    if (hashFragment) {
      const hashParams = new URLSearchParams(hashFragment.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');

      if (accessToken && refreshToken) {
        logger.category('auth').debug('Restoring session from email link tokens...');

        const restored = await restoreSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (!restored) {
          logger.category('auth').error('Session restoration failed from email link');
          return {
            success: false,
            error: 'Invalid or expired link. Please try again.',
          };
        }

        logger.category('auth').info('Session restored from email link');
        await AuthStateManager.setHasAccount(true);
        hasValidSession = true;
      }
    }

    // Phase 2: Existing session check (direct visit with no hash tokens)
    if (!hasValidSession) {
      const session = await getCurrentSession();
      hasValidSession = !!session;
    }

    // Phase 3: Action dispatch
    // If we established a session but no explicit action provided, it's likely a direct visit
    if (!action && hasValidSession) {
      logger.category('auth').debug('No action provided but user has session; redirecting to world selection');
      return {
        success: true,
        redirect: '/select/world-selection',
      };
    }

    // Route based on action
    switch (action) {
      case 'signup-confirm':
        // User confirmed email from signup -> go to complete profile
        logger.category('auth').debug('Processing signup-confirm action');
        return {
          success: true,
          redirect: '/login/complete-profile',
        };

      case 'reset-password':
        // User clicked password reset link -> go to reset password page
        logger.category('auth').debug('Processing reset-password action');
        return {
          success: true,
          redirect: '/login/reset-password',
        };

      case 'world-invite':
        // Phase 4: handleWorldInvite sub-function
        return await handleWorldInvite(hasValidSession, token, worldName);

      default:
        // No explicit action, no session -> go home
        if (!hasValidSession) {
          logger.category('auth').debug('No action, no session; redirecting to home');
          return {
            success: true,
            redirect: '/',
          };
        }

        // Action undefined but session exists -> already handled above
        logger.category('auth').debug('Unexpected state: no action but session exists');
        return {
          success: true,
          redirect: '/',
        };
    }
  } catch (error) {
    logger.category('auth').error('Email link entry error', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    return {
      success: false,
      error: 'Something went wrong. Please try again.',
    };
  }
}

/**
 * Handle world invite from link.
 * Differentiates between logged-in vs logged-out users.
 *
 * @param hasValidSession - Whether user has an active session
 * @param inviteToken - The invite token from URL
 * @param inviteWorldName - The world name from URL (URL-encoded)
 * @returns Result with modal signal (logged-out) or redirect (logged-in)
 */
async function handleWorldInvite(
  hasValidSession: boolean,
  inviteToken?: string,
  inviteWorldName?: string,
): Promise<EmailLinkResult> {
  logger.category('auth').debug('Processing world invite', {
    hasValidSession,
    worldName: inviteWorldName,
  });

  if (!inviteToken || !inviteWorldName) {
    return {
      success: false,
      error: 'Invalid invite link. Please ask for a new invitation.',
    };
  }

  const decodedWorldName = decodeURIComponent(inviteWorldName);

  if (!hasValidSession) {
    // User not logged in - signal hook to save pending invite and show modal
    logger.category('auth').debug('User not logged in; returning invite modal signal');
    return {
      success: true,
      requiresInviteSignInModal: true,
      inviteWorldName: decodedWorldName,
      // Note: token is NOT included here; hook uses original URL params to save it
    };
  }

  // User is logged in - process invite immediately
  logger.category('auth').info('User logged in, processing invite...');

  try {
    const result = await processInviteForUser(inviteToken);

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to join world. Please try again.',
      };
    }

    // Check if user was already a member
    if (result.alreadyMember) {
      logger.category('auth').info('User already a member of this world');
      return {
        success: true,
        redirect: '/select/world-selection',
        // Note: worlds synced by performFullSync, no manual preload needed
      };
    }

    // User successfully added to world
    logger.category('auth').info('User successfully added to world');
    return {
      success: true,
      redirect: '/select/world-selection',
      // Note: worlds synced by performFullSync, no manual preload needed
    };
  } catch (error) {
    logger.category('auth').error('Failed to add user to world', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
    });

    // Check if it's a duplicate/already member error
    if (error instanceof Error && error.message.includes('duplicate')) {
      logger.category('auth').info('User already in world (duplicate key)');
      return {
        success: true,
        redirect: '/select/world-selection',
      };
    }

    return {
      success: false,
      error: 'Failed to join world. Please try again or contact the world owner.',
    };
  }
}
