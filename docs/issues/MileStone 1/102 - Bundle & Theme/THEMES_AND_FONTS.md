# Themes & Fonts System

## Overview

The theme system provides a centralized way to manage colors, typography, and visual tokens across web and native platforms. Fonts are loaded appropriately for each platform: via CSS on web, via `expo-font` on native.

## Architecture

### Directory Structure

```
theme/
├── index.ts                    # Entry point, exports all themes and utilities
├── themeRegistry.ts            # Central registry of all available themes
├── ThemeProvider.tsx           # React provider for theme state management
├── tokens.ts                   # Token definitions (colors, sizes, typography)
├── families/
│   ├── Classic.ts              # Classic theme (default)
│   ├── Cyberpunk.ts            # Cyberpunk theme
│   └── Fantasy.md              # Fantasy theme (planned)
└── ultils/
    ├── colorUtils.ts           # Color manipulation helpers
    ├── sizing.ts               # Size calculation utilities
    ├── cssVars.ts              # CSS variable resolution
    └── tokens.ts               # Token resolution helpers

assets/fonts/
├── GrenzeGotisch.ttf           # Used by Classic & Fantasy themes
├── Eurostile.ttf               # Used by Cyberpunk theme
└── Cyberpunk.ttf               # Display font for Cyberpunk theme

public/
├── fonts.css                   # Web font declarations (@font-face)
├── GrenzeGotisch.ttf           # Copied from assets for web serving
├── Eurostile.ttf
└── Cyberpunk.ttf
```

### How Themes Work

#### Theme Structure

Each theme is a TypeScript object with `dark` and `light` variants:

```typescript
export const classicTheme = {
  dark: {
    [TOKENS.primary]: "#8b4513ff",
    [TOKENS.background]: "#2f353d",
    [TOKENS.textPrimary]: "#F5E6D3",
    // ... all other tokens
    [TOKENS.fontFamilyTitle]: "GrenzeGotisch",
    [TOKENS.fontFamily]: "GrenzeGotisch",
    [TOKENS.fontFamilyPara]: "HelveticaNeue",
  },
  light: {
    // Light mode variants
  },
};
```

#### Theme Registry

All themes are registered in `themeRegistry.ts`:

```typescript
export const allThemes = {
  classic: classicTheme,
  cyberpunk: cyberpunkTheme,
} as const;

export type ThemeFamilyName = keyof typeof allThemes;
```

#### Theme Provider

`ThemeProvider` in `app/_layout.tsx` manages theme state:

```tsx
<ThemeProvider>
  {/* App content */}
</ThemeProvider>
```

**Responsibilities:**
- Loads saved theme preference from `AsyncStorage`
- Provides `useTheme()` hook to access current tokens
- Syncs theme tokens to CSS variables on web (for instant theme switching)
- Persists theme changes to storage

#### Token Resolution

Tokens are accessed via the `$(tokenName)` helper or `useTheme()` hook:

```typescript
// In styles (React Native)
const { theme } = UseTheme();
const backgroundColor = theme.background;

// In CSS on web
backgroundColor: $('background')  // Resolves to CSS variable
```

### How Fonts Work

#### Web (CSS-based)

1. **Fonts defined in `public/fonts.css`:**
   ```css
   @font-face {
     font-family: 'GrenzeGotisch';
     src: url('/GrenzeGotisch.ttf') format('truetype');
     font-display: swap;
   }
   ```

2. **Fonts injected by bootstrap:**
   - `lib/utils/web-font-loader.ts` injects the stylesheet
   - Happens during app startup (non-blocking)
   - Fonts available globally via CSS `font-family` property

3. **Used by themes:**
   - Themes reference font families by name: `fontFamily: "GrenzeGotisch"`
   - CSS applies the fonts to components

#### Native (expo-font)

1. **Fonts loaded in bootstrap:**
   - `hooks/use-app-bootstrap.tsx` calls `Font.loadAsync()`
   - Critical fonts only (non-critical lazy-loaded later)
   - Fonts stored in `/assets/fonts/`

2. **Used by RN components:**
   - Set via `fontFamily` style property
   - Works identically to web, but loaded differently

## Adding a New Theme

### Step 1: Create Theme File

Create `theme/families/YourTheme.ts`:

```typescript
import { TOKENS, ThemeTokens } from "@/theme/tokens";

export type YourTheme = {
  dark: ThemeTokens;
  light: ThemeTokens;
};

export const yourTheme: YourTheme = {
  dark: {
    // Required: All TOKENS must be defined
    [TOKENS.primary]: "#YOUR_PRIMARY_COLOR",
    [TOKENS.background]: "#YOUR_BG_COLOR",
    [TOKENS.surface]: "#YOUR_SURFACE_COLOR",
    
    // Text
    [TOKENS.textPrimary]: "#YOUR_TEXT_COLOR",
    [TOKENS.textSecondary]: "#YOUR_SECONDARY_TEXT",
    [TOKENS.textInverse]: "#YOUR_INVERSE_TEXT",
    
    // Borders
    [TOKENS.border]: "#YOUR_BORDER_COLOR",
    [TOKENS.borderSubtle]: "#YOUR_SUBTLE_BORDER",
    
    // Accent
    [TOKENS.accent]: "#YOUR_ACCENT_COLOR",
    
    // Feedback
    [TOKENS.success]: "#YOUR_SUCCESS_COLOR",
    [TOKENS.warning]: "#YOUR_WARNING_COLOR",
    [TOKENS.danger]: "#YOUR_DANGER_COLOR",
    [TOKENS.info]: "#YOUR_INFO_COLOR",
    
    // Effects
    [TOKENS.shadow]: "rgba(0,0,0,0.2)",
    
    // Buttons
    [TOKENS.primaryButtonText]: "#YOUR_BUTTON_TEXT",
    [TOKENS.destructiveButton]: "#YOUR_DESTRUCTIVE_COLOR",
    [TOKENS.destructiveButtonText]: "#YOUR_DESTRUCTIVE_TEXT",
    [TOKENS.cancelButton]: "#YOUR_CANCEL_COLOR",
    [TOKENS.cancelButtonText]: "#YOUR_CANCEL_TEXT",
    
    // Typography
    [TOKENS.fontFamilyTitle]: "YourTitleFont",
    [TOKENS.fontFamily]: "YourBodyFont",
    [TOKENS.fontFamilyPara]: "YourParagraphFont",
  },
  light: {
    // Same structure, light mode colors
  },
};
```

### Step 2: Register Theme

Update `theme/families/index.ts`:

```typescript
export * from './YourTheme'
```

Update `theme/themeRegistry.ts`:

```typescript
import { yourTheme } from './families/YourTheme'

export const allThemes = {
  classic: classicTheme,
  cyberpunk: cyberpunkTheme,
  yourtheme: yourTheme,  // Add new theme
} as const;
```

### Step 3: Add Fonts (if needed)

#### For Web:

1. **Place font file in `public/`:**
   ```
   public/YourFont.ttf
   ```

2. **Add to `public/fonts.css`:**
   ```css
   @font-face {
     font-family: 'YourFont';
     src: url('/YourFont.ttf') format('truetype');
     font-weight: normal;
     font-style: normal;
     font-display: swap;
   }
   ```

#### For Native:

1. **Place font file in `assets/fonts/`:**
   ```
   assets/fonts/YourFont.ttf
   ```

2. **Add to critical fonts in `hooks/use-app-bootstrap.tsx`:**
   ```typescript
   const criticalFonts = {
     GrenzeGotisch: require("../assets/fonts/GrenzeGotisch.ttf"),
     YourFont: require("../assets/fonts/YourFont.ttf"),
   };
   ```

3. **Or lazy-load if non-critical:**
   ```typescript
   export const lazyFonts = {
     YourFont: require("../assets/fonts/YourFont.ttf"),
   };
   ```

### Step 4: Use Theme

The theme will automatically appear in the UI:

```typescript
import { UseTheme } from '@/theme';

export function Component() {
  const { family, setFamily } = UseTheme();
  
  return (
    <Button onPress={() => setFamily('yourtheme')}>
      Switch to Your Theme
    </Button>
  );
}
```

## Theme Tokens Reference

See `theme/tokens.ts` for complete token definitions. Common tokens:

| Token | Usage | Example |
|-------|-------|---------|
| `primary` | Primary brand color | Button backgrounds |
| `background` | App background | Screen background |
| `surface` | Card/panel background | Modal backgrounds |
| `textPrimary` | Primary text | Body text |
| `accent` | Accent color | Links, highlights |
| `success` | Success feedback | Green alerts |
| `warning` | Warning feedback | Yellow alerts |
| `danger` | Error feedback | Red alerts |
| `fontFamilyTitle` | Title fonts | Headings |
| `fontFamily` | Body fonts | Regular text |

## Best Practices

### Color Selection

- **Contrast:** Ensure sufficient contrast between text and background (WCAG AA minimum)
- **Consistency:** Keep the same primary color across related elements
- **Accessibility:** Test with color-blind simulators

### Font Pairing

- **Readability:** Pair decorative title fonts with readable body fonts
- **Web/Native:** Same family should work on both platforms
- **Loading:** Only use decorative fonts for titles, not body text

### Theme Variants

- **Light/Dark:** Always provide both variants for accessibility
- **Consistency:** Button colors should match the theme color scheme
- **Testing:** Test on both light and dark mode before shipping

## Troubleshooting

### Theme Not Applying

**Problem:** New theme not showing in selector  
**Solution:** Verify theme is exported from `themeRegistry.ts` and `index.ts`

### Fonts Not Displaying

**Problem:** Font shows as fallback on web  
**Solution:** 
- Check `public/fonts.css` has correct `@font-face` declaration
- Verify font file is in `public/` directory
- Hard refresh browser (Ctrl+Shift+R)

**Problem:** Font shows as fallback on native  
**Solution:**
- Verify font file is in `assets/fonts/`
- Ensure font is in `criticalFonts` or `lazyFonts` in bootstrap
- Rebuild app (native requires rebuild for asset changes)

### Theme Persistence Not Working

**Problem:** Theme resets on page refresh  
**Solution:** `ThemeProvider` automatically saves to `AsyncStorage`. Check browser Storage tab that storage is working.

## Related

- [Bundle Optimization Guide](../104%20-%20Bundle%20Optimization/LAZY_LOADING_GUIDE.md) — How themes are lazy-loaded
- `docs/COMPONENTS.md` — Component styling guide
- `lib/navigation/navigation-config.ts` — Theme selector location (Settings)
