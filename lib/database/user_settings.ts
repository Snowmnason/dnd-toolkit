import { RequestManager } from "../api/request-manager";
import { getDatabaseProvider } from "../services";
import { logger } from "../utils/logger";
import { getCurrentUserProfile, validateUserForWrite } from "./common";

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
    logger.debug("storage", "Starting fetchCurrentUserSettings", options);

    const maxAgeMs = options?.maxAgeMs ?? (4 * 60 * 60 * 1000); // Default 4 hours
    const forceRefresh = options?.forceRefresh ?? false;

    // First, try to get from local storage (unless forced refresh)
    if (!forceRefresh) {
      try {
        const { SecureStorage, STORAGE_KEYS } = await import("../storage");

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
            logger.debug(
              "storage",
              `User settings loaded from cache (age: ${cacheAge}ms)`,
            );
            return cachedSettings;
          }
          // Cache is stale - fall through to fetch from DB
          logger.debug(
            "storage",
            `User settings cache stale (age: ${cacheAge}ms), refreshing from database`,
          );
        }
        // If meta is missing or cache is missing, treat as cache miss and fetch from DB
      } catch (storageError) {
        logger.warn(
          "storage",
          "Could not load from storage, fetching from DB:",
          storageError,
        );
      }
    } else {
      logger.debug("storage", "Force refresh requested, skipping cache");
    }

    // Fetch from database
    const currentUser = await getCurrentUserProfile();
    if (!currentUser) {
      logger.debug("storage", "No authenticated user found");
      return null;
    }

    logger.debug(
      "storage",
      "Fetching user settings from database for user_id:",
      currentUser.id,
    );

    // Use RequestManager to wrap database fetch with deduplication, retries, timeout
    const data = await RequestManager.fetch(
      `user:settings:${currentUser.id}`,
      async () => {
        const { data, error } = await getDatabaseProvider()
          .from('user_settings', 'public')
          .select("*")
          .eq("user_id", currentUser.id)
          .single();

        if (error) {
          if (error.code === "PGRST116") {
            // Settings don't exist yet (shouldn't happen if user exists, but handle gracefully)
            logger.debug(
              "storage",
              "No settings exist yet for user - this is unexpected but recoverable",
            );
            return null;
          }

          // Only log as error for unexpected database issues
          logger.error(
            "storage",
            "Unexpected database error in fetchCurrentUserSettings:",
            {
              message: error.message,
              code: error.code,
              details: error.details,
              hint: error.hint,
              user_id: currentUser.id,
            },
          );

          throw new Error(error.message || "Failed to fetch user settings");
        }

        return data;
      },
      {
        dedupe: true,
        retries: 2,
        timeout: 15000,
        authStrategy: "user",
      },
    );

    if (!data) {
      logger.debug(
        "storage",
        "User settings is null - no settings record yet",
        {
          userId: currentUser.id,
        },
      );
      return null;
    }

    logger.info("storage", "User settings fetched successfully:", {
      user_id: data.user_id,
      theme: data.theme,
      language: data.language,
      timezone: data.timezone,
      analytics_consent_level: data.analytics_consent_level,
    });

    // Save user settings to local storage + metadata with fresh timestamp
    try {
      const { SecureStorage, STORAGE_KEYS } = await import("../storage");

      await SecureStorage.setJSON(STORAGE_KEYS.USER_SETTINGS, data);
      await SecureStorage.setJSON(STORAGE_KEYS.USER_SETTINGS_META, {
        timestamp: Date.now(),
        source: "supabase",
      });
    } catch (storageError) {
      logger.warn(
        "storage",
        "Failed to save user settings to storage (non-critical):",
        storageError,
      );
    }

    return data;
  },

  // Update analytics consent level in current user's settings
  async updateAnalyticsConsentLevel(level: string): Promise<string> {
    return RequestManager.fetch(
      `user:settings:consent:update:${Date.now()}`,
      async () => {
        // Validate user is authenticated and get internal user.id (throws if not authenticated)
        const currentUser = await validateUserForWrite();

        // Validate consent level
        const validLevels = ['none', 'basic', 'full'];
        if (!validLevels.includes(level)) {
          logger.error("storage", "Invalid consent level provided:", {
            level,
            validLevels,
          });
          throw new Error(`Invalid consent level: ${level}. Must be one of: ${validLevels.join(', ')}`);
        }

        logger.debug("storage", "Updating analytics consent level:", {
          userId: currentUser.id,
          newLevel: level,
        });

        const { data, error } = await getDatabaseProvider()
          .from('user_settings', 'public')
          .update({ analytics_consent_level: level })
          .eq('user_id', currentUser.id)
          .select('analytics_consent_level')
          .single();

        if (error) {
          logger.error("storage", "Error updating analytics consent level:", {
            message: error.message,
            code: error.code,
            userId: currentUser.id,
            level,
          });
          throw new Error(error.message || "Failed to update consent level");
        }

        logger.info("storage", "Analytics consent level updated successfully:", {
          userId: currentUser.id,
          level: data.analytics_consent_level,
        });

        // Update cached settings with new consent level
        try {
          const { SecureStorage, STORAGE_KEYS } = await import("../storage");
          const cachedSettings = await SecureStorage.getJSON<UserSettings>(
            STORAGE_KEYS.USER_SETTINGS,
          );
          if (cachedSettings) {
            cachedSettings.analytics_consent_level = level;
            await SecureStorage.setJSON(STORAGE_KEYS.USER_SETTINGS, cachedSettings);
          }
        } catch (storageError) {
          logger.warn(
            "storage",
            "Failed to update cached settings (non-critical):",
            storageError,
          );
        }

        return data.analytics_consent_level;
      },
      {
        dedupe: false,
        retries: 3,
        timeout: 10000,
        authStrategy: "user",
      },
    );
  },
};
