# lib/navigation/routes

App-specific route configurations organized by screen area. Defines TopBar appearance, back button behavior, modals, redirects, and animations for each route in the app.

## When to Use This Module

**Use this module to:**

- Define route configuration for new screens and features
- Organize routes by functional area (login, main, settings, etc.)
- Specify TopBar titles, back buttons, and animations per route
- Add conditional redirects (e.g., unauthorized access)
- Configure modal vs. full-screen navigation
- Set analytics tracking names for routes
- Define required URL parameters per route

**Do NOT use this for:**

- Global navigation logic (see `lib/navigation/navigation-config.ts`)
- URI building or parameter handling (see `lib/navigation/uri-helpers.ts`)
- Authentication/authorization (see `lib/routing/AUTH_CONFIG`)
- URL matching algorithms (handled by navigation-config)

## Architecture & Data Flow

```
App Route Transition
        ↓
Expo Router triggers navigation
        ↓
navigation-config.ts reads from routes/*.ts
        ↓
getRouteConfig() matches current route against RouteConfig array
        ↓
Returns TopBar title, back button, modal config, redirects, etc.
        ↓
Renderer displays TopBar + screen with resolved configuration
```

**Organization Pattern:**

Routes are split by screen area (functional grouping):

- `login-routes.ts` – Authentication flows (sign-in, sign-up, forgot password)
- `select-routes.ts` – World/campaign selection screens
- `main-routes.ts` – Core app screens (characters, NPCs, spells, etc.)
- `settings-routes.ts` – User settings and preferences
- `web-routes.ts` – Web-only public pages (landing, about, etc.)

Each file exports `RouteConfig[]` and is merged into `ROUTE_CONFIGS` in `navigation-config.ts`.

## API Reference

### `RouteConfig` Interface

Configuration for a single route or route group.

```ts
export interface RouteConfig {
  // Required
  path: string; // Route path: "/main/characters" or "/" for root
  title: string | ((context) => string); // TopBar title (can be dynamic)

  // Optional: Display
  showTopBar?: boolean; // Show TopBar (default: true; false for login)
  showHamburger?: boolean; // Show hamburger menu button (default: false)

  // Optional: Navigation
  back?: string | ((context) => string); // Back button target or handler
  aliases?: string[]; // Alternative paths for same route
  preserveParamsOnBack?: string[]; // Params to preserve when back navigating

  // Optional: Control Flow
  requiredParams?: string[]; // URL params required for this route
  redirectIf?: (context) => string | undefined; // Conditional redirect (e.g., auth)
  modal?: ModalConfig; // Is this route a modal?

  // Optional: UX
  animation?: AnimationType; // Transition animation ("slide", "fade", "modal", "none")
  a11yFocusTarget?: A11yFocusTarget; // Focus on "title", "firstInteractive", or "none"

  // Optional: Analytics & Debugging
  analyticsName?: string; // Tracking name for analytics
  onError?: (error, context) => void; // Custom error handler
}
```

### Example: Login Routes

```ts
// lib/navigation/routes/login-routes.ts
import type { RouteConfig } from "../navigation-config";

export const LOGIN_ROUTES: RouteConfig[] = [
  {
    path: "/",
    title: "D&D Toolkit",
    showTopBar: false, // No TopBar on login
    animation: "fade",
    analyticsName: "root_index",
  },
  {
    path: "/login/sign-in",
    title: "Sign In",
    showTopBar: false,
    back: "/", // Back to root
    animation: "slide",
    analyticsName: "login_signin",
  },
];
```

### Example: Main Routes (with dynamic title)

```ts
// lib/navigation/routes/main-routes.ts
export const MAIN_ROUTES: RouteConfig[] = [
  {
    path: "/main/characters-npcs",
    title: (context) => `Characters & NPCs - ${context.worldId}`, // Dynamic title
    showTopBar: true,
    showHamburger: true, // Show menu button
    back: "/select",
    requiredParams: ["worldId"], // Must have worldId in URL
    analyticsName: "main_characters",
  },
  {
    path: "/main/spells",
    title: "Spellbook",
    preserveParamsOnBack: ["worldId", "tab"], // Keep these when navigating back
    redirectIf: (context) => {
      // Redirect if user doesn't have world access
      if (!isWorldAccessible(context.worldId)) {
        return "/select"; // Go back to world selection
      }
    },
  },
];
```

### Example: Settings Routes

```ts
// lib/navigation/routes/settings-routes.ts
export const SETTINGS_ROUTES: RouteConfig[] = [
  {
    path: "/settings",
    title: "Settings",
    showTopBar: true,
    back: "/main/dashboard",
    requiredParams: ["worldId"],
    analyticsName: "settings_main",
  },
];
```

## File Breakdown

| File                 | Purpose                                                                      | Exports                          |
| -------------------- | ---------------------------------------------------------------------------- | -------------------------------- |
| `login-routes.ts`    | Authentication screens (sign-in, sign-up, forgot password, root). No TopBar. | `LOGIN_ROUTES: RouteConfig[]`    |
| `select-routes.ts`   | World/campaign selection and connected worlds list.                          | `SELECT_ROUTES: RouteConfig[]`   |
| `main-routes.ts`     | Core app screens (characters, NPCs, spells, party, etc.). Full TopBar.       | `MAIN_ROUTES: RouteConfig[]`     |
| `settings-routes.ts` | User preferences, account settings, app configuration.                       | `SETTINGS_ROUTES: RouteConfig[]` |
| `web-routes.ts`      | Web-only public pages (landing page, about, terms, etc.). No auth required.  | `WEB_ROUTES: RouteConfig[]`      |

## How to Add a New Route

### Step 1: Add to appropriate routes file (or create new file)

```ts
// lib/navigation/routes/main-routes.ts
export const MAIN_ROUTES: RouteConfig[] = [
  // ... existing routes ...
  {
    path: "/main/treasure",
    title: "Treasure & Loot",
    showTopBar: true,
    back: "/main/dashboard",
    requiredParams: ["worldId"],
    analyticsName: "main_treasure",
  },
];
```

### Step 2: Import in navigation-config.ts (if new file)

```ts
// lib/navigation/navigation-config.ts
import { TREASURE_ROUTES } from "./routes/treasure-routes";

const ROUTE_CONFIGS: RouteConfig[] = [
  ...LOGIN_ROUTES,
  ...SELECT_ROUTES,
  ...MAIN_ROUTES,
  ...TREASURE_ROUTES, // Add here
  ...SETTINGS_ROUTES,
  ...WEB_ROUTES,
];
```

### Step 3: Create screen component in app/

```tsx
// app/main/treasure.tsx
import { usePhaseReady } from "@/lib/kernel";
import { useAppNavigation } from "@/hooks/use-app-navigation";

export default function TreasureScreen() {
  const { getRouteConfig, resolveTitle } = useAppNavigation();
  const config = getRouteConfig();
  const title = resolveTitle(config);

  return (
    <View>
      <TopBar title={title} back={config.back} />
      {/* Screen content */}
    </View>
  );
}
```

## Dynamic Titles

Use functions for titles that depend on context (world name, active tab, etc.):

```ts
{
  path: '/main/characters-npcs',
  title: (context) => {
    const worldName = getWorldName(context.worldId);
    return `Characters - ${worldName}`;
  },
}
```

## Conditional Redirects

Redirect users if they lack access or meet certain conditions:

```ts
{
  path: '/main/premium-feature',
  title: 'Premium Feature',
  redirectIf: (context) => {
    if (!isPremiumSubscribed(context.userId)) {
      return '/settings/subscription';  // Go to subscription page
    }
    if (!hasWorldAccess(context.worldId)) {
      return '/select';  // Go to world selection
    }
  },
}
```

## Parameter Preservation

Preserve URL params when navigating back (e.g., keep active tab):

```ts
{
  path: '/main/party',
  title: 'Party Management',
  preserveParamsOnBack: ['worldId', 'tab', 'sortBy'],
}
```

When user navigates back, these params are automatically maintained.

## Animation Types

Define transition animations (placeholder for future implementation):

```ts
animation: 'slide',  // Slide in/out
animation: 'fade';   // Fade transition
animation: 'modal',  // Modal pop-up
animation: 'none',   // Instant (default)
```

**Note:** Currently stored for future Expo Router integration.

## Accessibility (A11y)

Control focus target on route navigation:

```ts
a11yFocusTarget: 'title',           // Focus TopBar title (default, screen-reader friendly)
a11yFocusTarget: 'firstInteractive', // Focus first interactive element
a11yFocusTarget: 'none',            // No automatic focus (for modals)
```

## Dependencies

### Internal

- **`lib/navigation/navigation-config.ts`** – Merges all routes into ROUTE_CONFIGS
- **`lib/navigation/uri-helpers.ts`** – URL param building and normalization
- **`lib/routing/AUTH_CONFIG`** – Determines protected vs. public routes
- **`app/_layout.tsx`** – Consumes routes via getRouteConfig()

### External

None. Routes files are pure configuration (no external dependencies).

## App-Specific Routes for D&D Toolkit

**Login Area:** Root, welcome, sign-in, sign-up, forgot password, password reset

**World Selection:** Connected worlds list, world details, join world

**Main App:**

- Dashboard / home
- Characters & NPCs (searchable, filterable)
- Spells & Abilities
- Party Management
- Combat Tracker
- Inventory & Loot
- Maps & Locations
- Campaign Notes

**Settings:**

- Account settings
- World settings
- User preferences
- Subscription/premium

**Web (public, no auth):**

- Landing page
- About
- Terms of Service
- Privacy Policy
