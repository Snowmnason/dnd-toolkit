/**
 * Hook: useEntitlementExpiredModal
 *
 * Manages visibility and interactions for the entitlement expired modal.
 * Uses centralized modal context to open/close the modal via registry.
 *
 * Future: Check for expired entitlements and auto-show the modal.
 */

import { useModal } from '@/contexts';
import { useCallback } from 'react';

export interface UseEntitlementExpiredModalReturn {
  show: (name?: string) => void;
  hide: () => void;
}

export function useEntitlementExpiredModal(): UseEntitlementExpiredModalReturn {
  const { openModal, closeModal } = useModal();

  const show = useCallback((entitlementName: string = 'Entitlement') => {
    openModal('entitlement-expired', { entitlementName });
  }, [openModal]);

  const hide = useCallback(() => {
    closeModal();
  }, [closeModal]);

  return {
    show,
    hide,
  };
}

