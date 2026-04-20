# Components

React components organized by purpose and complexity. Components follow consistent patterns for theming, accessibility, and performance.

## Organization

### `/ui` - Core UI Components
Reusable, theme-integrated components for common UI patterns. All components exported via barrel export.

**Import from barrel:**
```typescript
import { Button, Card, TextInput, Modal } from '@/components/ui';
```

### `/auth_components` - Authentication UI
Login, signup, and auth-related forms and components.

### `/modals` - Modal Components
Full-screen modals and overlays for complex interactions.

### `/offline` - Offline Components
Components for offline state handling and sync indicators.

### `/built-in` - Built-in Components
Platform-specific or complex components that don't fit in ui/.

## Component Patterns

### Theming
All components use theme tokens via `UseTheme()` hook:
```tsx
const theme = UseTheme();
return <View style={{ backgroundColor: theme.$("background") }} />;
```

### Accessibility
Components include proper ARIA labels, focus management, and keyboard navigation.

### Performance
Components use `React.memo()`, `useMemo()`, and `useCallback()` where appropriate.

## When to Create a Component

**Create a component when:**
- UI pattern is used in 3+ places
- Component has complex state or effects
- Component needs theming or responsive behavior
- Component encapsulates business logic

**Don't create a component for:**
- One-off UI elements (use inline JSX)
- Simple wrappers (use styled components)
- Data-only components (use hooks instead)