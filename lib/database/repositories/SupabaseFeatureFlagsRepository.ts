import { dbRequestOptions } from "@/config";
import { RequestManager } from "@/lib/api/request-manager";
import { getDatabase } from "@/lib/services";
import { logger } from "@/lib/utils/logger";
import type {
  FeatureFlagOverrideRow,
  FeatureFlagRow,
  FeatureFlagsRepository,
} from "./repo-types";

/**
 * Supabase implementation of FeatureFlagsRepository.
 *
 * **Note:** This implementation is for compatibility with the repository pattern.
 * The actual feature flags system uses the edge function at lib/feature-flags/FeatureFlagsManager.
 * This repository provides direct database access for testing and advanced use cases.
 */
export class SupabaseFeatureFlagsRepository implements FeatureFlagsRepository {
  async getAll(): Promise<FeatureFlagRow[]> {
    return (
      (await RequestManager.fetch(
        "featureFlags:all",
        async () => {
          const { data, error } = await getDatabase()
            .from("feature_flags", "feature_flags")
            .select("*")
            .eq("is_active", true)
            .execute();

          if (error) {
            logger.category("database").error("Failed to fetch feature flags:", {
              message: error.message,
              code: error.code,
            });
            throw new Error(error.message || "Failed to fetch feature flags");
          }

          logger
            .category("database")
            .debug(`Fetched ${(data || []).length} feature flags`);

          return (data || []) as FeatureFlagRow[];
        },
        dbRequestOptions("list", "public"),
      )) ?? []
    );
  }

  async getByName(flagName: string): Promise<FeatureFlagRow | null> {
    return RequestManager.fetch(
      `featureFlag:${flagName}`,
      async () => {
        const { data, error } = await getDatabase()
          .from("feature_flags", "feature_flags")
          .select("*")
          .eq("name", flagName)
          .eq("is_active", true)
          .maybeSingle();

        if (error) {
          logger.category("database").error("Failed to fetch feature flag:", {
            flagName,
            message: error.message,
            code: error.code,
          });
          throw new Error(error.message || "Failed to fetch feature flag");
        }

        return (data || null) as FeatureFlagRow | null;
      },
      dbRequestOptions("read", "public"),
    );
  }

  async getOverridesForUser(userId: string): Promise<FeatureFlagOverrideRow[]> {
    return (
      (await RequestManager.fetch(
        `featureFlagOverrides:${userId}`,
        async () => {
          const now = new Date().toISOString();

          const { data, error } = await getDatabase()
            .from("feature_flag_overrides", "feature_flags")
            .select("*")
            .eq("user_id", userId)
            .or(`expires_at.is.null,expires_at.gt.${now}`)
            .execute();

          if (error) {
            logger.category("database").error("Failed to fetch feature flag overrides:", {
              userId,
              message: error.message,
              code: error.code,
            });
            throw new Error(error.message || "Failed to fetch feature flag overrides");
          }

          logger
            .category("database")
            .debug(`Fetched ${(data || []).length} feature flag overrides for user ${userId}`);

          return (data || []) as FeatureFlagOverrideRow[];
        },
        dbRequestOptions("list", "user"),
      )) ?? []
    );
  }
}
