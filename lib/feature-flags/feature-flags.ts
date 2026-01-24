/**
 * Feature flags system for development and testing
 * Allows toggling features without code changes via appsettings.*.json
 */
import appSettingsProd from "../../config/appsettings.json";
import { getAppConfig, isProduction } from "../config/loader";

export type FeatureFlagName = keyof typeof appSettingsProd.featureFlags;

export type FeatureFlagKind = "free" | "premium" | "beta";

export type FeatureFlag =
  (typeof appSettingsProd.featureFlags)[FeatureFlagName] & {
    kind?: FeatureFlagKind;
  };

/**
 * Event type for flag change notifications
 */
type FlagChangeCallback = (
  flagName: FeatureFlagName | null,
  kind?: FeatureFlagKind,
) => void;

class FeatureFlagsManager {
  private flags: Map<FeatureFlagName, FeatureFlag>;
  private changeListeners: Set<FlagChangeCallback> = new Set();

  constructor() {
    const featureFlags = getAppConfig().featureFlags || {};
    this.flags = new Map(
      Object.entries(featureFlags) as [FeatureFlagName, FeatureFlag][],
    );

    // Warn if production build ships beta-enabled flags
    if (isProduction()) {
      const betaEnabled = [...this.flags.entries()].filter(
        ([, flag]) => flag.kind === "beta" && flag.enabled,
      );
      if (betaEnabled.length > 0) {
        console.warn(
          "[FeatureFlags] Beta flags enabled in production:",
          betaEnabled.map(([name]) => name).join(", "),
        );
      }
    }
  }

  /**
   * Subscribe to flag changes. Used internally by useFeatureFlagListener to trigger re-renders.
   * @param callback Called when any flag or kind is toggled; flagName null + no kind = all flags changed
   */
  subscribe(callback: FlagChangeCallback): () => void {
    this.changeListeners.add(callback);
    return () => this.changeListeners.delete(callback);
  }

  /**
   * Notify all listeners of a flag change
   */
  private notifyListeners(
    flagName: FeatureFlagName | null = null,
    kind?: FeatureFlagKind,
  ): void {
    this.changeListeners.forEach((callback) => callback(flagName, kind));
  }

  /**
   * Check if a feature flag is enabled
   */
  isEnabled(flagName: FeatureFlagName): boolean {
    const flag = this.flags.get(flagName);
    return flag?.enabled ?? false;
  }

  /**
   * Get all feature flags
   */
  getAllFlags(): Record<string, FeatureFlag> {
    return Object.fromEntries(this.flags);
  }

  /**
   * Get flag description
   */
  getDescription(flagName: FeatureFlagName): string | undefined {
    return this.flags.get(flagName)?.description;
  }

  /**
   * Get flag kind/classification (free/premium/beta) if provided.
   */
  getKind(flagName: FeatureFlagName): FeatureFlagKind | undefined {
    return this.flags.get(flagName)?.kind;
  }

  /**
   * Get all flags by kind
   */
  getByKind(kind: FeatureFlagKind): Record<string, FeatureFlag> {
    return Object.fromEntries(
      [...this.flags.entries()].filter(([, flag]) => flag.kind === kind),
    );
  }

  /**
   * Toggle all flags of a given kind.
   * Mutates flags in-place and notifies listeners so React components can re-render.
   * For dev console use: `FeatureFlags.toggleKind('beta', true)` to enable all beta features.
   */
  toggleKind(kind: FeatureFlagKind, enabled: boolean): void {
    [...this.flags.entries()].forEach(([name, flag]) => {
      if (flag.kind === kind) {
        flag.enabled = enabled;
      }
    });
    console.log(`[FeatureFlags] Set all '${kind}' flags to ${enabled}`);
    this.notifyListeners(null, kind);
  }

  /**
   * Runtime toggle (for dev console use - doesn't persist).
   * Mutates the flag in-place and notifies listeners so React components can re-render.
   * Example: `FeatureFlags.toggle('debugLogs', true)` in browser console.
   */
  toggle(flagName: FeatureFlagName, enabled: boolean): void {
    const flag = this.flags.get(flagName);
    if (flag) {
      flag.enabled = enabled;
      console.log(`[FeatureFlags] ${flagName} = ${enabled}`);
      this.notifyListeners(flagName);
    }
  }
}

export const FeatureFlags = new FeatureFlagsManager();

// Expose to window for dev console access
if (typeof window !== "undefined") {
  (window as any).FeatureFlags = FeatureFlags;
}
