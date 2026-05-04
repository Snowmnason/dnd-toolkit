import type { NavigationContext, RouteConfig } from "../navigationConfig";

function getUsernameParam(context: NavigationContext): string | undefined {
  if (!Object.prototype.hasOwnProperty.call(context.params, "username")) {
    return undefined;
  }

  const value = context.params["username"];
  return typeof value === "string" ? value : undefined;
}

// Settings and style playground routes
export const SETTINGS_ROUTES: RouteConfig[] = [
  {
    path: "/settings",
    title: (context) => {
      const username = getUsernameParam(context);
      return username ? `Settings - ${username}` : "Settings";
    },
    analyticsName: "settings",
  },
  {
    path: "/settings/admin-panel",
    title: "Admin Panel",
    analyticsName: "settings_admin",
  },
  {
    path: "/settings/[username]",
    title: (context) => {
      const username = getUsernameParam(context);
      return username ? `Settings - ${username}` : "Settings";
    },
    analyticsName: "settings_user",
    backDestination: "/select/world-selection",
  },
  // Semantic anchor — dispatch only; navigate.to('style-playground') resolves here.
  // getRouteConfig() skips this entry (semanticAnchor: true).
  // The concrete mobile/desktop entries below are the real route configs.
  {
    path: "/settings/stylemobile",
    semanticAnchor: true,
    semanticId: "style-playground",
    platformPaths: { mobile: "/settings/stylemobile", desktop: "/settings/styledesktop" },
    title: "Component Playground",
    analyticsName: "settings_style_playground",
    backDestination: "/select/world-selection",
  },
  // Concrete platform entries — matched directly when navigating to their exact paths.
  {
    path: "/settings/stylemobile",
    platform: "mobile",
    title: "Component Playground (Mobile)",
    analyticsName: "settings_style_mobile",
  },
  {
    path: "/settings/styledesktop",
    platform: "desktop",
    title: "Component Playground (Desktop)",
    analyticsName: "settings_style_desktop",
  },
  {
    path: "/settings/report-bug",
    title: "Report Bug",
    analyticsName: "settings_report_bug",
  },
];
