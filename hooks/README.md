# Hooks Layer

React hooks providing UI-focused data formatting, error handling, and state management. Acts as the boundary between presentation components and business logic, ensuring clean separation of concerns.

## When to Use This Module

**Use this module if you need:**

- Data fetching with loading states and error handling for UI
- Mutation operations with optimistic updates and rollback
- Navigation helpers and route state management
- UI state management (theme, scale, notifications)
- Feature flag checks in components
- Asset loading and caching for images
- Authentication guards and user state
- Real-time subscriptions and updates

**Do NOT use this module for:**

- Business logic operations (use lib/ managers)
- Low-level data transformations (keep in components)
- Side effects without UI updates (use lib/ services)
- Platform-specific code (use system/ modules)

## Architecture & Data Flow

```
Screens/Components
    ↓ (call hooks)
Hooks Layer (this module)
    ↓ (call managers)
Lib Managers (business logic)
    ↓ (call middleware)
System Layer (transport)
```

**Data Flow Pattern:**

1. **Hooks** - Format data for UI, handle loading/errors, call managers
2. **Managers** - Orchestrate operations, validate data, coordinate services
3. **Middleware** - Network checks, data normalization, logging
4. **System** - Pure HTTP transport, caching, retries

**Hook Lifecycle:**
- Pre-operation: Call manager with validated data
- During operation: Handle loading states, optimistic updates
- Post-operation: Update UI state, handle errors, trigger side effects

## API Reference

### Navigation Hooks

```typescript
useAppNavigation(): {
  navigate: (route: RouteName, params?: RouteParams) => void;
  goBack: () => void;
  reset: (route: RouteName) => void;
}
```

### Query Hooks

```typescript
useWorldsQuery(options?: QueryOptions): {
  data: World[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}
```

### Mutation Hooks

```typescript
useCreateWorldMutation(): {
  mutate: (data: CreateWorldData) => void;
  isLoading: boolean;
  error: Error | null;
  reset: () => void;
}
```

### UI Hooks

```typescript
useTheme(): ThemeTokens;
useScale(): ScaleValues;
useToast(): ToastActions;
```

## Dependencies

**External packages:**
- `react` - React hooks and state management
- `@tanstack/react-query` - Data fetching and caching
- `react-native-reanimated` - Animations (where used)

**Internal lib dependencies:**
- `@/lib/auth` - Authentication state
- `@/lib/navigation` - Route configuration
- `@/lib/feature-flags` - Feature flag evaluation
- `@/lib/analytics` - Event tracking
- `@/lib/error` - Error reporting

## Error Handling & Edge Cases

**Network errors:** Hooks automatically handle network failures and provide user-friendly error messages through the `error` property.

**Authentication errors:** Auth hooks redirect to login on session expiry. Use `useAuthGuard()` to protect routes.

**Loading states:** All async hooks provide `isLoading` state. Use loading overlays for better UX.

**Edge cases:**
- Offline mode: Queries return cached data when available
- Rate limiting: Mutations handle 429 responses with retry logic
- Data conflicts: Optimistic updates rollback on failure

## Performance Notes

**Caching:** Query hooks use React Query for intelligent caching and background refetching.

**Re-renders:** Hooks minimize re-renders through selector patterns and memoization.

**Bundle size:** Tree-shake unused hooks by importing from category barrels (e.g., `@/hooks/queries`).

**Memory:** Asset hooks implement viewport tracking to avoid loading off-screen images.

## Related Modules

- **lib/auth/** - Authentication operations called by auth hooks
- **lib/navigation/** - Route management called by navigation hooks  
- **lib/feature-flags/** - Feature evaluation called by feature hooks
- **components/ui/** - UI components that consume these hooks
- **system/Storage/** - Storage layer used by persistence hooks

## File Breakdown

| File | Purpose |
|------|---------|
| `index.ts` | Barrel exports for all hooks |
| `queries/` | Data fetching hooks (React Query integration) |
| `mutations/` | Data modification hooks (optimistic updates) |
| `navigation/` | Route management and navigation helpers |
| `auth/` | Authentication state and route guards |
| `ui/` | Theme, scale, and UI state management |
| `feature/` | Feature flag evaluation hooks |
| `assets/` | Image loading and caching hooks |
| `analytics/` | Event tracking hooks |
| `error/` | Error boundary and reporting hooks |
| `storage/` | Local storage persistence hooks |
| `utils/` | Utility hooks (debounce, throttle, etc.) |

## Testing

**Unit tests:** Each hook has corresponding test files in `__tests__/hooks/`. Tests mock lib managers and verify UI behavior.

**Integration tests:** Test hook-to-manager integration in `e2e/` tests.

**Manual testing:** Use React DevTools Profiler to verify re-render behavior and performance.

## Future Enhancements

- Real-time subscription hooks for live data updates
- Advanced caching strategies for offline-first apps
- Hook composition utilities for complex state management
- Performance monitoring and analytics integration

---

*This module follows the canonical README structure defined in `docs/README_STYLE_GUIDE.md`.*

