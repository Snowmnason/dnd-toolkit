import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useModal } from '@/contexts';
import { processEmailLinkEntry } from '@/lib/auth/account/email-link-system';
import { executeInternalRedirectNavigation } from '@/lib/navigation';
import { logger } from '@/lib/utils/logger';
import type { EmailLinkParams } from '@/type-definitions/auth-types';

import { pendingInviteStorage } from '@/lib/auth/account/invite-system';

/**
 * useAuthLinkObserver
 *
 * ROOT-ONLY EFFECT HOOK: Detects auth-param-bearing URLs and processes email link entry.
 * Mount exactly once in `app/_layout.tsx` at the root level.
 *
 * **Purpose:**
 * Intercepts Supabase email redirect URLs (signup-confirm, reset-password, world-invite)
 * from any route in the app — not just `/login/auth-redirect`.
 *
 * **Fires:**
 * - On initial mount (unlike `useRouteChangeObserver` which skips mount)
 * - On URL param changes
 * - Only when auth-relevant params are detected (`action` param or `access_token` in hash)
 *
 * **Deduplication:**
 * Uses a `useRef` guard keyed on `action|token|worldName|hash` to prevent
 * StrictMode double-execution from re-processing the same entry payload.
 *
 * **Result routing:**
 * - `redirect` → `executeInternalRedirectNavigation` to the target route
 * - `requiresInviteSignInModal` → save pending invite + open NavModal with invite UX
 * - `error` → open NavModal with failure type
 */
export function useAuthLinkObserver(): void {
  const params = useLocalSearchParams();
  const { openModal, closeModal } = useModal();
  const lastProcessedRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const action = params.action as string | undefined;
    const token = params.token as string | undefined;
    const worldName = params.worldName as string | undefined;
    const hashFragment = typeof window !== 'undefined' ? window.location.hash : '';

    // Only fire when auth-relevant params are present
    const hasAuthAction = !!action;
    const hasHashTokens = hashFragment.includes('access_token');
    if (!hasAuthAction && !hasHashTokens) return;

    // Dedup guard: same payload across StrictMode double-run or re-renders
    const key = `${action ?? 'none'}|${token ?? ''}|${worldName ?? ''}|${hashFragment}`;
    if (lastProcessedRef.current === key) {
      logger.category('auth').debug('Auth link observer: duplicate payload, skipping');
      return;
    }
    lastProcessedRef.current = key;

    logger.category('auth').debug('Auth link observer: processing entry', { action });

    const processEntry = async () => {
      const linkParams: EmailLinkParams = {
        action: action as EmailLinkParams['action'],
        token,
        worldName,
        hashFragment,
      };

      const result = await processEmailLinkEntry(linkParams);

      if (result.requiresInviteSignInModal) {
        // Invite was already saved by email-link-system (handleWorldInvite path).
        // Belt-and-suspenders: ensure pending invite is saved before opening modal.
        const decodedWorldName = result.inviteWorldName
          ?? (worldName ? decodeURIComponent(worldName) : undefined);

        if (token && decodedWorldName) {
          await pendingInviteStorage.save(token, decodedWorldName);
        }

        // Use NavModal dynamically — no separate InviteSignInModal component needed.
        // "Accept Later": keeps pending invite in storage, user signs in normally later.
        // "Decline Invite": clears pending invite and returns to home.
        const worldDisplay = decodedWorldName ? `"${decodedWorldName}"` : 'this world';
        openModal('nav-alert', {
          modalResponseType: 'general',
          heading: `You're invited to ${worldDisplay}!`,
          body: 'You have been invited to join. Sign in or create an account to accept.',
          primaryButtonLabel: 'Accept Later',
          secondaryButtonLabel: 'Decline Invite',
          onClose: closeModal,
          primaryAction: () => {
            closeModal();

            ///TODO: FixDuringAuthRefactor 
            // Pending invite stays in storage — user signs in normally and invite is processed
            executeInternalRedirectNavigation('invite-accept-later', 'default').catch(
              err => logger.category('auth').error('Auth link observer: nav failed', { err }),
            );
          },
          secondaryAction: () => {
            pendingInviteStorage.clear().catch(
              err => logger.category('auth').error('Auth link observer: clear invite failed', { err }),
            );
            closeModal();
            executeInternalRedirectNavigation('invite-decline', 'default').catch(
              err => logger.category('auth').error('Auth link observer: nav failed', { err }),
            );
          },
        });
        return;
      }

      if (result.redirect) {
        await executeInternalRedirectNavigation('email-link-entry', result.redirect);
        return;
      }

      if (!result.success && result.error) {
        openModal('nav-alert', {
          modalResponseType: 'failure',
          heading: 'Something went wrong.',
          body: result.error,
          primaryButtonLabel: 'Back to Home',
          onClose: closeModal,
          primaryAction: () => {
            closeModal();
            executeInternalRedirectNavigation('email-link-error', 'default').catch(
              err => logger.category('auth').error('Auth link observer: nav failed', { err }),
            );
          },
        });
      }
    };

    processEntry().catch(error => {
      logger.category('auth').error('Auth link observer: unhandled error', { error });
    });
  }, [params.action, params.token, params.worldName, openModal, closeModal]);
}
