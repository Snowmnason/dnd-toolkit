/**
 * Feature flags system for development and testing
 * Allows toggling features without code changes via config/feature-flags.json
 */

import featureFlagsConfig from '../config/feature-flags.json';

export type FeatureFlagName = keyof typeof featureFlagsConfig.flags;

export interface FeatureFlag {
  enabled: boolean;
  description?: string;
}

class FeatureFlagsManager {
  private flags: Record<string, FeatureFlag>;

  constructor() {
    this.flags = featureFlagsConfig.flags;
  }

  /**
   * Check if a feature flag is enabled
   */
  isEnabled(flagName: FeatureFlagName): boolean {
    const flag = this.flags[flagName];
    return flag?.enabled ?? false;
  }

  /**
   * Get all feature flags
   */
  getAllFlags(): Record<string, FeatureFlag> {
    return { ...this.flags };
  }

  /**
   * Get flag description
   */
  getDescription(flagName: FeatureFlagName): string | undefined {
    return this.flags[flagName]?.description;
  }

  /**
   * Runtime toggle (for dev console use - doesn't persist)
   */
  toggle(flagName: FeatureFlagName, enabled: boolean): void {
    if (this.flags[flagName]) {
      this.flags[flagName].enabled = enabled;
      console.log(`[FeatureFlags] ${flagName} = ${enabled}`);
    }
  }
}

export const FeatureFlags = new FeatureFlagsManager();

// Expose to window for dev console access
if (typeof window !== 'undefined') {
  (window as any).FeatureFlags = FeatureFlags;
}
