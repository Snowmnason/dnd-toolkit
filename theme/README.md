# theme

**Centralized theming system for the D&D Toolkit app.**

Cross-platform design tokens, theme families, and provider for consistent visual design across all platforms (web, iOS, Android).

---

## Quick Start

### Using the Current Theme

In any component:

```tsx
import { UseTheme, useScale } from "@/theme";

export function MyComponent() {
  const theme = UseTheme();
  const scale = useScale();

  return (
    <View style={{ backgroundColor: theme.$("background") }}>
      <Text style={{ color: theme.$("textPrimary"), fontSize: scale.font.md }}>
        Hello, themed world!
      </Text>
    </View>
  );
}
```

### Switching Themes at Runtime

```tsx
import { useThemeContext } from "@/theme";

export function ThemeSwitcher() {
  const { family, mode, setFamily, setMode } = useThemeContext();

  return (
    <View>
      <Button
        title={`Theme: ${family}`}
        onPress={() => setFamily("cyberpunk")}
      />
      <Button
        title={`Mode: ${mode}`}
        onPress={() => setMode(mode === "dark" ? "light" : "dark")}
      />
    </View>
  );
}
```

---

## How It Works

### Architecture Overview

```
ThemeProvider (at app root)
  ├─ Loads saved theme preferences from SecureStorage
  ├─ Manages active family (e.g., 'classic', 'cyberpunk')
  ├─ Manages mode (light/dark)
  └─ Resolves theme tokens (colors, fonts, sizing)
       ↓
Token Resolver (CSS vars on web, concrete values on native)
  ├─ theme.$('primary')     → e.g., '#FF6B35'
  ├─ theme.$('background')  → e.g., '#0F1419'
  └─ Uses ultils (sizing, colors, CSS vars)
       ↓
Components consume via UseTheme() hook or $() function
```

### Core Concepts

**Theme Family** – Visual style/aesthetic (e.g., Classic, Cyberpunk)

- Defined in `families/[Name].ts`
- Registers in `themeRegistry.ts`
- Can have multiple modes (light/dark)

**Theme Mode** – Light or dark (e.g., dark mode, light mode)

- Affects color palette but keeps same family

**Design Tokens** – Named values (colors, fonts, sizing)

- Defined in `tokens.ts`
- Implemented by each theme family
- Resolved at runtime by `$()` function

---

## File Structure

```
theme/
├── index.ts                      # Entry point, exports, preload
├── themeRegistry.ts              # Theme family registration
├── tokens.ts                     # Token names & types (vocabulary)
│
├── families/                     # Theme implementations
│   ├── Classic.ts               # Classic (default) theme
│   ├── Cyberpunk.ts             # Cyberpunk theme variant
│   ├── Fantasy.md               # Future theme placeholder
│   └── index.ts                 # Exports all theme families
│
└── ultils/                       # Utilities & helpers
    ├── colorUtils.ts            # Color manipulation (adjust, mix, gradients)
    ├── sizing.ts                # Spacing, font sizes, breakpoints
    ├── tokens.ts                # Token resolution & helpers
    └── cssVars.ts               # CSS variable generation (web only)
```

---

## Creating a New Theme

### 1. Define Theme Family Structure

Create `families/[YourTheme].ts`:

```typescript
import { ThemeTokens } from "../tokens";
import { adjustBrightness, mixColors } from "../ultils/colorUtils";

export const yourThemeLight: ThemeTokens = {
  primary: "#007AFF",
  background: "#FFFFFF",
  surface: "#F5F5F5",
  textPrimary: "#000000",
  textSecondary: "#666666",
  // ... all tokens from TOKENS enum
};

export const yourThemeDark: ThemeTokens = {
  primary: "#0A84FF",
  background: "#000000",
  surface: "#1C1C1E",
  textPrimary: "#FFFFFF",
  textSecondary: "#999999",
  // ... all tokens
};

export const yourTheme = {
  light: yourThemeLight,
  dark: yourThemeDark,

  // Optional: async preload (fonts, heavy assets)
  async preload() {
    // Load custom fonts, images, etc.
  },
};
```

### 2. Register in Theme Registry

Edit `themeRegistry.ts`:

```typescript
import { yourTheme } from "./families/YourTheme";

export const allThemes = {
  classic: classicTheme,
  cyberpunk: cyberpunkTheme,
  yourtheme: yourTheme, // Add here
} as const;
```

### 3. Export from index.ts

```typescript
export { yourTheme } from "./families/YourTheme";
```

### 4. Make Available in ThemeSwitcher UI

In your settings or theme switcher component:

```typescript
const themes = ['classic', 'cyberpunk', 'yourtheme'];

themes.map(t => (
  <Button key={t} onPress={() => setFamily(t)} title={t} />
));
```

---

## Editing Design Tokens

### Adding a New Token

#### 1. Add to Token Vocabulary

Edit `tokens.ts`:

```typescript
export const TOKENS = {
  // ... existing tokens
  myNewToken: "myNewToken", // Add here
} as const;
```

#### 2. Implement in All Theme Families

Edit `families/Classic.ts`, `Cyberpunk.ts`, etc.:

```typescript
export const classicThemeDark: ThemeTokens = {
  // ... existing tokens
  myNewToken: "#FF5733", // Add hex value
};
```

#### 3. Use in Components

```typescript
const theme = UseTheme();
const color = theme.$("myNewToken");
```

### Modifying Token Values

Simply update the hex value in the theme family file:

**Before:**

```typescript
export const classicThemeDark: ThemeTokens = {
  primary: "#FF6B35",
};
```

**After:**

```typescript
export const classicThemeDark: ThemeTokens = {
  primary: "#00D9FF", // New value
};
```

All components using `theme.$('primary')` will reflect the change immediately (with hot reload).

---

## Utilities Guide

### `colorUtils.ts` – Color Manipulation

```typescript
import { adjustBrightness, mixColors, tone } from "@/theme";

// Lighten a color
const lighter = adjustBrightness("#FF0000", 0.3); // delta > 0 = lighten

// Darken a color
const darker = adjustBrightness("#FF0000", -0.3); // delta < 0 = darken

// Mix two colors
const blended = mixColors("#FF0000", "#0000FF", 0.5); // 50% blend

// Generate tone variants (for hover, active, disabled states)
const tones = tone("#FF0000"); // Returns { light, medium, dark, subtle }
```

### `sizing.ts` – Spacing & Typography

```typescript
import { scale } from "@/theme";

const padding = scale.padding.md; // Standard padding
const fontSize = scale.font.lg; // Font size
const radius = scale.borderRadius.md; // Border radius

// Responsive breakpoints
const isMobile = scale.breakpoint.sm;
const isTablet = scale.breakpoint.md;
```

### `tokens.ts` – Token Helpers

```typescript
import { TOKENS } from "@/theme";

// All available tokens (for autocomplete)
const tokenName = TOKENS.primary;

// Token types for validation
type TokenName = keyof typeof TOKENS;
type ThemeTokens = Record<TokenName, string>;
```

---

## Integration

### ThemeProvider Setup

The app is wrapped with `ThemeProvider` in `app/_layout.tsx` (located in `/providers/ThemeProvider.tsx`):

```tsx
import { ThemeProvider } from "@/providers/ThemeProvider";

export default function RootLayout() {
  return <ThemeProvider>{/* Rest of app */}</ThemeProvider>;
}
```

### Persistence

Theme preferences (family + mode) are automatically saved to `SecureStorage`:

```typescript
STORAGE_KEYS.THEME_PREFERENCE; // Stores: 'classic', 'cyberpunk', etc.
STORAGE_KEYS.THEME_MODE; // Stores: 'light', 'dark'
```

On app restart, saved preferences are restored.

### Preload Themes

Non-critical theme assets (fonts, color maps) are preloaded in background:

```typescript
import { preloadThemes } from "@/theme";

// Called after app bootstrap (in AppKernel)
await preloadThemes();
```

---

## Best Practices

### ✅ Do

- Use `theme.$('tokenName')` for all colors (never hardcode hex)
- Use `scale.font.*`, `scale.padding.*` for sizing (never hardcode px)
- Define new tokens before implementing (add to `tokens.ts` first)
- Keep theme families consistent (implement all tokens in each family)
- Test themes in both light and dark modes

### ❌ Don't

- Hardcode colors: ~~`color: '#FF0000'`~~ → use `color: theme.$('danger')`
- Hardcode spacing: ~~`padding: 16`~~ → use `padding: scale.padding.md`
- Create one-off styles for a single component (add to tokens if reusable)
- Use different token names across themes (maintain consistent TOKENS enum)

---

## Troubleshooting

**Theme changes not appearing?**

- Clear app cache (web: DevTools → Storage → Clear All)
- Check that token is defined in `tokens.ts`
- Verify token is implemented in all theme families
- Reload component or restart app

**Token not found?**

- Add to `TOKENS` enum in `tokens.ts`
- Implement in all theme families
- Restart TypeScript server (Ctrl+Shift+P → Restart)

**Colors looking wrong on native?**

- Check that hex values are valid (use hex color picker)
- Ensure all theme families have same token names
- Test on real device (simulator colors can differ)

---

## Related

- [providers/ThemeProvider](../providers/ThemeProvider.tsx) – Theme provider implementation (now in /providers)
- [providers/ScaleProvider](../providers/ScaleProvider.tsx) – Sizing + responsive provider
- [lib/feature-flags](../lib/feature-flags/README.md) – Runtime feature toggles
- [components/ui](../components/ui) – UI components using theme
- [docs/COMPONENTS.md](../docs/COMPONENTS.md) – Component usage guide
