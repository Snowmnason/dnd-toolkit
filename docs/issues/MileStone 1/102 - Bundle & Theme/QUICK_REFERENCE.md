# Quick Reference: Themes, Fonts & Lazy Loading

## Adding a New Theme - Quick Start

1. **Create `theme/families/MyTheme.ts`:**
   ```typescript
   export const myTheme = {
     dark: { [TOKENS.primary]: "#color", /* all tokens */ },
     light: { /* ... */ },
   };
   ```

2. **Register in `theme/themeRegistry.ts`:**
   ```typescript
   import { myTheme } from './families/MyTheme'
   export const allThemes = {
     classic: classicTheme,
     mytheme: myTheme,  // Add here
   };
   ```

3. **Add fonts (if needed):**
   - Web: Place in `public/`, add @font-face to `public/fonts.css`
   - Native: Place in `assets/fonts/`, add to bootstrap

Done! Theme appears in settings automatically.

## Lazy Loading - Quick Start

### Load on Demand
```typescript
import { lazyLoad } from '@/lib/utils/lazy-imports';

const module = await lazyLoad(
  () => import('./HeavyModule'),
  'HeavyModule'
);
```

### Load in Background
```typescript
import { lazyLoadInBackground } from '@/lib/utils/lazy-imports';

lazyLoadInBackground(
  () => import('./Module'),
  'Module'
).catch(err => console.warn('Failed to load'));
```

### Load React Component
```typescript
import { createLazyComponent } from '@/lib/utils/lazy-imports';

export default createLazyComponent(
  () => import('./HeavyComponent'),
  'HeavyComponent'
);
```

## Token List (Partial)

```typescript
TOKENS.primary              // Main brand color
TOKENS.background           // Screen background
TOKENS.surface              // Card/modal background
TOKENS.textPrimary          // Main text color
TOKENS.accent               // Accent/highlight color
TOKENS.success              // Green/success color
TOKENS.warning              // Yellow/warning color
TOKENS.danger               // Red/error color
TOKENS.fontFamilyTitle      // For headings
TOKENS.fontFamily           // For body text
TOKENS.fontFamilyPara       // Alternative body font
```

See `theme/tokens.ts` for complete list.

## Using Theme in Components

```typescript
import { UseTheme } from '@/theme';

export function MyComponent() {
  const { theme, family, setFamily } = UseTheme();
  
  return (
    <Text style={{ color: theme.textPrimary }}>
      Current: {family}
    </Text>
  );
}
```

## Bootstrap Performance

Current: ~14ms to App Ready

- Fonts: ~8ms (web injection or native load)
- Platform: <1ms
- Themes: Background (365ms, non-blocking)
- Sentry: Background (if enabled)

## File Locations Cheat Sheet

| What | Where |
|------|-------|
| Theme definitions | `theme/families/` |
| Font files (web) | `public/` |
| Font files (native) | `assets/fonts/` |
| Lazy-load utilities | `lib/utils/lazy-imports.ts` |
| Bootstrap config | `hooks/use-app-bootstrap.tsx` |
| Sentry setup | `app/_layout.tsx` |
| Web fonts CSS | `public/fonts.css` |

## Common Tasks

### Add a new theme color
Edit theme file, add to both `dark` and `light` modes:
```typescript
[TOKENS.myColor]: "#hexcolor"
```

### Change theme fonts
Update tokens in theme file:
```typescript
[TOKENS.fontFamilyTitle]: "NewFont"
[TOKENS.fontFamily]: "NewFont"
```

### Disable a heavy module
Remove static import, check for lazy loading:
```typescript
// Remove this line if it exists
import * as Module from 'module';

// Make sure it's using lazyLoad or lazyLoadInBackground
```

### Check if something is lazy-loaded
Search for the module name with `lazyLoad`:
```bash
grep -r "lazyLoad.*ModuleName" src/
```

## Debugging

### Check if theme loaded
```typescript
const { theme } = UseTheme();
console.log('Current theme:', theme);
```

### Check if fonts loaded (web)
Open DevTools → Elements → Search for `fonts.css`

### Check if fonts loaded (native)
Check logs for: `[BOOTSTRAP] 🌐 Web fonts stylesheet injected`

### Check lazy-load status
Enable logs in bootstrap:
```typescript
const BOOTSTRAP_LOGS = true;  // In use-app-bootstrap.tsx
```

Check console for:
```
[lazy-load] ✅ Module loaded (234ms)
```
