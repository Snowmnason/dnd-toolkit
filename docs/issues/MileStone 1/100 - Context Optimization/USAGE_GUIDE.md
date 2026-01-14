# Context Optimization Usage Guide

## Overview

This guide explains how to use the optimized React context system in the dnd-toolkit app. The optimization splits contexts and provides granular selector hooks to minimize unnecessary re-renders.

## Context Architecture

### Stable vs Volatile Contexts

**Stable Context** (`AppParamsStableContext`):
- Contains: `userId`, `connectedWorldIds`
- Changes infrequently (login/logout, world connections)
- Persisted across app sessions

**Volatile Context** (`AppParamsVolatileContext`):
- Contains: `worldId`, `userRole`
- Changes frequently (navigation, world switching)
- Session-persisted (restored on app restart)

## Using Selector Hooks

### Basic Usage

Instead of consuming full contexts, use specific selector hooks:

```tsx
// ❌ Old approach (causes unnecessary re-renders)
import { useAppParams } from '@/contexts/AppParamsContext';

export function MyComponent() {
  const { params } = useAppParams();
  const { userId, worldId, userRole } = params;

  return <div>User: {userId}, World: {worldId}, Role: {userRole}</div>;
}

// ✅ New approach (only re-renders when specific values change)
import { useUserId, useWorldId, useUserRole } from '@/contexts/AppParamsStableContext';
import { useWorldId as useVolatileWorldId, useUserRole as useVolatileUserRole } from '@/contexts/AppParamsVolatileContext';

export function MyComponent() {
  const userId = useUserId();           // From stable context
  const worldId = useVolatileWorldId(); // From volatile context
  const userRole = useVolatileUserRole(); // From volatile context

  return <div>User: {userId}, World: {worldId}, Role: {userRole}</div>;
}
```

### Available Selector Hooks

#### Stable Context Selectors
```tsx
import {
  useUserId,
  useConnectedWorlds,
  useAppParamsStable  // Full context access (use sparingly)
} from '@/contexts/AppParamsStableContext';

// Get current user ID
const userId = useUserId();

// Get user's connected worlds
const connectedWorlds = useConnectedWorlds();

// Full stable context (rarely needed)
const { stableParams, setUserId, addConnectedWorld } = useAppParamsStable();
```

#### Volatile Context Selectors
```tsx
import {
  useWorldId,
  useUserRole,
  useAppParamsVolatile  // Full context access (use sparingly)
} from '@/contexts/AppParamsVolatileContext';

// Get current world ID
const worldId = useWorldId();

// Get current user role
const userRole = useUserRole();

// Full volatile context (rarely needed)
const { volatileParams, updateVolatileParams, clearWorldParams } = useAppParamsVolatile();
```

## Creating Custom Selectors

### Pattern for New Selectors

Add custom selectors to the appropriate context file:

```tsx
// In AppParamsStableContext.tsx
export function useCanEditWorld(worldId: string) {
  const { stableParams } = useAppParamsStable();
  return stableParams.userId && stableParams.connectedWorldIds.includes(worldId);
}

export function useOwnedWorlds() {
  const { stableParams } = useAppParamsStable();
  return stableParams.connectedWorldIds;
}

// Usage
const canEdit = useCanEditWorld('world-123');
const ownedWorlds = useOwnedWorlds();
```

### When to Create Custom Selectors

- **Multiple components** need the same derived value
- **Complex logic** that would be duplicated
- **Performance optimization** for frequently computed values

## State Management Patterns

### Updating State

#### Volatile State Updates
```tsx
import { useAppParamsVolatile } from '@/contexts/AppParamsVolatileContext';

export function WorldSelector() {
  const { updateVolatileParams, clearWorldParams } = useAppParamsVolatile();

  const selectWorld = (worldId: string, userRole: string) => {
    updateVolatileParams({ worldId, userRole });
  };

  const clearSelection = () => {
    clearWorldParams(); // Clears both worldId and userRole
  };

  return (
    <button onPress={() => selectWorld('world-123', 'player')}>
      Select World
    </button>
  );
}
```

#### Stable State Updates
```tsx
import { useAppParamsStable } from '@/contexts/AppParamsStableContext';

export function WorldConnector() {
  const { addConnectedWorld, removeConnectedWorld } = useAppParamsStable();

  const connectToWorld = (worldId: string) => {
    addConnectedWorld(worldId); // Automatically persisted
  };

  const disconnectFromWorld = (worldId: string) => {
    removeConnectedWorld(worldId); // Automatically persisted
  };

  return (
    <button onPress={() => connectToWorld('world-123')}>
      Connect to World
    </button>
  );
}
```

### State Colocation Guidelines

#### Keep in Global Context
- **User identity** (`userId`) - needed across screens
- **Current navigation context** (`worldId`, `userRole`) - needed for routing
- **Access permissions** (`connectedWorldIds`) - needed for guards

#### Keep in Local Component State
- **Modal visibility** (`showModal: boolean`)
- **Form state** (`inputValue: string`, `isValid: boolean`)
- **UI toggles** (`isExpanded: boolean`)
- **Loading states** (`isLoading: boolean`)

```tsx
// ✅ Correct: Local UI state
export function WorldCard({ worldId }: { worldId: string }) {
  const [showMenu, setShowMenu] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Global context for data
  const canEdit = useCanEditWorld(worldId);
  const userRole = useUserRole();

  return (
    <Card onLongPress={() => setShowMenu(true)}>
      {/* Component content */}
    </Card>
  );
}
```

## Component Optimization

### Memoizing Components

Use `React.memo` for components that receive stable props:

```tsx
import { memo } from 'react';

interface TopBarProps {
  title: string;
  showBackButton: boolean;
  userId?: string;
  worldId?: string;
}

const TopBar = memo(function TopBar({
  title,
  showBackButton,
  userId,
  worldId
}: TopBarProps) {
  // Component logic
  return <View>{/* TopBar content */}</View>;
});

export default TopBar;
```

### When to Memoize

- **Expensive renders**: Complex component trees
- **Frequent parent re-renders**: Components that would re-render unnecessarily
- **Stable props**: Props that don't change often

### When NOT to Memoize

- **Simple components**: Basic text/buttons
- **Frequently changing props**: Props that change on every render
- **One-time renders**: Components that render once and unmount

## Development and Debugging

### Re-render Tracking

Add render tracking to monitor performance:

```tsx
import { useRenderTracker } from '@/hooks/use-render-tracker';

export function MyComponent() {
  useRenderTracker('MyComponent');

  // Component logic
  return <div>Content</div>;
}
```

Enable via `config/appsettings.dev.json`:
```json
{
  "devTools": {
    "enablePerformanceLogger": true
  }
}
```

### React DevTools

Use React DevTools to:
- **Highlight updates**: Visualize which components re-render
- **Profiler**: Record and analyze render performance
- **Components tree**: Inspect context subscriptions

### Common Issues

#### Components Re-rendering Too Often
```tsx
// ❌ Problem: Inline object/array creation
const style = { color: 'red', fontSize: 16 };
const items = [1, 2, 3];

// ✅ Solution: Memoize or move outside component
const style = useMemo(() => ({ color: 'red', fontSize: 16 }), []);
const items = useMemo(() => [1, 2, 3], []);
```

#### Selector Hook Dependencies
```tsx
// ❌ Problem: Selector recreates on every render
export function useCustomSelector() {
  const context = useAppParamsStable();
  return context.stableParams.userId; // Creates new reference each time
}

// ✅ Solution: Use primitive selector
export function useCustomSelector() {
  return useUserId(); // Returns stable primitive
}
```

## Migration Guide

### Converting Existing Components

1. **Identify context usage**:
   ```tsx
   const { params } = useAppParams();
   ```

2. **Replace with selectors**:
   ```tsx
   const userId = useUserId();
   const worldId = useWorldId();
   const connectedWorlds = useConnectedWorlds();
   ```

3. **Update state setters**:
   ```tsx
   // Old
   updateParams({ worldId: 'new-world' });

   // New
   const { updateVolatileParams } = useAppParamsVolatile();
   updateVolatileParams({ worldId: 'new-world' });
   ```

4. **Test component behavior**:
   - Verify re-renders only when necessary
   - Check functionality still works
   - Monitor performance improvements

### Testing Migration

When Jest and @testing-library/react are set up, use these test utilities:

```tsx
import { renderHook } from '@testing-library/react';
import { AppParamsStableProvider } from '@/contexts/AppParamsStableContext';

const wrapper = ({ children }: any) => (
  <AppParamsStableProvider>{children}</AppParamsStableProvider>
);

it('should work with new selectors', () => {
  const { result } = renderHook(() => useUserId(), { wrapper });
  expect(result.current).toBeUndefined();
});
```

## Best Practices

### Performance
- **Prefer selectors over full context**: `useUserId()` vs `useAppParamsStable()`
- **Memoize expensive computations**: Use `useMemo` for derived values
- **Avoid inline objects/arrays**: Can cause unnecessary re-renders

### Maintainability
- **Create custom selectors**: For complex derived state
- **Document selector usage**: Explain what each selector returns
- **Test selectors**: Unit tests for custom selector logic

### Developer Experience
- **Use TypeScript**: Full type safety with selector hooks
- **Follow naming conventions**: `use[Property]()` for selectors
- **Keep contexts focused**: One responsibility per context

## Troubleshooting

### Component Not Re-rendering When Expected

**Problem**: Component doesn't update when context changes
**Solution**: Check if using correct selector hook

```tsx
// ❌ Wrong context
const userId = useUserId(); // From stable context
// But component needs volatile data

// ✅ Correct context
const worldId = useWorldId(); // From volatile context
```

### Too Many Re-renders

**Problem**: Component re-renders excessively
**Solutions**:
1. Use specific selectors instead of full context
2. Memoize component with `React.memo`
3. Check for unstable references in props

### Context Not Available

**Problem**: `useAppParamsStable must be used within AppParamsStableProvider`
**Solution**: Ensure component is within provider tree

```tsx
// Check provider nesting in app/_layout.tsx
<AppParamsStableProvider>
  <AppParamsVolatileProvider>
    <YourComponent /> {/* Can use all selectors */}
  </AppParamsVolatileProvider>
</AppParamsStableProvider>
```

## Future Extensions

### Adding New Context Properties

1. **Decide context type**: Stable vs volatile
2. **Add to interface**: Update context type definitions
3. **Implement persistence**: For stable properties
4. **Create selector**: Add `use[Property]()` hook
5. **Update components**: Migrate usage to new selector

### Performance Monitoring

Consider adding production monitoring:

```tsx
// Track selector usage in production
export function useUsageTracker(selectorName: string) {
  useEffect(() => {
    // Report selector usage to analytics
  }, []);
}
```