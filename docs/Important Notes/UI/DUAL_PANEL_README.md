# Panel Navigation System

## Overview

`usePanelNavigation()` + `PanelNavigationProvider` is a centralized, context-based pattern for managing two-panel layouts (list + detail) that adapt to mobile viewports by stacking panels instead of showing them side-by-side.

**Purpose**: Provide shared panel navigation state between `AppSplit` screens and the TopBar back button, enabling the back button to intelligently close a detail panel before navigating away.

---

## When to Use

### Use PanelNavigationProvider When:
- Your layout contains `AppSplit` screens (list + detail panels)
- On mobile, you want panels stacked: list visible → click item → detail overlays
- TopBar back button should close the detail panel before navigating away
- URL should remain the same (no route change between panels)

### Don't Use When:
- Screen has only one panel (Settings, Profile, etc.)
- Detail view needs its own URL/route
- No `AppSplit` component used

---

## Integration Pattern

### Step 1: Wrap Layout with PanelNavigationProvider

In your layout file (e.g., `app/select/_layout.tsx`):

```typescript
import { PanelNavigationProvider } from '@/hooks/navigation';

export default function SelectLayout() {
  return (
    <PanelNavigationProvider>
      <AppPage>
        <Stack screenOptions={{ headerShown: false }} />
      </AppPage>
    </PanelNavigationProvider>
  );
}
```

### Step 2: Screen Uses usePanelNavigation

```typescript
import { usePanelNavigation } from '@/hooks/navigation/use-panel-navigation';

export default function WorldSelectionScreen() {
  const { showRightPanel, goToRightPanel, goToLeftPanel, isDesktop } =
    usePanelNavigation();

  const handleSelectItem = (item) => {
    setSelectedItem(item);
    goToRightPanel(); // On mobile: switches to right panel
  };

  const handleBackToList = () => {
    setSelectedItem(null);
    goToLeftPanel(); // On mobile: switches to left panel
  };

  return (
    <AppSplit
      left={<ListPanel onSelect={handleSelectItem} />}
      right={<DetailPanel />}
      animateRightSlide={!isDesktop}
      rightVisible={showRightPanel}
      onMobileRightPanelClose={!isDesktop ? handleBackToList : undefined}
    />
  );
}
```

### Step 3: TopBar Back Button (Automatic)

The TopBar back button in `app/_layout.tsx` automatically checks panel state:

```typescript
const panelNav = usePanelNavigation();

const handleTopBarBack = () => {
  // If panel navigation handles the back (mobile right→left), stop here
  if (panelNav.handleBackPress()) {
    return;
  }
  // Otherwise do normal route navigation
  router.replace(backTarget);
};
```

This is already wired up — no per-screen work needed.

---

## API Reference

### PanelNavigationProvider

Wraps layout to provide shared panel state.

```typescript
<PanelNavigationProvider onPanelChange={(panel) => console.log(panel)}>
  {children}
</PanelNavigationProvider>
```

**Gate-Free**: No kernel phase dependencies.

### usePanelNavigation Hook

```typescript
const {
  activePanel,      // 'left' | 'right' — current active panel
  showLeftPanel,    // boolean — should left panel be visible
  showRightPanel,   // boolean — should right panel be visible
  goToRightPanel,   // () => void — switch to right panel (mobile only)
  goToLeftPanel,    // () => void — switch to left panel (mobile only)
  handleBackPress,  // () => boolean — returns true if back was handled
  isDesktop,        // boolean — platform check
  isActualMobile,   // boolean — iOS or Android (not web)
  isActive,         // boolean — whether a PanelNavigationProvider is mounted
} = usePanelNavigation();
```

**Safe outside provider**: Returns no-op defaults when no `PanelNavigationProvider` is mounted. Single-panel screens are unaffected.

---

## Platform Behavior

### Mobile (Web Browser or Native Phone)

- **Default**: Show left panel (list view) full-screen
- **On Selection**: Show right panel (detail view) full-screen with slide animation
- **Back Button**: Closes right panel, reveals left panel
- **Second Back**: Navigates away from screen

### Desktop (Web or Electron)

- **Always**: Show both panels side-by-side (35/65 split)
- **Selection**: Updates right panel content directly
- **Back Button**: Always navigates away (no panel state)

---

## Key Design Decisions

1. **Context-based (not local state)**: Panel state is shared via React Context so the TopBar (in root layout) can access it from any nested screen
2. **Safe defaults**: `usePanelNavigation()` returns no-op values when no provider is mounted, making it safe for single-panel screens
3. **`isActive` flag**: Lets consumers know if panel navigation is actually in effect (e.g., TopBar can conditionally show back arrow)
4. **No URL changes**: Panel state is purely UI — the URL stays the same throughout panel switches

---

## Future Enhancements

- [ ] Swipe gesture to return from detail to list (mobile)
- [ ] Hardware back button support (Android)
- [ ] Panel transition animations (slide-in/out via reanimated)
- [ ] Accessibility: Announce panel state changes for screen readers
