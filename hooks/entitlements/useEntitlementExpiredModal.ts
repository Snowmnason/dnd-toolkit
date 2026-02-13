/**
 * Hook: useEntitlementExpiredModal
 *
 * Manages visibility and interactions for the entitlement expired modal.
 * Simple state management for showing/hiding the modal.
 *
 * Future: Check for expired entitlements and auto-show the modal.
 */

import { useCallback, useState } from 'react';

export interface UseEntitlementExpiredModalReturn {
  isVisible: boolean;
  entitlementName: string;
  show: (name?: string) => void;
  hide: () => void;
  setEntitlementName: (name: string) => void;
}

export function useEntitlementExpiredModal(): UseEntitlementExpiredModalReturn {
  const [isVisible, setIsVisible] = useState(false);
  const [entitlementName, setEntitlementName] = useState('Entitlement');

  const show = useCallback((name?: string) => {
    if (name) setEntitlementName(name);
    setIsVisible(true);
  }, []);

  const hide = useCallback(() => {
    setIsVisible(false);
  }, []);

  return {
    isVisible,
    entitlementName,
    show,
    hide,
    setEntitlementName,
  };
}

