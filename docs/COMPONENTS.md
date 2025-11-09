# UI Components Reference

Complete reference for all components in the `components/ui` directory.

---

## 📝 Typography Components

### AppText
Core text components with theme-aware styling and responsive sizing.
- **Title** - Large page titles (58px base)
- **Heading** - Section headings with size variants (heading1/2/3: 36-28px)
- **ObjHeading** - Object/item headings (26px)
- **SubTitle** - Subsection titles (14px)
- **Body** - Main body text with size variants (body1/2/3: 22-26px)
- **Paragraph** - Long-form paragraph text (18px)
- **Caption** - Small helper text (10px)
- **Link** - Interactive link text with accent color

All support: custom colors, fontSize, fontFamily, textAlign, and style overrides.

---

## 🎛️ Layout Components

### AppView
Design-system-aware layout containers with flexbox shortcuts.
- **ViewCust** - Base view with shorthand props (fd, jc, ai, gap, px, py, mx, my)
- **AppPage** - Full-page container with safe areas
- **AppSplit** - Two-column desktop layout (left/right panels)
- **IconButtonView** - Circular button container with center alignment

All support: background colors, borders (individual sides), gradients, shadows, radius, opacity.

### ElevatedView
Elevated containers with depth and visual hierarchy.
- **Card** - Discrete raised content (3px borders, combined shadows, dramatic gradients)
- **Surface** - Large background panels (1px borders, soft shadows, subtle gradients)

Both support: tone variants (base/alt/accent), padding, borders, custom gradients.

---

## 🔘 Button Components

### BaseButton
Primary button component with 7 variants and 3 sizes.
- **Variants**: primary, secondary, solid, outlined, ghost, destructive, cancel
- **Sizes**: sm (32px), md (44px), lg (56px)
- **Features**: Reanimated v3 animations, haptic feedback, disabled states, icon support

### IconButton
Circular icon buttons with hover/press animations.
- **Variants**: text (emoji/string), icon (ReactNode), svg (SVG components)
- **Sizes**: sm (28px), md (38px), lg (48px), or custom number
- **Features**: Tooltip support, selected state, accent color highlighting

---

## 📥 Input Components

### TextInputs
Text input components with labels and validation.
- **TextInput** - Single-line text input with optional heading
- **DescInput** - Multi-line textarea with auto-height

Features: placeholder, value, onChangeText, error states, keyboard handling.

### Dropdown
Searchable dropdown selector with animations.
- **Features**: Search filter, heading label, custom items, value/onChange callbacks
- **Props**: items (label/value pairs), enableSearch, heading, value, onChange

---

## 🎚️ Selection Components

### Switch
Toggle switch with smooth animations.
- **Features**: Heading label, checked state, onChange callback
- **Design**: Reanimated v3 animations, accent color when active

### RadioButton
Single radio button for exclusive selection.
- **Features**: Label text, checked state, onChange callback, outlined variant
- **Design**: Circular indicator with accent color

### Tabs
Horizontal tab navigation with animated indicator.
- **Features**: Multiple tabs, active indicator, onChange callback, bottomSpace option
- **Design**: Reanimated v3 slide animation, accent color active state

---

## 🔢 Group Components

Collection components that manage multiple inputs/selections with ref-based value access.

### ButtonGroup
Exclusive button selection group.
- **Features**: Horizontal/vertical layout, variant logic, getValue() via ref
- **Props**: items (key/label pairs), direction, spacing, fullWidth, outlined, background

### TextInputGroup
Multiple text inputs with tab/enter navigation.
- **Features**: Mixed TextInput/DescInput support, auto-focus next, getValues() via ref
- **Props**: items (key/heading/placeholder), onLastEnter callback

### TextDescGroup
Multiple multi-line inputs with keyboard navigation.
- **Features**: Tab/enter navigation between fields, getValues() via ref
- **Props**: items (key/heading/placeholder), onLastEnter callback

### DropdownGroup
Multiple dropdown selectors.
- **Features**: Default values, getValues() via ref
- **Props**: items (key/heading/options/defaultValue)

### SwitchGroup
Multiple switches with optional constraints.
- **Modes**: Normal (all), exclusive (one only), maxActive (limit count)
- **Features**: getValues() returns active keys array
- **Props**: items (key/heading), exclusive, maxActive, direction

### RadioButtonGroup
Radio button group for exclusive selection.
- **Features**: Horizontal/vertical layout, getValue() returns single key
- **Props**: items (key/label), direction, outlined

### ToggleGroup
Icon toggle buttons with multi-select.
- **Features**: Icon-based toggles, getValues() returns active object
- **Props**: items (key/icon ReactNode)

---

## 🎨 Feedback Components

### AppModal
Animated modal overlay with Reanimated v3.
- **Features**: Heading/body props or custom children, backdrop dismiss, onClose callback
- **Design**: Slide-in animation, centered on screen, responsive sizing

### AppToast
Temporary notification toast with auto-dismiss.
- **Types**: info, success, warning, error
- **Features**: Custom duration, onHide callback, slide-in animation
- **Design**: Fixed position, theme-aware colors

### Snackbar
Bottom snackbar for brief messages.
- **Tones**: success, error, info
- **Features**: Message text, action button (optional), auto-hide, onHide callback
- **Design**: Bottom-aligned, Reanimated v3 animations

### Notification
In-app notification cards with timestamps.
- **Types**: message, update, alert, info
- **Features**: Title, message, timestamp, onPress callback, onDismiss
- **Design**: Full-width, swipeable dismiss, type-based icons

### NotificationContainer
Manages and displays stacked notifications.
- **Features**: Auto-stacking, auto-dismiss (5s), keyboard-safe positioning
- **Integration**: Works with useNotifications hook

---

## 🎯 Utility Components

### Accordion
Collapsible content section with header.
- **Features**: Title, defaultOpen state, expand/collapse animation
- **Design**: Reanimated v3 height animation, chevron indicator

### AppTooltip
Hover/press tooltip wrapper.
- **Features**: Custom text, delay timing, mobile press-to-show, auto-hide
- **Design**: Positioned above target, theme-aware background

### CustomLoad
Loading spinner with two sizes.
- **Sizes**: small, large
- **Design**: Reanimated v3 rotation animation, accent color

---

## 🔧 Base Components

### base/
Low-level building blocks (not typically used directly).
- **ButtonBase** - Core button logic with Reanimated v3
- **GradientView** - Gradient background renderer (web: CSS, native: linear-gradient)

### Resuables/
Shared utilities for components.
- **gradients.tsx** - Gradient helper functions
- **shadows.ts** - Shadow style presets

---

## 🎨 Theme Integration

All components use:
- `$()` function for token lookup (CSS vars on web, resolved values on native)
- `useScale()` hook for responsive sizing
- `UseTheme()` hook for theme access
- Reanimated v3 for GPU-accelerated animations
- Platform.OS checks for cross-platform compatibility

## 📦 Exports

All components exported via `components/ui/index.ts` for clean imports:
```typescript
import { Button, TextInput, Card, AppModal } from '@/components/ui'
```
