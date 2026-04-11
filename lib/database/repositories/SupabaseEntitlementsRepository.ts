import { dbRequestOptions } from "@/config";
import { fetchRequest } from "@/lib/api";
import { logger } from "@/lib/utils/logger";
import { getDatabase } from "@/middleware/services";
import type {
    EntitlementOverrideRow,
    EntitlementRow,
    EntitlementsRepository,
} from "./repo-types";

/**
 * Supabase implementation of EntitlementsRepository.
 *
 * Manages user premium entitlements stored in the `feature_flags` schema.
 * Entitlements represent features a user has paid for or been granted by an admin.
 *
 * NOTE: Caching is the responsibility of the caller (lib/database/entitlements.ts).
 * This implementation performs database operations only.
 */
export class SupabaseEntitlementsRepository implements EntitlementsRepository {
  async getByUserId(userId: string): Promise<EntitlementRow[]> {
    const result = await fetchRequest(
      `entitlements:user:${userId}`,
      async () => {
        const { data, error } = await getDatabase()
          .from("entitlements", "feature_flags")
          .select("id, user_id, key, is_active, remind_user, created_at, updated_at, expires_at")
          .eq("user_id", userId)
          .eq("is_active", true)
          .execute();

        if (error) {
          logger.category("database").error("Failed to fetch entitlements:", {
            userId,
            message: error.message,
            code: error.code,
          });
          throw new Error(`Failed to fetch entitlements for user ${userId}: ${error.message}`);
        }

        return (data || []) as EntitlementRow[];
      },
      dbRequestOptions("list", "user"),
    );
    return result ?? [];
  }

  async hasEntitlement(userId: string, entitlementKey: string): Promise<boolean> {
    const result = await fetchRequest(
      `entitlements:user:${userId}:${entitlementKey}`,
      async () => {
        const { data, error } = await getDatabase()
          .from("entitlements", "feature_flags")
          .select("is_active, expires_at")
          .eq("user_id", userId)
          .eq("key", entitlementKey)
          .eq("is_active", true)
          .maybeSingle();

        if (error || !data) {
          return false;
        }

        // No expiry = permanent entitlement
        if (data.expires_at === null) {
          return true;
        }

        return new Date(data.expires_at).getTime() > Date.now();
      },
      dbRequestOptions("read", "user"),
    );

    return result ?? false;
  }

  async getOverridesByUserId(userId: string): Promise<EntitlementOverrideRow[]> {
    const result = await fetchRequest(
      `entitlements:overrides:${userId}`,
      async () => {
        const now = new Date().toISOString();

        const { data, error } = await getDatabase()
          .from("entitlements_overrides", "feature_flags")
          .select("id, user_id, entitlement_key, is_active, expires_at, reason, created_by, created_at, updated_at, revoked")
          .eq("user_id", userId)
          .eq("revoked", false)
          .or(`expires_at.is.null,expires_at.gt.${now}`)
          .execute();

        if (error) {
          logger.category("database").error("Failed to fetch entitlement overrides:", {
            userId,
            message: error.message,
            code: error.code,
          });
          throw new Error(`Failed to fetch entitlement overrides for user ${userId}: ${error.message}`);
        }

        return (data || []) as EntitlementOverrideRow[];
      },
      dbRequestOptions("list", "user"),
    );
    return result ?? [];
  }

  async setReminderFlag(entitlementId: string, remind: boolean): Promise<void> {
    await fetchRequest(
      `entitlements:remind:${entitlementId}`,
      async () => {
        const { error } = await getDatabase()
          .from("entitlements", "feature_flags")
          .update({ remind_user: remind, updated_at: new Date().toISOString() })
          .eq("id", entitlementId)
          .execute();

        if (error) {
          logger.category("database").error("Failed to set entitlement reminder flag:", {
            entitlementId,
            remind,
            message: error.message,
            code: error.code,
          });
          throw new Error(`Failed to update remind_user for entitlement ${entitlementId}: ${error.message}`);
        }
      },
      dbRequestOptions("update", "user"),
    );
  }

  async getRemindable(userId: string): Promise<EntitlementRow[]> {
    const result = await fetchRequest(
      `entitlements:remindable:${userId}`,
      async () => {
        const { data, error } = await getDatabase()
          .from("entitlements", "feature_flags")
          .select("id, user_id, key, is_active, remind_user, created_at, updated_at, expires_at")
          .eq("user_id", userId)
          .eq("is_active", true)
          .eq("remind_user", true)
          .not("expires_at", "is", null)
          .execute();

        if (error) {
          logger.category("database").error("Failed to fetch remindable entitlements:", {
            userId,
            message: error.message,
            code: error.code,
          });
          throw new Error(`Failed to fetch remindable entitlements for user ${userId}: ${error.message}`);
        }

        return (data || []) as EntitlementRow[];
      },
      dbRequestOptions("list", "user"),
    );
    return result ?? [];
  }

  async getExpired(userId: string): Promise<EntitlementRow[]> {
    const result = await fetchRequest(
      `entitlements:expired:${userId}`,
      async () => {
        const now = new Date().toISOString();

        const { data, error } = await getDatabase()
          .from("entitlements", "feature_flags")
          .select("id, user_id, key, is_active, remind_user, created_at, updated_at, expires_at")
          .eq("user_id", userId)
          .eq("is_active", true)
          .lt("expires_at", now)
          .execute();

        if (error) {
          logger.category("database").error("Failed to fetch expired entitlements:", {
            userId,
            message: error.message,
            code: error.code,
          });
          throw new Error(`Failed to fetch expired entitlements for user ${userId}: ${error.message}`);
        }

        return (data || []) as EntitlementRow[];
      },
      dbRequestOptions("list", "user"),
    );
    return result ?? [];
  }

  async getExpiredBeforeDate(cutoffDate: string): Promise<EntitlementRow[]> {
    const result = await fetchRequest(
      `entitlements:expired-before:${cutoffDate}`,
      async () => {
        const { data, error } = await getDatabase()
          .from("entitlements", "feature_flags")
          .select("id, user_id, key, is_active, remind_user, created_at, updated_at, expires_at")
          .eq("is_active", true)
          .lt("expires_at", cutoffDate)
          .execute();

        if (error) {
          logger.category("database").error("Failed to fetch expired entitlements before cutoff:", {
            cutoffDate,
            message: error.message,
            code: error.code,
          });
          throw new Error(`Failed to fetch expired entitlements: ${error.message}`);
        }

        return (data || []) as EntitlementRow[];
      },
      dbRequestOptions("list", "user"),
    );
    return result ?? [];
  }

  async deactivate(entitlementIds: string[]): Promise<void> {
    if (entitlementIds.length === 0) return;

    await fetchRequest(
      `entitlements:deactivate:${entitlementIds.join(",")}`,
      async () => {
        const { error } = await getDatabase()
          .from("entitlements", "feature_flags")
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .in("id", entitlementIds)
          .execute();

        if (error) {
          logger.category("database").error("Failed to deactivate entitlements:", {
            count: entitlementIds.length,
            message: error.message,
            code: error.code,
          });
          throw new Error(`Failed to deactivate entitlements: ${error.message}`);
        }
      },
      dbRequestOptions("update", "user"),
    );
  }
}
