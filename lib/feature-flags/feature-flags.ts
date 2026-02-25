/**
 * Feature flags system for development and testing
 * Allows toggling features without code changes via appsettings.*.json
 *
 * PRIVACY & DATA CLASSIFICATION NOTE:
 * - Non-user-specific feature flags → FastCache (PUBLIC/NON_SENSITIVE)
 * - User-specific entitlements (premium features) → SecureStorage (SENSITIVE)
 *   See lib/storage/data-classification.ts for the privacy policy.
 */
import appSettingsProd from "../../config/appsettings.json";
import { getAppConfig, isProduction } from "../config/loader";
import { SecureStorage, getPrivacyStorageBackend } from "../storage";
import { logger } from "../utils/logger";

export interface Entitlements {
  tier: "free" | "premium";
  features: string[];
}

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
        logger.category('feature_flags').warn(
          "Beta flags enabled in production:",
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
    logger.category('feature_flags').debug(`Set all '${kind}' flags to ${enabled}`);
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
      logger.category('feature_flags').debug(`${flagName} = ${enabled}`);
      this.notifyListeners(flagName);
    }
  }

  /**
   * Sync legacy flags from server-synced FeatureFlagsManager values.
   *
   * Called after FeatureFlagsManager.bootstrapFlags() so that the legacy
   * system (and hooks like useFeatureFlag) reflect server-resolved values.
   *
   * Updates all matching flags silently and notifies listeners once
   * to trigger React re-renders.
   */
  syncFromServer(
    serverFlags: Record<
      string,
      { enabled: boolean; kind?: string; description?: string }
    >,
  ): void {
    let changed = false;
    for (const [name, state] of Object.entries(serverFlags)) {
      const flag = this.flags.get(name as FeatureFlagName);
      if (flag && flag.enabled !== state.enabled) {
        flag.enabled = state.enabled;
        changed = true;
      }
    }
    if (changed) {
      logger.category('bootstrap').info(
        "[FeatureFlags] Synced from server-synced flags",
      );
      // null = all flags changed, triggers re-render in all useFeatureFlag consumers
      this.notifyListeners(null);
    }
  }

  /**
   * Persist feature flags to FastCache per privacy policy.
   * Non-user-specific flags stay in FastCache (fast, unencrypted).
   */
  async persistFlags(flags: Record<string, FeatureFlag>): Promise<void> {
    try {
      const backend = getPrivacyStorageBackend("feature_flags:v1");
      await backend.setJSON("feature_flags:v1", flags);
      logger.category('feature_flags').debug("Persisted feature flags");
    } catch (error) {
      logger.category('feature_flags').error("Failed to persist feature flags:", error);
    }
  }

  /**
   * Load feature flags from FastCache if available.
   * Fallback to config if cache miss.
   */
  async loadFlags(): Promise<Record<string, FeatureFlag>> {
    try {
      const backend = getPrivacyStorageBackend("feature_flags:v1");
      const cached =
        await backend.getJSON<Record<string, FeatureFlag>>("feature_flags:v1");
      if (cached) {
        logger.category('feature_flags').debug("Loaded feature flags from cache");
        return cached;
      }
    } catch (error) {
      logger.category('feature_flags').warn("Failed to load feature flags from cache:",error, "Falling back to defaults");
    }
    return this.getAllFlags();
  }

  /**
   * Persist user entitlements to SecureStorage per privacy policy.
   * User-specific entitlements must be encrypted (SENSITIVE data).
   */
  async persistEntitlements(entitlements: Entitlements): Promise<void> {
    try {
      const backend = getPrivacyStorageBackend("secure:entitlements");
      await backend.setJSON("secure:entitlements", entitlements);
      logger.category('feature_flags').debug("Persisted user entitlements");
    } catch (error) {
      logger.category('feature_flags').error("Failed to persist entitlements:", error);
    }
  }

  /**
   * Get user entitlements from SecureStorage per privacy policy.
   * Always reads from SecureStorage (encrypted backend) for security.
   */
  async getEntitlements(): Promise<Entitlements | null> {
    try {
      const entitlements = await SecureStorage.getJSON<Entitlements>(
        "secure:entitlements",
      );
      return entitlements ?? null;
    } catch (error) {
      logger.category('feature_flags').warn("Failed to retrieve entitlements:", error);
      return null;
    }
  }
}

export const FeatureFlags = new FeatureFlagsManager();

// Expose to window for dev console access
if (typeof window !== "undefined") {
  (window as any).FeatureFlags = FeatureFlags;
}
