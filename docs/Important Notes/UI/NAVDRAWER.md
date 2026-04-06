# Navigation Drawer (NavDrawer)

The **NavDrawer** is a flexible, platform-aware drawer component that adapts between a persistent sidebar (desktop) and modal overlay (mobile). It's a foundational UI piece designed for quick navigation, utility actions, and future expansion.

## Overview

| Aspect | Details |
|--------|---------|
| **Default visibility** | Hidden by default, shown via config flag or `useNavDrawer()` hook |
| **Persistence** | Desktop expanded/collapsed state is saved to storage and auto-restored |
| **Entry point** | `<NavDrawerLayer mode="expandable\|modal\|permanent-sidebar" />` |
| **Hook** | `useNavDrawer()` — control state from anywhere in the app |
| **Content** | `<AppNavDrawer>` — inner layout; scrollable, safe-area aware |
| **Feature flag** | `config.ui?.navDrawer?.enabled` — global on/off switch |

---

## Use Cases

### Utility Action Panels (Primary)
Quick access to common actions without leaving current page:
- World filters or search
- Display settings
- Sidebar shortcuts to frequently-used screens
- Debug/admin tools (dev mode)

### Side-Menu Navigation (Secondary)
Traditional navigation shortcuts:
- Quick links to main sections
- Breadcrumb-style navigation
- Contextual shortcuts based on current screen

### Future Expansion
Foundation for additional drawer-based features (settings panels, workspace switcher, etc.)

---

# Mobile

## Modal Drawer

On mobile (web excluded), the drawer renders as a **dismissable modal overlay** anchored to the left or right edge.

### Behavior
- **Opening**: Touch the trigger button → drawer slides in from left/right with fade-in animation
- **Closing**: Tap X button, tap backdrop, or call `hide()`
- **Width**: 60% of screen (responsive via scale tokens)
- **Backdrop**: Semi-transparent (50% opacity), tap-to-close

### Example Usage

```tsx
import { useNavDrawer } from '@/contexts/nav-drawer-context';
import { Button } from '@/components/ui';
import { Ionicons } from '@expo/vector-icons';

export function MyScreen() {
  const { show } = useNavDrawer();

  return (
    <Button
      onPress={() => show({ position: 'left' })}
      left={<Ionicons name="menu" size={20} />}
    >
      Open Menu
    </Button>
  );
}
```

### Props
- `position` — `'left'` or `'right'` (defaults to left)
- Controlled via hook: `show()`, `hide()`, `toggle()`

### Implementation Notes
- Uses `react-native-reanimated` for smooth slide animations
- Modal rendered inside `Modal` component for proper z-index management
- Tapping backdrop fires `hide()` automatically

---

# Desktop

## Expandable Sidebar

On desktop (web), the drawer renders as a **permanent expandable sidebar** that animates between collapsed and expanded states.

### Behavior
- **Collapsed**: Icon-only view (~72px wide), shows `childrenClosed` content
- **Expanded**: Full view (~240px wide), shows `childrenOpen` content with labels/text
- **Navigation**: Main content area shrinks/grows around the sidebar
- **Persistence**: State saved to `STORAGE_KEYS.NAV_DRAWER_EXPANDED` after each toggle
- **Auto-restore**: On app load, sidebar opens to previous user preference

### Example Usage

```tsx
import { AppNavDrawer, IconButton } from '@/components/ui';
import { useNavDrawer } from '@/contexts/nav-drawer-context';
import { Ionicons } from '@expo/vector-icons';

export function RootLayout() {
  const { isExpanded, setExpanded } = useNavDrawer();

  return (
    <NavDrawerLayer
      mode="expandable"
      childrenClosed={
        <AppNavDrawer scrollable>
          <IconButton
            icon={<Ionicons name="home" size={24} />}
            onPress={() => navigate('/main')}
          />
          <IconButton
            icon={<Ionicons name="settings" size={24} />}
            onPress={() => navigate('/settings')}
          />
        </AppNavDrawer>
      }
      childrenOpen={
        <AppNavDrawer scrollable>
          <Button fullWidth>Home</Button>
          <Button fullWidth>Settings</Button>
          <Button fullWidth>Profile</Button>
        </AppNavDrawer>
      }
      renderToggle={(isExp, onToggle) => (
        <IconButton
          icon={<Ionicons name={isExp ? 'chevron-back' : 'chevron-forward'} size={20} />}
          onPress={onToggle}
        />
      )}
    />
  );
}
```

### Props
- `childrenClosed` — React content for collapsed state (typically icons)
- `childrenOpen` — React content for expanded state (typically buttons with labels)
- `renderToggle` *(optional)* — Custom toggle button; if omitted, default chevron is rendered
- `mode="expandable"`

### Implementation Notes
- Width animates via `react-native-reanimated` (`withTiming`)
- Animation duration: 150ms
- Collapsed width: ~72px; Expanded width: ~240px
- `AppNavDrawer` wraps content with safe-area padding + scrolling
- Sidebar persists even on route changes

---

# Shared

## Configuration

### Enable/Disable via Config

```json
{
  "ui": {
    "navDrawer": {
      "enabled": true,
      "skipRoutes": ["login/sign-in", "select/world-selection"]
    }
  }
}
```

- `enabled` — Global on/off toggle (all platforms)
- `skipRoutes` — Array of route names where drawer should NOT render

### Integration in Root Layout

```tsx
import { NavDrawerLayer } from '@/components/layer/NavDrawerLayer';

export function RootLayout() {
  const config = getAppConfig();
  const navDrawerConfig = config.ui?.navDrawer;
  const navDrawerEnabled = navDrawerConfig?.enabled ?? false;
  const skipRoutes = navDrawerConfig?.skipRoutes ?? [];
  const shouldRenderNavDrawer = navDrawerEnabled && !skipRoutes.includes(currentRoute);

  return (
    <>
      {/* Desktop: Expandable sidebar */}
      {Platform.OS === 'web' && shouldRenderNavDrawer && (
        <NavDrawerLayer mode="expandable" {...contentProps} />
      )}

      {/* Mobile: Modal drawer */}
      {Platform.OS !== 'web' && shouldRenderNavDrawer && (
        <NavDrawerLayer mode="modal" position="left" {...contentProps} />
      )}
    </>
  );
}
```

---

## AppNavDrawer — Inner Layout

The `<AppNavDrawer>` component provides consistent spacing and scrolling for drawer content.

### Features
- **Safe-area padding** — Respects notches/status bars
- **Consistent spacing** — Horizontal padding + vertical gaps between items
- **Optional scrolling** — Automatic `ScrollView` when `scrollable={true}`
- **Responsive** — Uses scale tokens for sizing

### Usage

```tsx
import { AppNavDrawer, Button, IconButton } from '@/components/ui';

<AppNavDrawer scrollable style={{ backgroundColor: 'red' }}>
  <Button fullWidth>Action 1</Button>
  <Button fullWidth>Action 2</Button>
  <IconButton icon={<Ionicons name="settings" />} />
</AppNavDrawer>
```

### Props
- `children` — Content to render
- `scrollable` *(default: true)* — Wrap content in `ScrollView`
- `style` *(optional)* — Additional `ViewStyle` to merge

### Implementation Notes
- If scrollable, uses `ScrollView` with hidden scrollbar
- Content container has flex: 1, paddingTop/Bottom/Horizontal
- Safe-area padding added automatically via `useSafeAreaInsets()`

---

## Hook API — useNavDrawer()

Control drawer state from anywhere in the app.

### Types

```tsx
export interface NavDrawerContextType {
  // Modal drawer state (mobile)
  drawer: { visible: boolean; position: 'left' | 'right' };
  
  // Sidebar expanded state (desktop)
  isExpanded: boolean;
  
  // Controls
  setExpanded: (expanded: boolean) => void;
  show: (options?: { position?: DrawerPosition }) => void;
  hide: () => void;
  toggle: (options?: { position?: DrawerPosition }) => void;
}
```

### Common Patterns

**Open mobile drawer from left:**
```tsx
const { show } = useNavDrawer();
show({ position: 'left' });
```

**Toggle desktop sidebar:**
```tsx
const { isExpanded, setExpanded } = useNavDrawer();
setExpanded(!isExpanded);
```

**Close any drawer (platform-agnostic):**
```tsx
const { hide } = useNavDrawer();
hide();
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Drawer doesn't appear | Check `config.ui.navDrawer.enabled === true` and route not in `skipRoutes` |
| Content doesn't scroll on mobile | Ensure `scrollable={true}` on `<AppNavDrawer>` |
| State doesn't persist (desktop) | Bootstrap must complete before toggle; use `kernel.phases.appReady` guard |
| Modal appears twice | Verify only one `<NavDrawerLayer>` per mode in render tree |
| Animation feels choppy | Reduce re-renders; memoize content passed to `childrenClosed`/`childrenOpen` |

---

## Future Enhancements

- Swipe-to-open gesture on mobile (right edge drag)
- Keyboard shortcuts (e.g., `Cmd+K` desktop, two-finger tap mobile)
- Nested drawer support (drawer within drawer)
- Animation customization (duration, easing)
