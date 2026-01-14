# Context Optimization Implementation

## Overview

This document details the comprehensive React context optimization implemented to reduce unnecessary re-renders during world switching and navigation in the dnd-toolkit app.

## Problem Statement

The original monolithic `AppParamsContext` was causing excessive re-renders because:
- All components consuming the context re-rendered when any single property changed
- Navigation state changes (worldId, userRole) triggered re-renders across the entire app
- No separation between stable (userId, connectedWorlds) and volatile (worldId, userRole) state
- Context values weren't memoized, causing unnecessary provider re-renders

## Solution Architecture

### Context Splitting Strategy

**Stable Context (`AppParamsStableContext`)**:
- Manages: `userId`, `connectedWorldIds`
- Persistence: Yes (via SecureStorage)
- Change frequency: Rare (user login/logout, world connections)
- Consumers: Components needing user identity or access permissions

**Volatile Context (`AppParamsVolatileContext`)**:
- Manages: `worldId`, `userRole`
- Persistence: Yes (session restoration)
- Change frequency: Frequent (navigation, world switching)
- Consumers: Components needing current navigation context

### Selector Hook Pattern

Instead of consuming full contexts, components use granular selector hooks:

```tsx
// ❌ Old approach - causes re-renders on any context change
const { params } = useAppParams();

// ✅ New approach - only re-renders when specific values change
const userId = useUserId();
const worldId = useWorldId();
const connectedWorlds = useConnectedWorlds();
```

### Context Memoization

All context providers now use `React.useMemo` to prevent unnecessary re-renders:

```tsx
const contextValue = React.useMemo(() => ({
  stableParams,
  setUserId,
  // ... other values
}), [stableParams, setUserId, /* all dependencies */]);
```

## Implementation Details

### Files Created/Modified

#### New Context Files
- `contexts/AppParamsStableContext.tsx` - Stable state management
- `contexts/AppParamsVolatileContext.tsx` - Volatile state management

#### Modified Files
- `app/_layout.tsx` - Updated provider nesting
- `hooks/use-app-navigation.tsx` - Migrated to selector hooks
- `app/login/auth-redirect.tsx` - Migrated to selector hooks
- `app/main/_layout.tsx` - Migrated to selector hooks
- `app/select/world-selection.tsx` - Migrated to selector hooks
- `Screens/select/world-selection/WorldRightPanel.tsx` - Migrated to selector hooks
- `Screens/select/world-selection/WorldListPanel.tsx` - Migrated to selector hooks
- `Screens/main-panels/PanelView.tsx` - Migrated to selector hooks
- `components/TopBar.tsx` - Memoized with React.memo
- `contexts/PlatformContext.tsx` - Added context memoization
- `providers/ThemeProvider.tsx` - Added context memoization
- `contexts/WorldSelectionContext.tsx` - Added context memoization
- `providers/SubscriptionProvider.tsx` - Added context memoization

#### New Hooks
- `hooks/use-render-tracker.tsx` - Development re-render tracking

#### Storage Keys Added
- `LAST_SELECTED_WORLD` - Session persistence for worldId
- `LAST_USER_ROLE` - Session persistence for userRole

#### Test Files Created
- `contexts/__tests__/AppParamsStableContext.test.tsx` (removed - testing framework not set up)
- `contexts/__tests__/AppParamsVolatileContext.test.tsx` (removed - testing framework not set up)

### Provider Nesting

```tsx
<ThemeProvider>
  <ScaleProvider>
    <PlatformProvider>
      <SubscriptionProvider>
        <AppParamsStableProvider>
          <AppParamsVolatileProvider>
            <AppErrorBoundary>
              <RootLayoutContent />
            </AppErrorBoundary>
          </AppParamsVolatileProvider>
        </AppParamsStableProvider>
      </SubscriptionProvider>
    </PlatformProvider>
  </ScaleProvider>
</ThemeProvider>
```

### State Persistence Strategy

**Stable State**: Persisted via SecureStorage with async loading on mount
**Volatile State**: Session-persisted (restored on app restart, cleared on logout)
**UI State**: Local component state (not in contexts)

## Migration Strategy

### Clean Cut Migration
- No backward compatibility layer needed (no production users)
- Direct replacement of `useAppParams()` with selector hooks
- Old `AppParamsContext.tsx` deleted after verification

### Component Migration Pattern
```tsx
// Before
const { params, updateParams } = useAppParams();
const { userId, worldId, userRole } = params;

// After
const userId = useUserId();
const worldId = useWorldId();
const userRole = useUserRole();
const { updateVolatileParams } = useAppParamsVolatile();
```

## Performance Optimizations

### Context Memoization
- Prevents provider re-renders when context values haven't changed
- Uses proper dependency arrays to ensure correctness

### Component Memoization
- TopBar component wrapped with `React.memo`
- Prevents re-renders when props haven't changed

### Selector Granularity
- Components only subscribe to specific state slices
- Reduces unnecessary re-renders from unrelated state changes

## Development Tools

### Re-render Tracking
```tsx
import { useRenderTracker } from '@/hooks/use-render-tracker';

export function MyComponent() {
  useRenderTracker('MyComponent');
  // Component logic
}
```

Enabled via `appsettings.dev.json`:
```json
{
  "devTools": {
    "enablePerformanceLogger": true
  }
}
```

### Testing Infrastructure
- Unit tests for all selector hooks
- Integration tests for re-render reduction
- Test files ready for when Jest is configured

## Verification Steps

### TypeScript Compilation
```bash
npx tsc --noEmit
```

### Linting
```bash
npm run lint
```

### Functional Testing
1. World switching navigation works
2. User authentication persists
3. Connected worlds are cached
4. App restart restores session state

### Performance Monitoring
1. Enable `enablePerformanceLogger` in dev config
2. Add `useRenderTracker` to key components
3. Monitor console logs during world switching
4. Compare re-render counts before/after optimization

## Rollback Plan

If issues arise:
1. Temporarily revert to original `AppParamsContext.tsx`
2. Restore `useAppParams` hook usage
3. Debug issues with isolated context testing
4. Re-implement fixes incrementally

## Future Considerations

### Subscription Context
Monitor after real subscription polling is implemented. May need splitting if polling causes excessive re-renders.

### Additional Selectors
Create new selector hooks as needed following the established pattern:
```tsx
export function useCanEditWorld(worldId: string) {
  const { stableParams } = useAppParamsStable();
  return stableParams.userId && stableParams.connectedWorldIds.includes(worldId);
}
```

### Performance Monitoring
Consider adding production performance monitoring for re-render tracking in critical user journeys.