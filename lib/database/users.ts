import { RequestManager } from "../api/request-manager";
import { validateUsername } from "../auth/validation";
import { QueryCache } from "../cache";
import { logger } from "../utils/logger";
import { validateCurrentUser, validateUserForWrite } from "./common";
import { supabase } from "./supabase";

export interface User {
  id: string;
  auth_id: string;
  username: string;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CreateUserData {
  auth_id: string;
  username: string;
  is_admin?: boolean;
}

export interface UpdateUserData {
  username?: string;
  is_admin?: boolean;
}

export interface UserSettings {
  user_id: string;
  theme: string;
  language: string;
  timezone: string;
  preferences: Record<string, unknown>;
  updated_at: string;
}

export const usersDB = {
  // Create a new user profile (called after auth signup) with input validation
  async create(userData: CreateUserData): Promise<User> {
    return RequestManager.fetch(
      `user:create:${userData.auth_id}`,
      async () => {
        logger.info("storage", "Starting user profile creation", {
          auth_id: userData.auth_id,
          username: userData.username,
          usernameLength: userData.username?.length,
        });

        // Validate and sanitize username if provided
        if (userData.username) {
          const usernameValidation = validateUsername(userData.username);
          logger.debug("storage", "Username validation result:", {
            isValid: usernameValidation.isValid,
            sanitized: usernameValidation.sanitized,
            original: userData.username,
          });

          if (!usernameValidation.isValid) {
            logger.error("storage", "Username validation failed");
            throw new Error("Username contains invalid characters or format");
          }
          userData.username = usernameValidation.sanitized;
        }

        // Note: display_name removed from schema
        logger.debug("storage", "Inserting user data into database:", userData);

        const { data, error } = await supabase
          .schema('public')
          .from('users')
          .insert(userData)
          .select()
          .single();

        if (error) {
          logger.error("storage", "Database error during user creation:", {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
          });
          throw new Error(error.message || "Failed to create user profile");
        }

        logger.info("storage", "User profile created successfully:", {
          id: data.id,
          auth_id: data.auth_id,
          username: data.username,
          created_at: data.created_at,
        });

        // Save user data to local storage
        try {
          const { AuthStateManager } = await import("../auth/auth-state");
          await AuthStateManager.saveUserData(data);
        } catch (storageError) {
          logger.warn(
            "storage",
            "Failed to save user data to storage (non-critical):",
            storageError,
          );
        }

        return data;
      },
      {
        dedupe: false,
        retries: 3,
        timeout: 15000,
        authStrategy: "user",
      },
    );
  },

  // Create user with default values after signup (called from auth triggers or signup)
  async createWithDefaults(authId: string): Promise<User> {
    const defaultUserData: CreateUserData = {
      auth_id: authId,
      username: `user_${authId.slice(-8)}`, // Default username using last 8 chars of auth_id
      is_admin: false,
    };

    return this.create(defaultUserData);
  },

  // Get current user's profile
  async getCurrentUser(): Promise<User | null> {
    logger.debug("storage", "Starting getCurrentUser");

    // First, try to get from local storage to avoid DB call
    try {
      const { AuthStateManager } = await import("../auth/auth-state");
      const cachedUser = await AuthStateManager.getUserData();

      if (cachedUser) {
        logger.debug(
          "storage",
          "User profile loaded from storage (avoiding DB call):",
          {
            id: cachedUser.id,
            username: cachedUser.username,
            is_admin: cachedUser.is_admin,
          },
        );
        return cachedUser;
      }
    } catch (storageError) {
      logger.warn(
        "storage",
        "Could not load from storage, fetching from DB:",
        storageError,
      );
    }

    // If not in storage, fetch from database
    // Use cached session instead of making network call (getUser)
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();

    logger.debug("storage", "Auth session check result:", {
      hasSession: !!session,
      userId: session?.user?.id,
      authError: authError?.message,
    });

    if (authError) {
      logger.error("storage", "Auth error in getCurrentUser:", authError);
      throw new Error(authError.message || "Authentication error");
    }

    if (!session?.user) {
      logger.debug("storage", "No authenticated user found (no session)");
      return null;
    }

    const authUser = session.user;
    const authId = authUser.id;

    logger.debug(
      "storage",
      "Fetching user profile from database for auth_id:",
      authId,
    );

    // Use RequestManager to wrap database fetch
    // (storage-to-DB fallback is not deduplicated, only the DB call)
    const data = await RequestManager.fetch(
      `user:profile:${authId}`,
      async () => {
        const { data, error } = await supabase
          .schema('public')
          .from('users')
          .select("*")
          .eq("auth_id", authId)
          .single();

        if (error) {
          if (error.code === "PGRST116") {
            // This is expected for new users who haven't created a profile yet
            logger.debug(
              "storage",
              "No profile exists yet for user - this is expected for new users",
            );
            return null;
          }

          // Only log as error for unexpected database issues
          logger.error(
            "storage",
            "Unexpected database error in getCurrentUser:",
            {
              message: error.message,
              code: error.code,
              details: error.details,
              hint: error.hint,
              auth_id: authId,
            },
          );

          throw new Error(error.message || "Failed to fetch user profile");
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
      // Note: null only means profile doesn't exist for new user (PGRST116 error).
      // RequestManager errors are thrown (failOpen defaults to false), not returned as null.
      logger.debug(
        "storage",
        "User profile is null - new user without profile yet",
        {
          userId: authId,
        },
      );
      return null;
    }

    logger.info("storage", "User profile fetched successfully:", {
      id: data.id,
      auth_id: data.auth_id,
      username: data.username,
      created_at: data.created_at,
    });

    // Save user data to local storage to avoid future database calls
    try {
      const { AuthStateManager } = await import("../auth/auth-state");
      await AuthStateManager.saveUserData(data);
    } catch (storageError) {
      logger.warn(
        "storage",
        "Failed to save user data to storage (non-critical):",
        storageError,
      );
    }

    return data;
  },

  // Update current user's profile with input validation
  async updateCurrentUser(updates: UpdateUserData): Promise<User> {
    return RequestManager.fetch(
      `user:update:${Date.now()}`,
      async () => {
        // Validate before write operation
        const authUser = await validateUserForWrite();

        // Validate and sanitize username if being updated
        if (updates.username) {
          const usernameValidation = validateUsername(updates.username);
          if (!usernameValidation.isValid) {
            throw new Error("Username contains invalid characters or format");
          }
          updates.username = usernameValidation.sanitized;
        }

        // Note: display_name removed from schema

        const { data, error } = await supabase
          .schema('public')
          .from('users')
          .update(updates)
          .eq("auth_id", authUser.id)
          .select()
          .single();

        if (error) {
          logger.error("storage", "Error updating user profile:", error);
          throw new Error(error.message || "Failed to update user profile");
        }

        // Invalidate user profile cache
        await QueryCache.invalidateByTags(["users", `user:${data.id}`]);

        // Save updated user data to local storage
        try {
          const { AuthStateManager } = await import("../auth/auth-state");
          await AuthStateManager.saveUserData(data);
        } catch (storageError) {
          logger.warn(
            "storage",
            "Failed to save updated user data to storage (non-critical):",
            storageError,
          );
        }

        return data;
      },
      {
        dedupe: false,
        retries: 3,
        timeout: 15000,
        authStrategy: "user",
      },
    );
  },

  async deleteCurrentUser(): Promise<boolean> {
    const result = await RequestManager.fetch(
      `user:delete:${Date.now()}`,
      async () => {
        // SECURITY-CRITICAL: Account deletion requires server validation
        // Must use validateCurrentUser() to ensure user is truly authenticated with server
        const user = await validateCurrentUser();
        if (!user) throw new Error("Not authenticated");

        // call your Edge Function by name (no URL needed, no body needed)
        const { data, error: fnError } =
          await supabase.functions.invoke("delete-account");
        if (fnError)
          throw new Error(fnError.message || "Failed to delete account");
        logger.debug("storage", "Account deletion function response:", data);
        return true;
      },
      {
        dedupe: false,
        retries: 3,
        timeout: 15000,
        authStrategy: "user",
      },
    );

    // RequestManager may return null if failOpen is enabled; normalize to boolean
    return result ?? false;
  },
};
