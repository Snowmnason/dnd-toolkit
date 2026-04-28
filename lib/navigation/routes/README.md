
**Full `UseNavigation` interface now:**

| Family | Method | Transport path |
|--------|--------|---------------|
| Transition | `to`, `replace` | `executeRouteNavigation` |
| History | `back`, `dismiss`, `dismissAll` | `executeHistoryNavigation` |
| Utility | `setParams(params)` | `executeUtilityNavigation('setParams', ...)` |
| Utility | `prefetch(route)` | `executeUtilityNavigation('prefetch', { target })` |
| State query | `canGoBack()` | `executeStateQueryNavigation('canGoBack')` |
| State query | `canDismiss()` | `executeStateQueryNavigation('canDismiss')` |
| State query | `getCurrentRoute()` | `executeStateQueryNavigation('getCurrentRoute')` |
| State query | `getCurrentParams()` | `executeStateQueryNavigation('getCurrentParams')` |
| External | `openWeb(url)` | `executeExternalNavigation` |


# lib/navigation/routes

App-specific route metadata grouped by screen area.

This folder only defines route metadata. It does not define chrome visibility,
back behavior, redirect behavior, required params, or modal behavior.

## Current RouteConfig Contract

```ts
export interface RouteConfig {
  path: string;
  aliases?: string[];
  title: string | ((context: NavigationContext) => string);
  a11yFocusTarget?: "title" | "firstInteractive" | "none";
  analyticsName?: string;
  onError?: (error: Error, context: NavigationContext) => void;
}
```

## Organization

Routes are organized by app area:

- `loginRoutes.ts`
- `selectRoutes.ts`
- `mainRoutes.ts`
- `settingsRoutes.ts`
- `webRoutes.ts`

Each file exports `RouteConfig[]`, then `navigationConfig.ts` merges them into
the route registry.

## What Belongs Here

Put in route files:

- route path
- aliases for equivalent paths
- static or dynamic title
- analytics name
- route-scoped `onError` handler when needed
- optional a11y focus target

Do not put in route files:

- top bar / bottom bar / hamburger / nav drawer visibility
- semantic back targets
- redirect hooks
- required params metadata
- animation / modal metadata

Those behaviors are owned by AppConfig chrome policy and guard/auth pipelines.

## Add a New Route

1. Add route metadata to the correct file:

```ts
export const MAIN_ROUTES: RouteConfig[] = [
  {
    path: "/main/treasure",
    title: "Treasure & Loot",
    analyticsName: "main_treasure",
  },
];
```

2. If adding a new route group file, import and spread it in `navigationConfig.ts`.

## Dynamic Title Example

```ts
{
  path: "/settings/[username]",
  title: (context) => {
    const value = context.params["username"];
    return typeof value === "string" ? `Settings - ${value}` : "Settings";
  },
  analyticsName: "settings_user",
}
```

## File Breakdown

| File | Purpose |
| --- | --- |
| `loginRoutes.ts` | Auth and root routes |
| `selectRoutes.ts` | World selection flow |
| `mainRoutes.ts` | Main app feature routes |
| `settingsRoutes.ts` | Settings and style routes |
| `webRoutes.ts` | Web-only routes |
