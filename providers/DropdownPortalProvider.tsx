import React, { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { DropdownPortalContext, DropdownPortalEntry } from '../contexts/dropdown-portal-context';

/**
 * 🔽 DropdownPortalProvider
 *
 * Renders an absolute-fill portal outlet for dropdown content. The Dropdown
 * component registers its content here via `useDropdownPortal()`. Content is
 * rendered at screen coordinates tracked by the Dropdown via shared values,
 * ensuring the dropdown escapes parent stacking contexts and scroll containers.
 *
 * Key behaviors:
 * - Single active dropdown at a time (opening a new one closes the previous)
 * - Portal outlet uses pointerEvents="box-none" so page scroll works on web
 * - Click-outside detection is handled by the Dropdown component (web: document
 *   listener, native: backdrop Pressable inside the render function)
 * - Position tracking is handled by the Dropdown via RAF + measureInWindow
 *
 * Positioned in OverlayProvider between TooltipPortalProvider and NavDrawerProvider
 * so dropdowns render above content/NavDrawer but below tooltips and modals.
 *
 * ✅ Gate-Free: No kernel or auth dependencies.
 */
export function DropdownPortalProvider({ children }: { children: React.ReactNode }) {
  const [entry, setEntry] = useState<DropdownPortalEntry | null>(null);
  const entryRef = useRef<DropdownPortalEntry | null>(null);

  const openDropdown = useCallback((newEntry: DropdownPortalEntry) => {
    // Close previous dropdown if it's a different one
    if (entryRef.current && entryRef.current.id !== newEntry.id) {
      entryRef.current.onClose();
    }
    entryRef.current = newEntry;
    setEntry(newEntry);
  }, []);

  const closeDropdown = useCallback((id: string) => {
    if (entryRef.current?.id === id) {
      entryRef.current = null;
      setEntry(null);
    }
  }, []);

  const contextValue = useMemo(() => ({ openDropdown, closeDropdown }), [openDropdown, closeDropdown]);

  return (
    <DropdownPortalContext.Provider value={contextValue}>
      <View style={styles.fill}>
        {children}
      </View>

      {/* Portal outlet — absolute-fill overlay, rendered OUTSIDE the flex wrapper */}
      {entry && (
        <View style={styles.outlet} pointerEvents="box-none">
          {entry.render()}
        </View>
      )}
    </DropdownPortalContext.Provider>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  outlet: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 8500,
  },
});
