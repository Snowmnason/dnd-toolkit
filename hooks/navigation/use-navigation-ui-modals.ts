import { useCallback } from 'react';

import { useModal } from '@/contexts';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NavModalResponseType = 'failure' | 'success' | 'warning' | 'general';

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useNavigationUiModals
 *
 * Thin adapter between navigation hooks and the centralized modal context.
 * Used exclusively by `useNavigation` — not for direct screen use.
 *
 * Delegates all state and rendering to `ModalProvider`/`ModalLayer` via `openModal()`.
 * Both modals are registered in `register-all-modals.ts` and rendered by `ModalLayer` — no
 * changes to the root layout are needed.
 *
 * **Manages:**
 * 1. **NavModal** (`'nav-alert'`) — Navigation outcome modal (failure, success, warning, general)
 * 2. **TrustedUrlConsentModal** (`'trusted-url-consent'`) — External link consent
 *
 * **Does NOT:**
 * - Hold any local React state (ModalProvider owns visibility)
 * - Render anything itself
 * - Call navManager or any lib function
 */
export function useNavigationUiModals() {
  const { openModal, closeModal } = useModal();

  // ---- NavModal controls ----

  /**
   * Open the NavModal with the given type and optional content.
   * Action callbacks are resolved by useNavigation and passed in.
   */
  const showNavModal = useCallback(
    (
      modalResponseType: NavModalResponseType,
      heading?: string,
      body?: string,
      canGoBack?: boolean,
      primaryAction?: () => void,
      secondaryAction?: () => void,
    ) => {
      openModal('nav-alert', {
        modalResponseType,
        heading,
        body,
        canGoBack,
        onClose: closeModal,
        primaryAction: primaryAction ?? closeModal,
        secondaryAction,
      });
    },
    [openModal, closeModal],
  );

  const dismissNavModal = useCallback(() => closeModal(), [closeModal]);

  // ---- TrustModal controls ----

  /**
   * Open the TrustedUrlConsentModal for an untrusted external URL.
   * Derives hostname from the URL automatically.
   * Action callbacks are provided by the caller and responsible for closing the modal.
   *
   * @param url           - The full URL awaiting user consent
   * @param onDismiss     - Called when user cancels (must close modal)
   * @param onOpenAnyway  - Called for one-time open without trust (must close modal)
   * @param onTrustAndOpen - Called to persist trust and open (must close modal)
   */
  const showTrustModal = useCallback(
    (
      url: string,
      onDismiss: () => void,
      onOpenAnyway: () => void,
      onTrustAndOpen: () => void,
    ) => {
      let hostname = url;
      try {
        hostname = new URL(url).hostname;
      } catch {
        // Malformed URL — navManager already validated the scheme, use full url as display fallback
      }
      openModal('trusted-url-consent', {
        url,
        hostname,
        onDismiss,
        onOpenAnyway,
        onTrustAndOpen,
      });
    },
    [openModal],
  );

  const dismissTrustModal = useCallback(() => closeModal(), [closeModal]);

  return { showNavModal, dismissNavModal, showTrustModal, dismissTrustModal };
}
