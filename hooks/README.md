# hooks

**Custom React hooks for navigation, data fetching, authentication, and app state.**

Reusable logic for queries, mutations, UI state, and app-specific behaviors. All hooks are app-ready and follow React hooks rules (no conditional calls).

---

## Quick Start

### Importing Hooks

All hooks can be imported from the main barrel export:

```tsx
// ✅ Recommended: Import directly from @/hooks
import {
  useWorldsQuery,
  useCreateWorldMutation,
  useAppNavigation,
  useScale,
} from "@/hooks";

// Also works: Import from specific category
import { useWorldsQuery } from "@/hooks/queries";
import { useCreateWorldMutation } from "@/hooks/mutations";
import { useAppNavigation } from "@/hooks/navigation";
```

### Navigation & App State

| Hook                       | Purpose                                                                                                                                              |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useAppNavigation()`       | Navigate with automatic context param management and route validation. Merges contextual data (userId, worldId, role) into navigation automatically. |
| `useAnalyticsNavigation()` | Wrapper around `useAppNavigation()` that tracks navigation events to analytics. Use for tracking user flows and user journeys.                       |
| `usePanelNavigation()`     | Mobile panel/modal navigation state. Manages opening/closing side panels or modal views on mobile layouts.                                           |
| `useSuccessNavigation()`   | Navigation after operation success (world creation, invite join). Shows success modal and navigates to success screen.                               |

### Authentication & Authorization

| Hook                             | Purpose                                                                                                                            |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `useAuthContext()`               | Access session, profile, and login state from auth provider. Returns `{ session, profile, isLoading, isLoggedIn }`.                |
| `useAuthStatus()`                | Check if user is authenticated and if session is valid. Lightweight wrapper over AuthContext for simple auth checks.               |
| `usePremiumFeature(featureKey?)` | Check if current user has access to premium features. Returns `{ isPremium, isAvailable, loading }` with feature entitlement info. |

### Data Queries

| Hook                      | Purpose                                                                                                         |
| ------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `useWorldsQuery(options)` | Fetch user's accessible worlds with pagination. Returns `{ data, isLoading, error, refetch }` with worlds list. |
| `useWorlds(options)`      | Alternative hook for world data (may be deprecated). Similar to `useWorldsQuery()`.                             |
| `useCurrentUserQuery()`   | Fetch current logged-in user profile and settings. Returns user object with full profile data.                  |
| `useUserQuery(userId)`    | Fetch specific user by ID (public profile info). Returns user object or null if not found.                      |

### Data Mutations

| Hook                               | Purpose                                                                                                                      |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `useCreateWorldMutation()`         | Create new world with name, description, settings. Returns mutation function with loading/error states and success callback. |
| `useUpdateWorldMutation()`         | Update existing world properties (name, description, settings). Returns mutation with optimistic updates.                    |
| `useDeleteWorldMutation()`         | Delete world and associated data. Returns mutation with confirmation prompt and cleanup.                                     |
| `useUpdateUserMutation()`          | Update current user profile (name, preferences, settings). Returns mutation with immediate local updates.                    |
| `useDeleteAccountMutation()`       | Delete user account and all associated data (irreversible). Returns mutation with multi-step confirmation.                   |
| `useCreateInviteLinkMutation()`    | Generate shareable invite link for world. Returns link URL and copy-to-clipboard helper.                                     |
| `useValidateInviteTokenMutation()` | Validate and join world via invite token. Returns join status and world data if successful.                                  |

### World Interaction

| Hook                     | Purpose                                                                                                           |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `useWorldCreation()`     | Full world creation flow (form, validation, submission, success). Encapsulates multi-step world creation logic.   |
| `useWorldModal(options)` | Control world selection or creation modal state and visibility. Returns `{ isOpen, open, close, selectedWorld }`. |

### UI & Rendering

| Hook                              | Purpose                                                                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `useScale(options?)`              | Get responsive sizing tokens (fonts, spacing, breakpoints) based on screen size. Returns scale object with font, space, breakpoint values. |
| `useThemeSwitcher()`              | Manage theme family and mode (light/dark) switching. Returns `{ family, mode, setFamily, setMode }` with current theme.                    |
| `useSplashScreen()`               | Control splash screen visibility during app bootstrap. Shows/hides splash while app initializes.                                           |
| `useRenderTracker(componentName)` | Track component render count for performance debugging (dev only). Logs render count to console with component name.                       |

### Image & Asset Loading

| Hook                           | Purpose                                                                                                                 |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `useImageCache()`              | In-memory image cache with TTL and size limits. Returns `{ get, set, clear, prefetch, getStats }` for cache management. |
| `usePrefetchImage(imageUrl)`   | Preload image into memory cache (fires in background). Improves perceived performance when image is rendered later.     |
| `useViewportTracking(options)` | Track which images are visible in viewport (lazy loading). Returns visibility state for each image ID.                  |

### Feature Flags & Configuration

| Hook                                         | Purpose                                                                                                                                                                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `useFeatureFlag(flagName)`                   | Check if feature is enabled (respects runtime toggles and beta status). Subscribes to flag changes and re-renders on toggle.                                                                                             |
| `useFeatureFlags(flagName, fallback?)`       | Access a specific server-synced feature flag. Returns `{ enabled, loading, error, source }` for the given flag. Re-renders on flag updates.                                                                              |
| `useEntitlement(name, userId, autoRefresh?)` | Check premium entitlement status with clock safety. Returns `{ granted, loading, error?, expiresAt? }`. Optional auto-refresh polling (default: false). Fetches fresh on mount, dependencies, or at configured interval. |

### Notifications

| Hook                 | Purpose                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `useNotifications()` | Queue, display, and dismiss toast/snackbar notifications. Returns `{ toast, success, error, info }` notification methods. |

---

## Common Patterns

### Fetching Data

```tsx
import { useWorldsQuery } from "@/hooks";

export function MyWorlds() {
  const {
    data: worlds,
    isLoading,
    error,
  } = useWorldsQuery({ page: 1, limit: 10 });

  if (isLoading) return <Text>Loading...</Text>;
  if (error) return <Text>Error: {error.message}</Text>;

  return worlds.map((w) => <Text key={w.id}>{w.name}</Text>);
}
```

### Mutations with Optimistic Updates

```tsx
import { useUpdateWorldMutation } from "@/hooks";

export function EditWorld({ worldId, name }) {
  const mutation = useUpdateWorldMutation();

  const handleUpdate = () => {
    mutation.mutate(
      { worldId, name },
      {
        onSuccess: () => {
          // World updated on server
        },
      },
    );
  };

  return (
    <Button
      onPress={handleUpdate}
      disabled={mutation.isLoading}
      title={mutation.isLoading ? "Saving..." : "Save"}
    />
  );
}
```

### Checking Premium Status

```tsx
import { usePremiumFeature } from "@/hooks";

export function AdvancedFeature() {
  const { isPremium, isAvailable, loading } =
    usePremiumFeature("advanced_feature");

  if (loading) return <Text>Checking...</Text>;
  if (!isAvailable) return <Text>Premium feature only</Text>;

  return <AdvancedFeatureComponent />;
}
```

### Feature Flags

```tsx
import { useFeatureFlag } from "@/hooks";

export function MyComponent() {
  const isNewUIEnabled = useFeatureFlag("newUI");

  return isNewUIEnabled ? <NewUI /> : <OldUI />;
}
```

---

## Best Practices

### ✅ Do

- Use specific mutation/query hooks (don't build queries manually with fetch)
- Handle loading and error states explicitly
- Memoize callback dependencies in hook options
- Test hooks in isolation with mock providers
- Use `useRenderTracker()` in dev to identify unnecessary re-renders

### ❌ Don't

- Call hooks conditionally (must call at top level of component)
- Ignore loading states (show spinners, disable buttons)
- Retry mutations without user action (risk infinite loops)
- Cache data in component state (use React Query cache instead)
- Mix query and mutation logic in components

---

## File Structure

```
hooks/
├── index.ts                          # Main barrel export (re-exports all categories)
├── queries/                          # Data fetching hooks
│   ├── index.ts                      # Barrel export
│   ├── use-worlds-query.tsx          # Fetch user's worlds with pagination
│   ├── use-worlds.ts                 # Alternative world query hook
│   └── use-users-query.tsx           # Fetch current user or specific user
├── mutations/                        # Data modification hooks
│   ├── index.ts                      # Barrel export
│   ├── use-worlds-mutation.tsx       # Create/update/delete worlds
│   ├── use-users-mutation.tsx        # Update user profile/delete account
│   └── use-invites-mutation.tsx      # Create invite links, validate tokens
├── navigation/                       # Navigation & routing hooks
│   ├── index.ts                      # Barrel export
│   ├── use-app-navigation.tsx        # Core navigation with context params
│   ├── use-analytics-navigation.tsx  # Navigation with analytics tracking
│   ├── use-panel-navigation.tsx      # Mobile panel/modal navigation
│   └── use-success-navigation.tsx    # Post-success navigation flow
├── auth/                             # Authentication & authorization hooks
│   ├── index.ts                      # Barrel export
│   ├── use-auth-context.tsx          # Access auth state from provider
│   ├── use-auth-status.tsx           # Simple auth status checks
│   └── use-premium-feature.ts        # Premium feature entitlement
├── ui/                               # UI & rendering hooks
│   ├── index.ts                      # Barrel export
│   ├── useScale.ts                   # Responsive sizing tokens
│   ├── useThemeSwitcher.ts           # Theme family/mode switching
│   ├── use-splash-screen.tsx         # Splash screen control
│   └── use-render-tracker.tsx        # Dev-only render tracking
├── assets/                           # Asset & image loading hooks
│   ├── index.ts                      # Barrel export
│   ├── use-image-cache.tsx           # In-memory image caching
│   └── use-viewport-tracking.tsx     # Viewport-based lazy loading
└── utils/                            # Utility hooks
    ├── index.ts                      # Barrel export
    ├── use-feature-flag.ts           # Runtime feature flag checking
    ├── use-notifications.tsx         # Toast/snackbar notifications
    ├── use-world-creation.tsx        # Full world creation flow
    └── use-world-modal.tsx           # World selection/creation modal
```

---

## Important Notes

### Image Loading

- Prefer `usePrefetchImage()` for images needed soon (hero images, backgrounds)
- Use `useViewportTracking()` for lists with many images (galleries, feeds)
- `useImageCache()` has 50MB limit and 1-hour TTL by default

### Premium Features

- Currently uses cached subscription data (no auto-refresh)
- Consider adding refresh mechanism when backend is ready
- Always check `isAvailable` before rendering premium UI

### Mutations

- All mutations return `{ mutate, isLoading, error, data }` (React Query style)
- Pass options object with `onSuccess`, `onError` callbacks
- Optimistic updates happen locally; server response updates cache

### Notifications

- Use `useNotifications()` for transient user feedback (success, errors)
- Avoid full-screen overlays (use toast/snackbar only)
- Auto-dismisses after 3-4 seconds

---

## Related

- [providers/](../providers/) – Context providers (Auth, Theme, Scale, etc.)
- [lib/navigation/](../lib/navigation/) – Route config and navigation helpers
- [lib/premium/](../lib/premium/) – Premium features and subscription logic
- [lib/feature-flags.ts](../lib/feature-flags.ts) – Feature flag definitions
- [docs/COMPONENTS.md](../docs/COMPONENTS.md) – UI components guide
