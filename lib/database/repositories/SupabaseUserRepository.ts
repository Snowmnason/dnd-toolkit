import { dbRequestOptions } from "@/config";
import { RequestManager } from "@/lib/api/request-manager";
import { getCurrentSession } from "@/lib/auth";
import { getDatabase } from "@/lib/services";
import { logger } from "@/lib/utils/logger";
import { validateUsername } from "@/validation/validation";
import type {
  CacheOptions,
  CreateUserData,
  UpdateUserData,
  User,
  UserRepository,
} from "./repo-types";

/**
 * Supabase implementation of UserRepository.
 *
 * Manages user profile CRUD operations. All mutations operate on the authenticated user.
 * Provides caching for reads and cache invalidation on writes.
 */
export class SupabaseUserRepository implements UserRepository {
  async create(userData: CreateUserData): Promise<User> {
    return RequestManager.fetch(
      `user:create:${userData.auth_id}`,
      async () => {
        logger.category("database").info("Starting user profile creation", {
          auth_id: userData.auth_id,
          username: userData.username,
          usernameLength: userData.username?.length,
        });

        // Validate and sanitize username if provided
        if (userData.username) {
          const usernameValidation = validateUsername(userData.username);
          logger.category("database").debug("Username validation result:", {
            isValid: usernameValidation.isValid,
            sanitized: usernameValidation.sanitized,
            original: userData.username,
          });

          if (!usernameValidation.isValid) {
            logger.category("database").error("Username validation failed");
            throw new Error("Username contains invalid characters or format");
          }
          userData.username = usernameValidation.sanitized;
        }

        logger.category("database").debug("Inserting user data into database:", userData);

        const { data, error } = await getDatabase()
          .from("users", "public")
          .insert(userData)
          .select()
          .single();

        if (error) {
          logger.category("database").error("Database error during user creation:", {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
          });
          throw new Error(error.message || "Failed to create user profile");
        }

        logger.category("database").info("User profile created successfully:", {
          id: data.id,
          auth_id: data.auth_id,
          username: data.username,
          created_at: data.created_at,
        });

        return data;
      },
      dbRequestOptions("create", "user"),
    );
  }

  async createWithDefaults(authId: string): Promise<User> {
    const defaultUserData: CreateUserData = {
      auth_id: authId,
      username: `user_${authId.slice(-8)}`, // Default username using last 8 chars of auth_id
      is_admin: false,
    };

    return this.create(defaultUserData);
  }

  // NOTE: CacheOptions is accepted for interface compatibility, but caching is the
  // responsibility of the caller (lib/database/users.ts). This implementation always
  // fetches from the database.
  async getCurrentUser(_options?: CacheOptions): Promise<User | null> {
    const user = await RequestManager.fetch(
      `user:current`,
      async () => {
        const session = await getCurrentSession();
        if (!session?.userId) {
          logger.category("database").debug("No authenticated user found");
          return null;
        }

        const { data, error } = await getDatabase()
          .from("users", "public")
          .select("*")
          .eq("auth_id", session.userId)
          .single();

        if (error) {
          if (error.code === "PGRST116") {
            // User doesn't exist yet (during signup flow)
            logger
              .category("database")
              .debug("User profile does not exist yet (during signup flow)");
            return null;
          }
          logger
            .category("database")
            .error("Failed to fetch current user:", {
              message: error.message,
              code: error.code,
              details: error.details,
            });
          throw new Error(error.message || "Failed to fetch user profile");
        }

        logger
          .category("database")
          .info("User profile fetched from database:", {
            id: data.id,
            username: data.username,
          });

        return data;
      },
      dbRequestOptions("read", "user"),
    );

    return user;
  }

  async updateCurrentUser(updates: UpdateUserData): Promise<User> {
    logger.category("database").debug("Starting updateCurrentUser", updates);

    // Get current user
    const currentUser = await this.getCurrentUser({ forceRefresh: true });
    if (!currentUser) {
      throw new Error("No authenticated user found");
    }

    // Validate username if being updated
    if (updates.username) {
      const usernameValidation = validateUsername(updates.username);
      if (!usernameValidation.isValid) {
        throw new Error("Username contains invalid characters or format");
      }
      updates.username = usernameValidation.sanitized;
    }

    return RequestManager.fetch(
      `user:update:${currentUser.id}`,
      async () => {
        const { data, error } = await getDatabase()
          .from("users", "public")
          .update(updates)
          .eq("id", currentUser.id)
          .select()
          .single();

        if (error) {
          logger.category("database").error("Failed to update user:", {
            message: error.message,
            code: error.code,
            details: error.details,
          });
          throw new Error(error.message || "Failed to update user profile");
        }

        logger
          .category("database")
          .info("User profile updated successfully:", {
            id: data.id,
            username: data.username,
          });

        return data;
      },
      dbRequestOptions("update", "user"),
    );
  }

  async deleteCurrentUser(): Promise<boolean> {
    logger.category("database").debug("Starting deleteCurrentUser");

    const result = await RequestManager.fetch(
      `user:delete:${Date.now()}`,
      async () => {
        // SECURITY-CRITICAL: Account deletion requires server-side validation.
        // Delegates to the delete-account edge function which handles cascading
        // deletes, audit logging, and auth account removal atomically.
        // getRawClient() is the intentional escape hatch for Supabase-only APIs
        // (edge functions, realtime) that are not covered by DatabaseProvider.
        const rawClient = getDatabase().getRawClient?.();
        if (!rawClient) {
          throw new Error(
            "deleteCurrentUser requires a configured Supabase client (edge function call)",
          );
        }

        const { data, error } = await rawClient.functions.invoke("delete-account");
        if (error) {
          logger.category("database").error("Failed to delete account via edge function:", {
            message: error.message,
          });
          throw new Error(error.message || "Failed to delete account");
        }

        logger.category("database").debug("Account deletion edge function response:", data);
        return true;
      },
      dbRequestOptions("rpc", "user", { timeout: 15000 }),
    );

    // RequestManager may return null if failOpen is configured; normalize to boolean
    return result ?? false;
  }
}
