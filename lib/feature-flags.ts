/**
 * Feature flags system for development and testing
 * Allows toggling features without code changes via appsettings.*.json
 */
import appSettingsProd from '../config/appsettings.json';
import { getAppConfig, isProduction } from './config/loader';

export type FeatureFlagName = keyof typeof appSettingsProd.featureFlags;

export type FeatureFlagKind = 'free' | 'premium' | 'beta';

export type FeatureFlag = (typeof appSettingsProd.featureFlags)[FeatureFlagName] & {
  kind?: FeatureFlagKind;
};

class FeatureFlagsManager {
  private flags: Map<FeatureFlagName, FeatureFlag>;

  constructor() {
    const featureFlags = getAppConfig().featureFlags || {};
    this.flags = new Map(Object.entries(featureFlags) as [FeatureFlagName, FeatureFlag][]);

    // Warn if production build ships beta-enabled flags
    if (isProduction()) {
      const betaEnabled = [...this.flags.entries()].filter(([, flag]) => flag.kind === 'beta' && flag.enabled);
      if (betaEnabled.length > 0) {
        console.warn('[FeatureFlags] Beta flags enabled in production:', betaEnabled.map(([name]) => name).join(', '));
      }
    }
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
    return Object.fromEntries([...this.flags.entries()].filter(([, flag]) => flag.kind === kind));
  }

  /**
   * Toggle all flags of a given kind
   */
  toggleKind(kind: FeatureFlagKind, enabled: boolean): void {
    [...this.flags.entries()].forEach(([name, flag]) => {
      if (flag.kind === kind) {
        flag.enabled = enabled;
      }
    });
    console.log(`[FeatureFlags] Set all '${kind}' flags to ${enabled}`);
  }

  /**
   * Runtime toggle (for dev console use - doesn't persist)
   */
  toggle(flagName: FeatureFlagName, enabled: boolean): void {
    const flag = this.flags.get(flagName);
    if (flag) {
      flag.enabled = enabled;
      console.log(`[FeatureFlags] ${flagName} = ${enabled}`);
    }
  }
}

export const FeatureFlags = new FeatureFlagsManager();

// Expose to window for dev console access
if (typeof window !== 'undefined') {
  (window as any).FeatureFlags = FeatureFlags;
}
