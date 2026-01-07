/**
 * Feature flags system for development and testing
 * Allows toggling features without code changes via config/feature-flags.json
 */

import featureFlagsConfig from '../config/feature-flags.json';

export type FeatureFlagName = keyof typeof featureFlagsConfig.flags;

export type FeatureFlagKind = 'free' | 'premium' | 'beta';

export interface FeatureFlag {
  enabled: boolean;
  description?: string;
  kind?: FeatureFlagKind; // optional classification; future-friendly
}

class FeatureFlagsManager {
  private flags: Map<FeatureFlagName, FeatureFlag>;

  constructor() {
    this.flags = new Map(Object.entries(featureFlagsConfig.flags) as [FeatureFlagName, FeatureFlag][]);
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
