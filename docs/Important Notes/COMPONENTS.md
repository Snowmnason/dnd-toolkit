# UI Components Catalog

This is the authoritative catalog of our UI components. It lists variants, design-editable props, and runtime dependencies so we can package this as a library later.

Legend
- Variants: supported design styles for a component
- Editable: what is safe to override by design systems or consumers
- Deps: key runtime deps (peer dependencies when published)

---

## Typography

### AppText family
Variants
- Title, Heading (heading1/2/3), ObjHeading, SubTitle, Body (body1/2/3), Paragraph, Caption, Link

Editable
- color via tokens $(), fontSize, fontFamily (theme families), textAlign, numberOfLines, style

Deps
- Theme tokens ($, UseTheme), sizing (useScale)

---

## Layout

### AppView
Components
- ViewCust, AppPage, AppSplit, IconButtonView

Editable
- backgroundColor (tokens), borders (all/sides), borderRadius, gap/px/py/mx/my, opacity, shadows, gradient (via gradients util)

Deps
- react-native-reanimated (minor for interactions), theme tokens, sizing

### ElevatedView
Components
- Card, Surface, InteractiveCard

Variants
- tone: base | alt | accent
- gradient: on/off + direction/intensity

Editable
- padding, border width/color, radius, gradient colors (via gradientVariant), shadows (combined/soft)

Deps
- reanimated (press states), gradients/shadows utils, theme tokens

---

## Buttons

### BaseButton (exported also as Button)
Variants
- primary | secondary | solid | outlined | ghost | destructive | cancel

Sizes
- sm (32) | md (44) | lg (56)

Editable
- background, border, text color (tokens), left/right icon, disabled, fullWidth

Deps
- react-native-reanimated, expo-haptics

### IconButton
Variants
- text (emoji/string) | icon (ReactNode) | svg (SVG component)

Sizes
- sm (28) | md (38) | lg (48) | custom number

Editable
- selected, tooltip, accent color, background/border

Deps
- reanimated, expo-haptics

---

## Inputs

### TextInputs
Components
- TextInput, DescInput

Editable
- heading label, placeholder, value, onChangeText, error state, underline/filled, keyboard handling (Enter/Tab), min lines

Deps
- theme tokens, sizing

### Dropdown
Features
- search filter, heading label, custom items, controlled value

Editable
- items (label/value), enableSearch, value, onChange, width, tone

Deps
- reanimated, theme tokens

---

## Selection

### Switch
Editable
- checked, onChange, heading, disabled

Deps
- reanimated, expo-haptics

### RadioButton
Editable
- label, checked, onChange, outlined, size

Deps
- reanimated, expo-haptics

### Tabs
Editable
- items, active key, onChange, bottomSpace

Deps
- reanimated, expo-haptics

---

## Groups

### ButtonGroup
Editable
- items (key/label), direction, spacing, variant, outlined, fullWidth; ref.getValue()

### TextInputGroup
Editable
- mixed items (TextInput/DescInput), tab/enter nav, onLastEnter; ref.getValues()

### DropdownGroup
Editable
- items with defaultValue; ref.getValues()

### SwitchGroup
Editable
- items, exclusive, maxActive, direction; ref.getValues()

### RadioButtonGroup
Editable
- items, direction, outlined; ref.getValue()

### ToggleGroup
Editable
- items (key/icon), multi-select; ref.getValues()

Deps (Groups)
- Theme tokens, some use reanimated

---

## Feedback

### AppModal
Editable
- title/body or children, isOpen, onClose, backdropDismiss

Deps
- reanimated

### AppToast
Variants
- info | success | warning | error

Editable
- message, duration, onHide, position

Deps
- reanimated

### Snackbar
Tones
- success | error | info

Editable
- message, action label/onPress, duration, onHide

Deps
- reanimated, expo-haptics

### Notification (component)
Status
- Available as presentational component. The queue/provider is disabled in app usage for now.

Editable
- type, title, message, timestamp, onPress/onDismiss; absolute positioning handled internally

Deps
- react-native-safe-area-context, theme tokens

---

## Utilities

### Accordion
Editable
- title, defaultOpen, children

Deps
- reanimated, expo-haptics

### AppTooltip
Editable
- text, delay, placement, press-to-show on mobile

Deps
- reanimated

### CustomLoad
Editable
- size: small | large

Deps
- reanimated

---

## Base and Helpers

### base/
- ViewCust: base view with shorthand style props

### Resuables/
- gradients.tsx: gradient helpers (gradientVariant)
- shadows.ts: shadow presets (soft/combined)

---

## Theming and Sizing
All components integrate with:
- $(): token lookup (CSS vars on web, resolved on native)
- UseTheme(): theme access (colors, fonts)
- useScale(): responsive sizing snapshot
- Reanimated v3 for animations where applicable

---

## Library packaging (deps/peers)
When exporting as a library, declare these as peerDependencies:
- react, react-native
- react-native-reanimated
- expo-haptics (optional for haptics-enabled components)
- react-native-safe-area-context (for Notification)
Include type exports from `components/ui/index.ts` and keep tokens/themes under `theme/` as peer/shared.

---

## Importing
```ts
import { Button, TextInput, Card, AppModal, Snackbar, AppToast } from '@/components/ui'
```
