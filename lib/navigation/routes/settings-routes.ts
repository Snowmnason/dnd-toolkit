import type { NavigationContext, RouteConfig } from "../navigation-config";

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
    showTopBar: true,
    showHamburger: true,
    analyticsName: "settings",
  },
  {
    path: "/settings/admin-panel",
    title: "Admin Panel",
    showTopBar: true,
    showHamburger: false,
    back: "/select/world-selection",
    analyticsName: "settings_admin",
  },
  {
    path: "/settings/[username]",
    title: (context) => {
      const username = getUsernameParam(context);
      return username ? `Settings - ${username}` : "Settings";
    },
    showTopBar: true,
    showHamburger: false,
    back: "/select/world-selection",
    analyticsName: "settings_user",
  },
  {
    path: "/settings/StyleMobile",
    title: "Component Playground (Mobile)",
    showTopBar: true,
    showHamburger: false,
    back: (context) => {
      const username = getUsernameParam(context);
      return username ? `/settings/${username}` : "/select/world-selection";
    },
    analyticsName: "settings_style_mobile",
  },
  {
    path: "/settings/StyleDesktop",
    title: "Component Playground (Desktop)",
    showTopBar: true,
    showHamburger: false,
    back: (context) => {
      const username = getUsernameParam(context);
      return username ? `/settings/${username}` : "/select/world-selection";
    },
    analyticsName: "settings_style_desktop",
  },
  {
    path: "/settings/report-bug",
    title: "Report Bug",
    showTopBar: true,
    showHamburger: false,
    back: (context) => {
      const username = getUsernameParam(context);
      return username ? `/settings/${username}` : "/select/world-selection";
    },
    analyticsName: "settings_report_bug",
  },
];
