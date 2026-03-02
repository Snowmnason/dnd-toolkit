import { QueryCache } from "@/lib/storage";
import { logger } from "@/lib/utils";
import { validateUsername } from "../../validation/validation";
import { getUserRepository } from "./repositories";

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

export const usersDB = {
  // Create a new user profile (called after auth signup) with input validation
  async create(userData: CreateUserData): Promise<User> {
    // Username validation before hitting DB (business rule, caught early)
    if (userData.username) {
      const usernameValidation = validateUsername(userData.username);
      if (!usernameValidation.isValid) {
        throw new Error("Username contains invalid characters or format");
      }
      userData = { ...userData, username: usernameValidation.sanitized };
    }

    const data = await getUserRepository().create(userData);

    // Save user data to local storage (caller cache responsibility)
    try {
      const { AuthStateManager } = await import("../auth/auth-state");
      await AuthStateManager.saveUserData(data);
    } catch (storageError) {
      logger.category("database").warn("Failed to save user data to storage (non-critical):", storageError);
    }

    return data;
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
  async getCurrentUser(options?: { maxAgeMs?: number; forceRefresh?: boolean }): Promise<User | null> {
    logger.category("database").debug("Starting getCurrentUser", options);

    const maxAgeMs = options?.maxAgeMs ?? (4 * 60 * 60 * 1000); // Default 4 hours
    const forceRefresh = options?.forceRefresh ?? false;

    // First, try to get from local storage (unless forced refresh)
    if (!forceRefresh) {
      try {
        const { AuthStateManager } = await import("../auth/auth-state");
        const { SecureStorage } = await import("@/system/Storage");
        const { STORAGE_KEYS } = await import("@/maps");

        const cachedUser = await AuthStateManager.getUserData();
        const cacheMeta = await SecureStorage.getJSON<{ timestamp: number }>(
          `${STORAGE_KEYS.USER_DATA}_meta`,
        );

        // Cache is valid only if both user data and metadata exist, and metadata is fresh
        if (cachedUser && cacheMeta) {
          const cacheAge = Date.now() - cacheMeta.timestamp;
          const isCacheFresh = cacheAge < maxAgeMs;

          if (isCacheFresh) {
            logger.category("database").debug(`User profile loaded from cache (age: ${cacheAge}ms)`);
            return cachedUser;
          }
          // Cache is stale - fall through to fetch from DB
          logger.category("database").debug(`User profile cache stale (age: ${cacheAge}ms), refreshing from database`);
        }
        // If meta is missing or cache is missing, treat as cache miss and fetch from DB
      } catch (storageError) {
        logger.category("database").warn("Could not load from storage, fetching from DB:", storageError);
      }
    } else {
      logger.category("database").debug("Force refresh requested, skipping cache");
    }

    // Fetch from database via repository
    const data = await getUserRepository().getCurrentUser();

    if (!data) {
      logger.category("database").debug("User profile is null - new user without profile yet");
      return null;
    }

    logger.category("database").info("User profile fetched successfully:", {
      id: data.id,
      auth_id: data.auth_id,
      username: data.username,
      created_at: data.created_at,
    });

    // Save user data to local storage + metadata with fresh timestamp
    try {
      const { AuthStateManager } = await import("../auth/auth-state");
      const { SecureStorage } = await import("@/system/Storage");
      const { STORAGE_KEYS } = await import("@/maps");

      await AuthStateManager.saveUserData(data);
      await SecureStorage.setJSON(`${STORAGE_KEYS.USER_DATA}_meta`, {
        timestamp: Date.now(),
        source: "supabase",
      });
    } catch (storageError) {
      logger.category("database").warn("Failed to save user data to storage (non-critical):", storageError);
    }

    return data;
  },

  // Update current user's profile with input validation
  async updateCurrentUser(updates: UpdateUserData): Promise<User> {
    // Validate and sanitize username before hitting DB (business rule, caught early)
    if (updates.username) {
      const usernameValidation = validateUsername(updates.username);
      if (!usernameValidation.isValid) {
        throw new Error("Username contains invalid characters or format");
      }
      updates = { ...updates, username: usernameValidation.sanitized };
    }

    const data = await getUserRepository().updateCurrentUser(updates);

    // Invalidate user profile cache (caller cache responsibility)
    await QueryCache.invalidateByTags(["users", `user:${data.id}`]);

    // Save updated user data to local storage
    try {
      const { AuthStateManager } = await import("../auth/auth-state");
      await AuthStateManager.saveUserData(data);
    } catch (storageError) {
      logger.category("database").warn("Failed to save updated user data to storage (non-critical):", storageError);
    }

    return data;
  },

  async deleteCurrentUser(): Promise<boolean> {
    const result = await getUserRepository().deleteCurrentUser();

    // Invalidate user profile cache on successful deletion
    if (result) {
      await QueryCache.invalidateByTags(["users"]);
    }

    return result;
  },
};
