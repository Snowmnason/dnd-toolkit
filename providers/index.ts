/**
 * Providers Module — Barrel Export
 *
 * All React context providers and their consumer hooks.
 * Import from `@/providers` instead of individual files.
 *
 * ```ts
 * import { ThemeProvider, UseTheme, usePlatform, useUserId } from "@/providers";
 * ```
 */

// App Params (Stable — userId, connectedWorlds)
export {
    AppParamsStableProvider,
    useAppParamsStable,
    useConnectedWorlds,
    useUserId,
} from "./AppParamsStableProvider";

// App Params (Volatile — worldId, userRole)
export {
    AppParamsVolatileProvider,
    useAppParamsVolatile,
    useUserRole,
    useWorldId,
} from "./AppParamsVolatileProvider";

// Platform
export { PlatformProvider, usePlatform } from "./PlatformProvider";

// Scale
export { ScaleProvider, useScale } from "./ScaleProvider";

// Subscription
export { SubscriptionProvider, useSubscription } from "./SubscriptionProvider";

// Theme
export {
    ThemeProvider,
    UseTheme,
    type ThemeFamily,
    type ThemeMode,
} from "./ThemeProvider";
