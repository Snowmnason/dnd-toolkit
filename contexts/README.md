# contexts

**React Context definitions for legacy/local app state.**

⚠️ **Note:** Most providers have been consolidated to `/providers` folder. This folder now contains only domain-specific contexts (Theme, WorldSelection) that aren't part of the core provider stack.

---

## Quick Start

```tsx
import { useWorldSelection } from "@/contexts/WorldSelectionContext";

export function WorldSelector() {
  const { selectedWorld, setSelectedWorld } = useWorldSelection();

  return (
    <Button
      onPress={() => setSelectedWorld("world-123")}
      title={selectedWorld ? "Change World" : "Select World"}
    />
  );
}
```

---

## When to Create a Context

**Use React Context when:**

✅ State needs to be accessible by many components at different nesting levels
✅ State changes relatively infrequently (not multiple times per second)
✅ State is domain-specific and needs clear ownership (theme, world selection, auth)
✅ You want to avoid prop drilling through 5+ component levels
✅ You need to share state across distinct parts of the app

**Don't use React Context for:**

❌ Frequently changing data (animations, form inputs, scroll position) → Use local state or Ref
❌ Server state or API data → Use query hooks instead
❌ Data that belongs to a single component → Use useState
❌ Global configuration that rarely changes → Use constants or singletons
❌ Complex state logic with many transitions → Use useReducer + hook or state machine

---

## Contexts in This Folder

### ThemeContext

**File:** `ThemeContext.tsx`

**Purpose:** Manage theme family and dark/light mode (legacy context, consider using `/providers/ThemeProvider` instead).

**Exports:** `useTheme()` hook, `ThemeContext` object

**Usage:**

```tsx
import { useTheme } from "@/contexts/ThemeContext";

export function MyComponent() {
  const { themeName, isDark, setTheme } = useTheme();

  return (
    <View>
      <Text>
        Current: {themeName} ({isDark ? "dark" : "light"})
      </Text>
      <Button onPress={() => setTheme("cyberpunk")} title="Switch Theme" />
    </View>
  );
}
```

**State shape:**

```typescript
{
  theme: any;                    // Theme object (colors, fonts, etc.)
  themeName: 'classic' | 'cyberpunk' | 'fantasy';  // Active theme family
  setTheme: (name: ThemeFamilyName) => void;       // Change theme
  isDark: boolean;               // Dark/light mode flag
}
```

**⚠️ Note:** Prefer `/providers/ThemeProvider` for new code. This context is maintained for backward compatibility.

---

### WorldSelectionContext

**File:** `WorldSelectionContext.tsx`

**Purpose:** Track currently selected world in world selection flow (temporary UI state).

**Exports:** `useWorldSelection()` hook, `WorldSelectionProvider` component

**Usage:**

```tsx
import { useWorldSelection } from "@/contexts/WorldSelectionContext";

export function WorldCard({ world }) {
  const { selectedWorld, setSelectedWorld } = useWorldSelection();
  const isSelected = selectedWorld === world.id;

  return (
    <Button
      onPress={() => setSelectedWorld(world.id)}
      style={{ opacity: isSelected ? 1 : 0.5 }}
      title={world.name}
    />
  );
}

export function ConfirmButton() {
  const { selectedWorld, handleBackPress } = useWorldSelection();

  const onConfirm = () => {
    if (selectedWorld) {
      // Navigate with world
      handleBackPress();
    }
  };

  return <Button onPress={onConfirm} title="Confirm" />;
}
```

**State shape:**

```typescript
{
  selectedWorld: string | null;              // World ID or null
  setSelectedWorld: (id: string | null) => void;  // Update selection
  handleBackPress: () => boolean;            // Back button handler
}
```

**When to use:**

- In world selection UI (list → detail → confirm flow)
- When you need to track user's selection state temporarily
- Not for persistent world access (use `/providers/AppParamsVolatileProvider` instead)

---

### LoadingContext

**File:** `loading-context.tsx`

**Purpose:** Block UI during long-running operations with customizable loading screen (kernel bootstrap, navigation, storage operations).

**Exports:** `useLoadingContext()` hook, `LoadingProvider` component

**Usage:**

```tsx
import { useLoadingContext } from "@/contexts/loading-context";

export function MyComponent() {
  const { isLoading, message, progress, setLoading } = useLoadingContext();

  const handleSave = async () => {
    setLoading({
      title: "Saving",
      subtitle: "World Data",
      message: "This may take a moment...",
      progress: 0.5
    });

    try {
      await saveWorldData();
      setLoading(false);
    } catch (error) {
      setLoading(false);
      // Handle error
    }
  };

  return (
    <Button onPress={handleSave} title="Save World" />
  );
}
```

**State shape:**

```typescript
{
  isLoading: boolean;                    // Whether to show loading screen
  title?: string;                        // Main title (e.g., "D&D Toolkit")
  subtitle?: string;                     // Subtitle (e.g., "Loading App")
  message?: string;                      // Bottom message (e.g., "Please wait...")
  progress?: number;                     // Progress 0-1 (shows progress bar)
  showProgress?: boolean;                // Toggle progress bar (default: true)
  decorativeElement?: React.ReactNode;   // Custom loading animation
  setLoading: (state: boolean | Partial<LoadingState>) => void; // Update loading state
}
```

**When to use:**

- Kernel initialization (bootstrap loading screen)
- Navigation transitions (route changes)
- Storage operations (large data saves/loads)
- Service calls (analytics export, error reporting)
- Any operation >500ms that needs user feedback

**Provider setup:** Must wrap app tree before AppKernelProvider:

```tsx
// app/_layout.tsx
<LoadingProvider>
  <AppKernelProvider>
    {/* App content */}
  </AppKernelProvider>
</LoadingProvider>
```

---

## Best Practices

### ✅ Do

- Keep context state minimal (single focused concern)
- Memoize context values with `useMemo` (prevents unnecessary re-renders)
- Provide clear error messages if context not provided
- Document state shape and update functions
- Use specific hooks instead of consuming context directly
- Consider if a hook would be simpler (many contexts can be hooks)

### ❌ Don't

- Store frequently-changing data (animations, scroll position) in context
- Create context for everything (use hooks for simple state)
- Nest contexts deeply without purpose (keep provider tree shallow)
- Update context state from multiple unrelated components (creates spaghetti)
- Forget to memoize context values (causes re-render cascades)
- Use context for server/API state (use query hooks instead)

---

## Migration Path

**Most contexts have been moved to `/providers`:**

| Old Location                            | New Location                              | Status                                    |
| --------------------------------------- | ----------------------------------------- | ----------------------------------------- |
| `contexts/AppParamsStableContext.tsx`   | `providers/AppParamsStableProvider.tsx`   | ✅ Migrated                               |
| `contexts/AppParamsVolatileContext.tsx` | `providers/AppParamsVolatileProvider.tsx` | ✅ Migrated                               |
| `contexts/PlatformContext.tsx`          | `providers/PlatformProvider.tsx`          | ✅ Migrated                               |
| `contexts/ThemeContext.tsx`             | `providers/ThemeProvider.tsx`             | ⚠️ Legacy (use `/providers` for new code) |
| `contexts/WorldSelectionContext.tsx`    | —                                         | Current (domain-specific)                 |

**When adding new contexts:**

- If it's a core app provider (auth, theme, scale) → Put in `/providers`
- If it's domain-specific UI state (world selection) → Put in `/contexts`
- If it's just local component state → Use `useState` instead

---

## File Structure

```
contexts/
├── ThemeContext.tsx           # Legacy theme context (prefer /providers/ThemeProvider)
└── WorldSelectionContext.tsx  # World selection UI state
```

---

## Related

- [providers/](../providers/) – Core app providers (consolidated provider stack)
- [providers/ThemeProvider.tsx](../providers/ThemeProvider.tsx) – Modern theme provider
- [hooks/](../hooks/) – Custom hooks (often simpler than contexts)
- [docs/COMPONENTS.md](../docs/COMPONENTS.md) – UI component patterns
