# UI Components Library

Reusable, theme-integrated UI components for the app. All components are exported from `components/ui/index.ts` (barrel export).

## When to Use This Module

**Use components from here to:**

- Build screens and layouts with themed, consistent styling
- Render modals, buttons, inputs, and other interactive elements
- Display styled text, progress bars, and feedback elements
- Maintain visual consistency across the app

**Do NOT:**

- Import components directly from their individual files; use the barrel export
- Create custom component wrappers unless you're extending a component
- Bypass theming; always use theme tokens for colors and sizing

## Importing from UI Barrel

```typescript
import {
  Button,
  Card,
  TextInput,
  AppModal,
  Snackbar,
  AppToast,
  ProgressBar,
} from '@/components/ui';
```

## Core Components

### ProgressBar

Displays real progress (0-100%) with optional label. Supports smooth animation and theme-based colors.

**When to use:**
- Display progress during long operations (e.g., file uploads, bootstrap phases)
- Show phase initialization progress during kernel bootstrap
- Track multi-step processes

**When NOT to use:**
- Don't use for indeterminate/loading states (use LoadingContext instead)
- Don't fake the progress; always use real values

**Props:**

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `label` | `string?` | — | Optional label displayed above the bar |
| `animated` | `boolean?` | `true` | Enable smooth animation between values |
| `height` | `number?` | `S.space.sm` | Bar height in theme-relative units |
| `highlightColor` | `string?` | `theme.accent` | Fill color (theme token or hex) |
| `trackColor` | `string?` | `theme.borderSubtle` | Track background color |
| `initialProgress` | `number?` | `0` | Initial progress value (0-100) |

**Ref Methods:**

```typescript
export interface ProgressBarRef {
  getProgress(): number;        // Get current progress value
  setProgress(value: number);   // Set to exact value (0-100, clamped)
  increment(amount: number);    // Increase by amount
  decrement(amount: number);    // Decrease by amount
  reset();                      // Reset to 0
}
```

**Example: Basic Usage**

```typescript
import { ProgressBar } from '@/components/ui';

export function MyComponent() {
  const [progress, setProgress] = useState(0);

  return (
    <View>
      <ProgressBar label="Loading..." initialProgress={progress} />
      <Button onPress={() => setProgress(progress + 10)}>+10%</Button>
    </View>
  );
}
```

**Example: Ref Control**

```typescript
import { ProgressBar, Button } from '@/components/ui';
import { useRef } from 'react';

export function PhaseProgressDisplay() {
  const progressRef = useRef<ProgressBarRef>(null);

  useEffect(() => {
    // Update progress as phases complete
    if (phaseComplete) {
      progressRef.current?.increment(12.5); // 1/8 of progress
    }
  }, [phaseComplete]);

  return (
    <View>
      <ProgressBar 
        ref={progressRef}
        label={`Phase ${currentPhase}/8`}
        animated
      />
    </View>
  );
}
```

**Example: Phase Bootstrap (Issue #38)**

```typescript
import { ProgressBar } from '@/components/ui';
import { usePhaseProgress } from '@/hooks/kernel';

export function InitializationSplashScreen() {
  const { progressPercent, phaseLabel } = usePhaseProgress();

  return (
    <View style={contentStyle}>
      <Title>D&D Toolkit</Title>
      <Subtitle>Initializing App</Subtitle>
      
      <ProgressBar 
        label={phaseLabel}
        initialProgress={progressPercent}
        animated
        height={8}
      />
      
      <Caption style={footerStyle}>
        {currentMessage}
      </Caption>
    </View>
  );
}
```

**Styling:**

- **Colors**: Uses theme tokens (`theme.accent`, `theme.borderSubtle`)
- **Height**: Responsive via scale provider (`S.space.sm` default)
- **Animation**: Spring-based smooth transitions (configurable)

**Related:**
- Used in [InitializationSplashScreen](../SplashScreen) for kernel phase progress
- Theme integration via `UseTheme()` hook
- Sizing via `useScale()` provider for responsive units

## Other Core Components

| Component | Purpose |
| --- | --- |
| `Button` | Primary and secondary buttons |
| `TextInput` / `TextInputs` | Form inputs with validation |
| `AppModal` | Centered modal dialogs |
| `Card` | Container with elevation and padding |
| `Tabs` | Tab navigation |
| `RadioButton` | Radio button groups |
| `Switch` | Toggle switches |
| `Dropdown` | Dropdown/select menus |
| `Snackbar` | Bottom notification alerts |
| `AppToast` | Toast notifications |
| `AppToastLayer` | Toast notification container |
| `AppView` | View with theme background |
| `ElevatedView` | View with elevation and shadows |
| `IconButton` | Icon-only buttons |
| `Accordion` | Expandable accordion sections |
| `LazyImage` / `ImageSkeleton` | Image loading with skeleton |

## Architecture

**File Structure:**

```
components/ui/
├── index.ts                    (Barrel export)
├── ProgressBar.tsx             (Progress display)
├── AppText.tsx                 (Text components)
├── Button.tsx & BaseButton.tsx (Button components)
├── AppModal.tsx                (Modal dialogs)
├── TextInputs.tsx              (Form inputs)
├── forms/                      (Form-specific components)
├── groups/                     (Component groups)
├── base/                       (Base components)
└── ... (other components)
```

**Theming:**

All components use the app's theme system:

```typescript
import { UseTheme } from '@/theme';

function MyComponent() {
  const { theme } = UseTheme();
  // Access: theme.accent, theme.background, theme.border, etc.
}
```

**Sizing:**

All components use the scale provider for responsive sizing:

```typescript
import { useScale } from '@/providers/ScaleProvider';

function MyComponent() {
  const S = useScale();
  // Access: S.space.sm, S.space.md, S.fontSize.body, etc.
}
```

## Guidelines

- **Always import from barrel**: `import { Button } from '@/components/ui'`
- **Use theme tokens**: Apply colors via `theme` object, not hardcoded values
- **Responsive sizing**: Use `useScale()` for spacing and font sizes
- **No business logic**: Components are purely presentational
- **Document prop variants**: When adding new props, update this README

## Related Modules

- **`theme/`** — Theme definitions and tokens
- **`providers/ScaleProvider.tsx`** — Responsive sizing
- **`hooks/ui/`** — UI-specific hooks
- **`components/SplashScreen/`** — Complex UI compositions

## File Breakdown

| File | Purpose |
| --- | --- |
| `index.ts` | Barrel export of all UI components |
| `ProgressBar.tsx` | Progress display with animation |
| `AppText.tsx` | Text components (Body, Title, Caption, etc.) |
| `AppView.tsx` | Themed view containers |
| `Button.tsx` / `BaseButton.tsx` | Button components |
| `AppModal.tsx` | Modal dialog component |
| `TextInputs.tsx` | Form text input |
| `forms/` | Form-specific components |
| `groups/` | Component groups (Carousel, Tabs, etc.) |
| `base/` | Base/foundational components |