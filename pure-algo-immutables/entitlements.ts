/**
 * Centralized entitlements helper
 * 
 * SCAFFOLDING: This file is a placeholder structure for future premium features.
 * Currently returns stub values (all features available at stub limits).
 * 
 * When you implement actual premium features, replace the stubs with real limits.
 * This prevents refactoring scattered `isPremium ? X : Y` checks throughout the codebase.
 * 
 * See docs: Entitlements-and-subscription-provider.md
 */


export class Entitlements {
  /**
   * Maximum number of characters a user can create
   * STUB: Currently returns same limit for all users
   * TODO: Replace with: isPremium ? 100 : 5
   */
  static getCharacterLimit(): number {
    return 100; // TODO: wire to SubscriptionManager.isPremiumCached()
  }

  /**
   * Maximum number of NPCs per world
   * STUB: Currently returns same limit for all users
   * TODO: Replace with: isPremium ? 500 : 25
   */
  static getNPCLimit(): number {
    return 500; // TODO: wire to SubscriptionManager.isPremiumCached()
  }

  /**
   * Maximum number of worlds a user can create
   * STUB: Currently returns same limit for all users
   * TODO: Replace with: isPremium ? 50 : 3
   */
  static getWorldLimit(): number {
    return 50; // TODO: wire to SubscriptionManager.isPremiumCached()
  }

  /**
   * Storage quota in bytes
   * STUB: Currently returns large limit for all users
   * TODO: Replace with: hasExtended ? (10 * 1024 ** 3) : (100 * 1024 ** 2)
   */
  static getStorageBytes(): number {
    return 10 * 1024 ** 3; // TODO: wire to SubscriptionManager.hasFeatureCached('extended_storage')
  }

  /**
   * Maximum file upload size in bytes
   * STUB: Currently returns permissive limit
   * TODO: Replace with: isPremium ? (100 * 1024 ** 2) : (10 * 1024 ** 2)
   */
  static getMaxFileSize(): number {
    return 100 * 1024 ** 2; // TODO: wire to SubscriptionManager.isPremiumCached()
  }

  /**
   * API requests allowed per hour
   * STUB: Currently returns high limit
   * TODO: Replace with: isPremium ? 10000 : 100
   */
  static getApiRequestsPerHour(): number {
    return 10000; // TODO: wire to SubscriptionManager.isPremium()
  }

  /**
   * Check if a specific premium feature is available
   * STUB: Currently always true
   * TODO: Replace with: await SubscriptionManager.hasFeature(featureKey)
   */
  static async canUseFeature(featureKey: string): Promise<boolean> {
    return true; // TODO: wire to SubscriptionManager.hasFeature(featureKey)
  }

  /**
   * Get all available export formats for the current user
   * STUB: Currently returns all formats
   * TODO: Filter based on isPremium or hasFeature checks
   */
  static getExportFormats(): string[] {
    const baseFormats = ['json', 'csv'];
    // TODO: if (isPremium) baseFormats.push('pdf', 'docx', 'foundry-vtt');
    return baseFormats.concat(['pdf', 'docx', 'foundry-vtt']);
  }

  /**
   * Get user's current usage and limits
   * STUB: Returns stub values
   * TODO: Calculate actual usage from database
   */
  static async getQuotaInfo(userId: string): Promise<{
    characters: { used: number; limit: number };
    storage: { used: number; limit: number };
    worlds: { used: number; limit: number };
  }> {
    return {
      characters: { used: 0, limit: this.getCharacterLimit() },
      storage: { used: 0, limit: this.getStorageBytes() },
      worlds: { used: 0, limit: this.getWorldLimit() },
    };
  }
}
