import React, { createContext, useContext } from 'react';

/**
 * A dropdown entry registered with the portal.
 * `render` is called by the portal to produce the dropdown content.
 * Position tracking is handled internally by the Dropdown component
 * via shared values, so the portal just renders whatever `render()` returns.
 */
export interface DropdownPortalEntry {
  id: string;
  /** Render function — closure over Dropdown state for fresh content each call */
  render: () => React.ReactNode;
  /** Called when the portal detects an outside interaction (native backdrop) */
  onClose: () => void;
}

interface DropdownPortalContextValue {
  /** Register or replace a dropdown entry (auto-closes previous if different id) */
  openDropdown: (entry: DropdownPortalEntry) => void;
  /** Remove a dropdown entry by id */
  closeDropdown: (id: string) => void;
}

export const DropdownPortalContext = createContext<DropdownPortalContextValue | undefined>(undefined);

/**
 * Internal hook used by Dropdown to push/pop from the portal.
 * NOT exported from the public components barrel.
 */
export function useDropdownPortal(): DropdownPortalContextValue {
  const ctx = useContext(DropdownPortalContext);
  if (!ctx) throw new Error('useDropdownPortal must be used within DropdownPortalProvider');
  return ctx;
}
