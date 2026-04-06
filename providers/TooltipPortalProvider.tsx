import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { TooltipPortalContext, TooltipPortalEntry } from '../contexts/tooltip-portal-context';

/**
 * 🪟 TooltipPortalProvider
 *
 * Renders an absolute-fill portal outlet above all children. Any component using
 * `AppTooltip` registers its tooltip here via `useTooltipPortal()`. The portal
 * renders each tooltip at the trigger's absolute screen coordinates, ensuring it
 * always appears above stacking contexts (e.g. NavDrawer, Accordion headers).
 *
 * Positioned in OverlayProvider between ModalProvider and NavDrawerProvider so
 * tooltips on NavDraw items display correctly above the drawer.
 *
 * ✅ Gate-Free: No kernel or auth dependencies.
 */
export function TooltipPortalProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<TooltipPortalEntry[]>([]);

  const registerEntry = useCallback((entry: TooltipPortalEntry) => {
    // Replace existing entry with same id (re-show), or push new
    setEntries(prev => [...prev.filter(e => e.id !== entry.id), entry]);
  }, []);

  const unregisterEntry = useCallback((id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
  }, []);

  // Memoize the context value to prevent dependency updates in consumers
  const contextValue = useMemo(() => ({ registerEntry, unregisterEntry }), [registerEntry, unregisterEntry]);

  return (
    <TooltipPortalContext.Provider value={contextValue}>
      <View style={styles.fill}>
        {children}
      </View>

      {/* Portal outlet — absolute-fill overlay, rendered OUTSIDE the flex wrapper */}
      {entries.length > 0 && (
        <View style={styles.outlet} pointerEvents="box-none">
          {entries.map(entry => (
            <View
              key={entry.id}
              style={[
                styles.entryAnchor,
                {
                  left: entry.pageX,
                  top: entry.pageY,
                  width: entry.triggerWidth,
                  height: entry.triggerHeight,
                },
              ]}
              pointerEvents="none"
            >
              {entry.content}
            </View>
          ))}
        </View>
      )}
    </TooltipPortalContext.Provider>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  outlet: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9000,
  },
  entryAnchor: {
    position: 'absolute',
    // width/height/left/top set inline per-entry
  },
});
