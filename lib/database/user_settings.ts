import { logger } from "@/lib/utils";
import { getUserSettingsRepository } from "./repositories";

export interface UserSettings {
  user_id: string;
  theme: string;
  language: string;
  timezone: string;
  preferences: Record<string, unknown>;
  analytics_consent_level: string;
  updated_at: string;
}

export const userSettingsDB = {
  // Fetch all user settings for current user and cache to SecureStorage
  async fetchCurrentUserSettings(options?: { maxAgeMs?: number; forceRefresh?: boolean }): Promise<UserSettings | null> {
    logger.category("database").debug("Starting fetchCurrentUserSettings", options);

    const maxAgeMs = options?.maxAgeMs ?? (4 * 60 * 60 * 1000); // Default 4 hours
    const forceRefresh = options?.forceRefresh ?? false;

    // First, try to get from local storage (unless forced refresh)
    if (!forceRefresh) {
      try {
        const { SecureStorage } = await import("@/system/Storage");
        const { STORAGE_KEYS } = await import("@/maps");

        const cachedSettings = await SecureStorage.getJSON<UserSettings>(
          STORAGE_KEYS.USER_SETTINGS,
        );
        const cacheMeta = await SecureStorage.getJSON<{ timestamp: number }>(
          STORAGE_KEYS.USER_SETTINGS_META,
        );

        // Cache is valid only if both settings data and metadata exist, and metadata is fresh
        if (cachedSettings && cacheMeta) {
          const cacheAge = Date.now() - cacheMeta.timestamp;
          const isCacheFresh = cacheAge < maxAgeMs;

          if (isCacheFresh) {
            logger.category("database").debug(
              `User settings loaded from cache (age: ${cacheAge}ms)`,
            );
            return cachedSettings;
          }
          // Cache is stale - fall through to fetch from DB
          logger.category("database").debug(
            `User settings cache stale (age: ${cacheAge}ms), refreshing from database`,
          );
        }
        // If meta is missing or cache is missing, treat as cache miss and fetch from DB
      } catch (storageError) {
        logger.category("database").warn(
          "Could not load from storage, fetching from DB:",
          storageError,
        );
      }
    } else {
      logger.category("database").debug("Force refresh requested, skipping cache");
    }

    // Fetch from database via repository
    const data = await getUserSettingsRepository().fetchCurrentUserSettings();

    if (!data) {
      logger.category("database").debug("User settings is null - no settings record yet");
      return null;
    }

    logger.category("database").info("User settings fetched successfully:", {
      user_id: data.user_id,
      theme: data.theme,
      language: data.language,
      timezone: data.timezone,
      analytics_consent_level: data.analytics_consent_level,
    });

    // Save user settings to local storage + metadata with fresh timestamp
    try {
      const { SecureStorage } = await import("@/system/Storage");
      const { STORAGE_KEYS } = await import("@/maps");

      await SecureStorage.setJSON(STORAGE_KEYS.USER_SETTINGS, data);
      await SecureStorage.setJSON(STORAGE_KEYS.USER_SETTINGS_META, {
        timestamp: Date.now(),
        source: "supabase",
      });
    } catch (storageError) {
      logger.category("database").warn(
        "Failed to save user settings to storage (non-critical):",
        storageError,
      );
    }

    return data;
  },

  // Fetch user settings by user ID
  async fetchUserSettingsById(userId: string, options?: { maxAgeMs?: number; forceRefresh?: boolean }): Promise<UserSettings | null> {
    logger.category("database").debug("Starting fetchUserSettingsById", { userId, ...options });

    const maxAgeMs = options?.maxAgeMs ?? (4 * 60 * 60 * 1000); // Default 4 hours
    const forceRefresh = options?.forceRefresh ?? false;

    // First, try to get from local storage (unless forced refresh)
    if (!forceRefresh) {
      try {
        const { SecureStorage } = await import("@/system/Storage");
        const { STORAGE_KEYS } = await import("@/maps");

        const cachedSettings = await SecureStorage.getJSON<UserSettings>(
          STORAGE_KEYS.USER_SETTINGS,
        );
        const cacheMeta = await SecureStorage.getJSON<{ timestamp: number; userId: string }>(
          STORAGE_KEYS.USER_SETTINGS_META,
        );

        // Cache is valid if it matches the requested userId, both data and metadata exist, and metadata is fresh
        if (cachedSettings && cacheMeta && cacheMeta.userId === userId) {
          const cacheAge = Date.now() - cacheMeta.timestamp;
          const isCacheFresh = cacheAge < maxAgeMs;

          if (isCacheFresh) {
            logger.category("database").debug(
              `User settings loaded from cache (age: ${cacheAge}ms)`,
              { userId },
            );
            return cachedSettings;
          }
          // Cache is stale - fall through to fetch from DB
          logger.category("database").debug(
            `User settings cache stale (age: ${cacheAge}ms), refreshing from database`,
            { userId },
          );
        }
        // If meta is missing or cache is missing, treat as cache miss and fetch from DB
      } catch (storageError) {
        logger.category("database").warn(
          "Could not load from storage, fetching from DB:",
          storageError,
        );
      }
    } else {
      logger.category("database").debug("Force refresh requested, skipping cache");
    }

    // Fetch from database via repository
    const data = await getUserSettingsRepository().fetchUserSettingsById(userId);

    if (!data) {
      logger.category("database").debug("User settings is null - no settings record yet", { userId });
      return null;
    }

    logger.category("database").info("User settings fetched successfully:", {
      user_id: data.user_id,
      theme: data.theme,
      language: data.language,
      timezone: data.timezone,
      analytics_consent_level: data.analytics_consent_level,
    });

    // Save user settings to local storage + metadata with fresh timestamp
    try {
      const { SecureStorage } = await import("@/system/Storage");
      const { STORAGE_KEYS } = await import("@/maps");

      await SecureStorage.setJSON(STORAGE_KEYS.USER_SETTINGS, data);
      await SecureStorage.setJSON(STORAGE_KEYS.USER_SETTINGS_META, {
        timestamp: Date.now(),
        userId,
        source: "supabase",
      });
    } catch (storageError) {
      logger.category("database").warn(
        "Failed to save user settings to storage (non-critical):",
        storageError,
      );
    }

    return data;
  },

  // Update analytics consent level in current user's settings
  async updateAnalyticsConsentLevel(level: string): Promise<string> {
    // Validate consent level (business rule stays in caller)
    const validLevels = ['none', 'basic', 'full'];
    if (!validLevels.includes(level)) {
      logger.category("database").error("Invalid consent level provided:", { level, validLevels });
      throw new Error(`Invalid consent level: ${level}. Must be one of: ${validLevels.join(', ')}`);
    }

    logger.category("database").debug("Updating analytics consent level:", { newLevel: level });

    const result = await getUserSettingsRepository().updateAnalyticsConsentLevel(level);

    // Update cached settings with new consent level
    try {
      const { SecureStorage } = await import("@/system/Storage");
      const { STORAGE_KEYS } = await import("@/maps");
      const cachedSettings = await SecureStorage.getJSON<UserSettings>(
        STORAGE_KEYS.USER_SETTINGS,
      );
      if (cachedSettings) {
        cachedSettings.analytics_consent_level = level;
        await SecureStorage.setJSON(STORAGE_KEYS.USER_SETTINGS, cachedSettings);
      }
    } catch (storageError) {
      logger.category("database").warn(
        "Failed to update cached settings (non-critical):",
        storageError,
      );
    }

    return result;
  },
};
