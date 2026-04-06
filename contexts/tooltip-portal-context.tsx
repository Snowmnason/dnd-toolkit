import React, { createContext, useContext } from 'react';

/**
 * A single tooltip entry registered with the portal.
 * `content` is the animated tooltip bubble ReactNode created by AppTooltip.
 * `pageX/pageY` are absolute screen coordinates of the trigger element.
 */
export interface TooltipPortalEntry {
  id: string;
  /** Absolute screen X of the trigger's left edge */
  pageX: number;
  /** Absolute screen Y of the trigger's top edge */
  pageY: number;
  /** Width of the trigger element */
  triggerWidth: number;
  /** Height of the trigger element */
  triggerHeight: number;
  /** The animated tooltip bubble to render at this position */
  content: React.ReactNode;
}

interface TooltipPortalContextValue {
  registerEntry: (entry: TooltipPortalEntry) => void;
  unregisterEntry: (id: string) => void;
}

export const TooltipPortalContext = createContext<TooltipPortalContextValue | undefined>(undefined);

/**
 * Internal hook used by AppTooltip to push/pop from the portal.
 * NOT exported from the public components barrel.
 */
export function useTooltipPortal(): TooltipPortalContextValue {
  const ctx = useContext(TooltipPortalContext);
  if (!ctx) throw new Error('useTooltipPortal must be used within TooltipPortalProvider');
  return ctx;
}
