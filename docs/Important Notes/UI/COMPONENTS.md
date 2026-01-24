# UI Components Catalog

Authoritative reference for all UI components in the dnd-toolkit. Designed for reusability and future library packaging.

**Note:** For each component below:

- **Variants** = Predefined design styles available
- **Editable** = Safe properties to override
- **Dependencies** = Required packages and utilities

---

## 📝 Typography

### AppText family

| Property         | Details                                                                          |
| ---------------- | -------------------------------------------------------------------------------- |
| **Variants**     | Title, Heading 1-3, Object Heading, Subtitle, Body 1-3, Paragraph, Caption, Link |
| **Editable**     | Color (via `$()`), fontSize, fontFamily, textAlign, numberOfLines, style         |
| **Dependencies** | Theme tokens (`$`, `UseTheme`), sizing (`useScale`)                              |

---

## 📦 Layout

### AppView

| Property         | Details                                                                                      |
| ---------------- | -------------------------------------------------------------------------------------------- |
| **Components**   | ViewCust, AppPage, AppSplit, IconButtonView                                                  |
| **Editable**     | backgroundColor (tokens), borders, borderRadius, gap/px/py/mx/my, opacity, shadows, gradient |
| **Dependencies** | react-native-reanimated, theme tokens, sizing                                                |

### ElevatedView

| Property         | Details                                                              |
| ---------------- | -------------------------------------------------------------------- |
| **Variants**     | tone (base, alt, accent); gradient (on/off with direction/intensity) |
| **Components**   | Card, Surface, InteractiveCard                                       |
| **Editable**     | Padding, border width/color, radius, gradient colors, shadows        |
| **Dependencies** | reanimated, gradient/shadow utilities, theme tokens                  |

---

## 🔘 Buttons

### Button (BaseButton)

| Property         | Details                                                                    |
| ---------------- | -------------------------------------------------------------------------- |
| **Variants**     | primary, secondary, solid, outlined, ghost, destructive, cancel            |
| **Sizes**        | sm (32px), md (44px), lg (56px)                                            |
| **Editable**     | Background, border, text color, left/right icon, disabled state, fullWidth |
| **Dependencies** | react-native-reanimated, expo-haptics                                      |

### IconButton

| Property         | Details                                                    |
| ---------------- | ---------------------------------------------------------- |
| **Variants**     | text (emoji/string), icon (ReactNode), svg (SVG component) |
| **Sizes**        | sm (28px), md (38px), lg (48px), custom                    |
| **Editable**     | Selected state, tooltip, accent color, background/border   |
| **Dependencies** | reanimated, expo-haptics                                   |

---

## ⌨️ Inputs

### TextInput & DescInput

| Property         | Details                                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Editable**     | Heading label, placeholder, value, onChangeText, error state, filled/underline variant, keyboard nav (Enter/Tab) |
| **Features**     | Min/max lines, password mode, numeric input                                                                      |
| **Dependencies** | Theme tokens, sizing                                                                                             |

### Dropdown

| Property         | Details                                                               |
| ---------------- | --------------------------------------------------------------------- |
| **Features**     | Search filter, heading label, custom items, controlled value          |
| **Editable**     | Items (label/value pairs), enableSearch, value, onChange, width, tone |
| **Dependencies** | reanimated, theme tokens                                              |

---

## ☑️ Selection Controls

### Switch

| Property         | Details                                                         |
| ---------------- | --------------------------------------------------------------- |
| **Editable**     | Checked state, onChange callback, heading label, disabled state |
| **Dependencies** | reanimated, expo-haptics                                        |

### RadioButton

| Property         | Details                                                         |
| ---------------- | --------------------------------------------------------------- |
| **Editable**     | Label, checked state, onChange callback, outlined variant, size |
| **Dependencies** | reanimated, expo-haptics                                        |

### Tabs

| Property         | Details                                                  |
| ---------------- | -------------------------------------------------------- |
| **Editable**     | Tab items, active key, onChange callback, bottom spacing |
| **Dependencies** | reanimated, expo-haptics                                 |

---

## 👥 Component Groups

### ButtonGroup

| Property     | Details                                                              |
| ------------ | -------------------------------------------------------------------- |
| **Features** | Multiple button items with key/label, directional layout             |
| **Editable** | Items, direction (row/column), spacing, variant, outlined, fullWidth |
| **API**      | `ref.getValue()` to get selected                                     |

### TextInputGroup

| Property     | Details                                                        |
| ------------ | -------------------------------------------------------------- |
| **Features** | Mixed TextInput/DescInput items, keyboard navigation           |
| **Editable** | Mixed item types, Enter/Tab navigation, callback on last enter |
| **API**      | `ref.getValues()` to get all values                            |

### DropdownGroup

| Property     | Details                                |
| ------------ | -------------------------------------- |
| **Features** | Multiple dropdowns with default values |
| **Editable** | Items array, default value             |
| **API**      | `ref.getValues()` to get all selected  |

### SwitchGroup

| Property     | Details                                               |
| ------------ | ----------------------------------------------------- |
| **Features** | Multiple switches (exclusive or multi-select)         |
| **Editable** | Items, exclusive mode, max active switches, direction |
| **API**      | `ref.getValues()` to get active states                |

### RadioButtonGroup

| Property     | Details                                         |
| ------------ | ----------------------------------------------- |
| **Features** | Multiple radio buttons (single selection)       |
| **Editable** | Items, direction (row/column), outlined variant |
| **API**      | `ref.getValue()` to get selected                |

### ToggleGroup

| Property     | Details                                      |
| ------------ | -------------------------------------------- |
| **Features** | Icon-based toggles with multi-select support |
| **Editable** | Items (key/icon), multi-select mode          |
| **API**      | `ref.getValues()` to get selected            |

---

## 💬 Feedback & Modals

### AppModal

| Property         | Details                                                                |
| ---------------- | ---------------------------------------------------------------------- |
| **Editable**     | Title, body, children, isOpen state, onClose callback, backdropDismiss |
| **Dependencies** | reanimated                                                             |
| **Use Case**     | Dialog overlays that block interaction behind backdrop                 |

### AppToast

| Property         | Details                                       |
| ---------------- | --------------------------------------------- |
| **Variants**     | info, success, warning, error                 |
| **Editable**     | Message, duration, onHide callback, position  |
| **Dependencies** | reanimated                                    |
| **Use Case**     | Quick, non-interactive feedback (2-3 seconds) |

### Snackbar

| Property         | Details                                                  |
| ---------------- | -------------------------------------------------------- |
| **Tones**        | success, error, info                                     |
| **Editable**     | Message, action label, action callback, duration, onHide |
| **Dependencies** | reanimated, expo-haptics                                 |
| **Platform**     | Desktop (bottom), Mobile (top for keyboard safety)       |

### Notification

| Property         | Details                                                      |
| ---------------- | ------------------------------------------------------------ |
| **Type**         | Presentational component (queue/provider currently disabled) |
| **Editable**     | Type, title, message, timestamp, onPress, onDismiss          |
| **Position**     | Auto-positioned (respects safe areas)                        |
| **Dependencies** | react-native-safe-area-context, theme tokens                 |

---

## 🛠️ Utilities

### Accordion

| Property         | Details                                         |
| ---------------- | ----------------------------------------------- |
| **Editable**     | Title text, defaultOpen state, children content |
| **Dependencies** | reanimated, expo-haptics                        |

### AppTooltip

| Property         | Details                                                      |
| ---------------- | ------------------------------------------------------------ |
| **Editable**     | Tooltip text, delay (ms), placement, press-to-show on mobile |
| **Dependencies** | reanimated                                                   |

### CustomLoad (Loading Spinner)

| Property         | Details      |
| ---------------- | ------------ |
| **Sizes**        | small, large |
| **Dependencies** | reanimated   |

---

## 🎨 Theming & Integration

All components integrate seamlessly with:

| System                   | Usage                                                             | Purpose                             |
| ------------------------ | ----------------------------------------------------------------- | ----------------------------------- |
| **Theme Tokens (`$()`)** | `$("primary")` returns CSS vars (web) or concrete values (native) | Consistent colors, spacing, radius  |
| **UseTheme Hook**        | Access current theme object with color palette                    | Dynamic theme switching             |
| **useScale Hook**        | Get responsive sizing snapshot based on viewport                  | Platform-aware scaling              |
| **Reanimated v4**        | Animations where applicable                                       | Smooth transitions and interactions |

---

## 📦 Importing Components

```typescript
import {
  // Typography
  Title,
  Heading,
  Body,
  Caption,
  Link,

  // Layout
  AppView,
  Card,
  ElevatedView,

  // Buttons
  Button,
  IconButton,

  // Inputs
  TextInput,
  DescInput,
  Dropdown,

  // Selection
  Switch,
  RadioButton,
  Tabs,

  // Groups
  ButtonGroup,
  TextInputGroup,
  DropdownGroup,

  // Feedback
  AppModal,
  AppToast,
  Snackbar,
  Notification,

  // Utilities
  Accordion,
  AppTooltip,
  CustomLoad,
} from "@/components/ui";
```

---

## 🚀 For Library Packaging

When exporting as a standalone library, declare these as peer dependencies:

- `react` / `react-native`
- `react-native-reanimated` (v4.x)
- `expo-haptics` (optional, for haptic feedback)
- `react-native-safe-area-context` (for Notification)

Include type exports from `components/ui/index.ts` and keep theming under `theme/` as peer/shared resources.

---

## 📋 Component Status

- ✅ **Production Ready** - All components listed above
- 🔄 **In Development** - Enhanced animation presets
- 📅 **Planned** - Custom theme builder UI, component playground

---

## 🎯 Design Philosophy

- **Consistent** - All components use shared token system
- **Accessible** - Proper contrast, tap targets, keyboard navigation
- **Responsive** - Scale intelligently across platforms
- **Themeable** - All colors update with theme changes
- **Performant** - Minimal re-renders, efficient animations
