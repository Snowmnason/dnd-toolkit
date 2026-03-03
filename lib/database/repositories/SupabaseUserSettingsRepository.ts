import { dbRequestOptions } from "@/config";
import {
  getCurrentUserProfile,
  validateUserForWrite,
} from "@/lib/database/database-manger";
import { getDatabase } from "@/lib/middleware/services";
import { logger } from "@/lib/utils/logger";
import { RequestManager } from "@/system/API/request-manager";
import type {
  CacheOptions,
  UserSettings,
  UserSettingsRepository,
} from "./repo-types";

/**
 * Supabase implementation of UserSettingsRepository.
 *
 * Manages user preferences and settings.
 *
 * NOTE: CacheOptions is accepted for interface compatibility, but caching is the
 * responsibility of the caller (lib/database/user_settings.ts). This implementation
 * performs database operations only.
 */
export class SupabaseUserSettingsRepository implements UserSettingsRepository {
  async fetchCurrentUserSettings(_options?: CacheOptions): Promise<UserSettings | null> {
    logger.category("database").debug("Starting fetchCurrentUserSettings");

    // Fetch from database
    const currentUser = await getCurrentUserProfile();
    if (!currentUser) {
      logger.category("database").debug("No authenticated user found");
      return null;
    }

    return RequestManager.fetch(
      `user:settings:${currentUser.id}`,
      async () => {
        const { data, error } = await getDatabase()
          .from("user_settings", "public")
          .select("*")
          .eq("user_id", currentUser.id)
          .single();

        if (error) {
          if (error.code === "PGRST116") {
            // Settings don't exist yet (shouldn't happen if user exists, but handle gracefully)
            logger
              .category("database")
              .debug(
                "No settings exist yet for user - this is unexpected but recoverable",
              );
            return null;
          }

          // Only log as error for unexpected database issues
          logger.category("database").error("Failed to fetch user settings:", {
            message: error.message,
            code: error.code,
            details: error.details,
          });
          throw new Error(error.message || "Failed to fetch user settings");
        }

        logger.category("database").info("User settings fetched from database:", {
          userId: data.user_id,
          theme: data.theme,
          language: data.language,
        });

        return data;
      },
      dbRequestOptions("read", "user"),
    ) ?? null;
  }

  async fetchUserSettingsById(userId: string, _options?: CacheOptions): Promise<UserSettings | null> {
    logger.category("database").debug("Starting fetchUserSettingsById", { userId });

    return RequestManager.fetch(
      `user:settings:${userId}`,
      async () => {
        const { data, error } = await getDatabase()
          .from("user_settings", "public")
          .select("*")
          .eq("user_id", userId)
          .single();

        if (error) {
          if (error.code === "PGRST116") {
            // Settings don't exist for this user
            logger
              .category("database")
              .debug(
                "No settings exist for user",
                { userId },
              );
            return null;
          }

          // Only log as error for unexpected database issues
          logger.category("database").error("Failed to fetch user settings:", {
            userId,
            message: error.message,
            code: error.code,
            details: error.details,
          });
          throw new Error(error.message || "Failed to fetch user settings");
        }

        logger.category("database").info("User settings fetched from database:", {
          userId: data.user_id,
          theme: data.theme,
          language: data.language,
        });

        return data;
      },
      dbRequestOptions("read", "user"),
    ) ?? null;
  }

  async updateAnalyticsConsentLevel(level: string): Promise<string> {
    // Verify user has write access
    await validateUserForWrite();

    const currentUser = await getCurrentUserProfile();
    if (!currentUser) {
      throw new Error("No authenticated user found");
    }

    const result = await RequestManager.fetch(
      `user:settings:analytics:${currentUser.id}`,
      async () => {
        const { error } = await getDatabase()
          .from("user_settings", "public")
          .update({ analytics_consent_level: level, updated_at: new Date().toISOString() })
          .eq("user_id", currentUser.id)
          .execute();

        if (error) {
          logger
            .category("database")
            .error("Failed to update analytics consent level:", {
              userId: currentUser.id,
              message: error.message,
              code: error.code,
            });
          throw new Error(error.message || "Failed to update settings");
        }

        logger
          .category("database")
          .info("Analytics consent level updated:", {
            userId: currentUser.id,
            level,
          });

        return level;
      },
      dbRequestOptions("update", "user"),
    );

    return result ?? level;
  }
}
