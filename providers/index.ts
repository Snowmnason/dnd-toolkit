/**
 * Providers Module — Barrel Export
 *
 * All React context providers and their consumer hooks.
 * Import from `@/providers` instead of individual files.
 *
 * Combined Providers (use direct imports to avoid import cycles):
 * - ViewportProvider: Direct import from './ViewportProvider' (combines Theme + Scale + Platform + ScreenProvider)
 * - AppParamsProvider: Direct import from './AppParamsProvider' (combines AppParamsStable + AppParamsVolatile)
 *
 * Individual Providers (also available via direct imports):
 * - ThemeProvider, ScaleProvider, PlatformProvider
 * - ScreenProvider: Import directly from './ScreenProvider' to avoid cycles
 * - AppParamsStableProvider, AppParamsVolatileProvider
 * - SubscriptionProvider
 *
 * ```ts
 * import { ViewportProvider } from "@/providers/ViewportProvider";
 * import { AppParamsProvider } from "@/providers/AppParamsProvider";
 * import { ScreenProvider } from "@/providers/ScreenProvider";
 * import { UseTheme, useUserId } from "@/providers";
 * ```
 */

// ============================================================================
// NOTE: Combined/cycle-prone providers are NOT exported from this barrel
// to avoid import cycles. Import them directly:
// - import { ViewportProvider } from '@/providers/ViewportProvider';
// - import { AppParamsProvider } from '@/providers/AppParamsProvider';
// - import { ScreenProvider } from '@/providers/ScreenProvider';
// ============================================================================

// ============================================================================
// INDIVIDUAL PROVIDERS (Available for fine-grained control)
// ============================================================================

// App Params (Stable — userId, connectedWorlds)
export {
    AppParamsStableProvider,
    useAppParamsStable,
    useConnectedWorlds,
    useUserId
} from "./AppParamsStableProvider";

// App Params (Volatile — worldId, userRole)
export {
    AppParamsVolatileProvider,
    useAppParamsVolatile,
    useUserRole,
    useWorldId
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
    type ThemeMode
} from "./ThemeProvider";

