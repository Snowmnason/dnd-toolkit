/**
 * Users API Client
 *
 * Domain-specific client for user-related endpoints
 * Demonstrates query and mutation patterns
 */

import {
  APIClient,
  type MutationOptions,
  type QueryOptions,
} from "../client-factory";
import { CACHE_DEFAULTS } from "./defaults";

/**
 * Example request/response types
 * In production, these would come from `lib/schemas` or `types/api`
 */
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  is_admin: boolean;
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
}

/**
 * UsersAPI client
 * Handles all user-related API operations with built-in caching and validation
 */
export class UsersAPI extends APIClient {
  constructor() {
    super({
      baseUrl: "/api/users",
      authStrategy: "user", // Requires authenticated user
      circuitBreakerKey: "users",
      defaultTags: ["users"],
      ...CACHE_DEFAULTS.user,
    });
  }

  /**
   * Get current authenticated user
   * Cached until stale (5 min) or invalidated
   */
  async getCurrentUser(options?: Partial<QueryOptions<User>>) {
    return this.query<User>("getCurrentUser", "/me", {
      tags: ["user:current"],
      ...options,
    });
  }

  /**
   * Get user by ID
   * Cached per-user for 5 minutes
   */
  async getUser(userId: string, options?: Partial<QueryOptions<User>>) {
    return this.query<User>("getUser", `/${userId}`, {
      tags: [`user:${userId}`],
      ...options,
    });
  }

  /**
   * Update user profile
   * Invalidates user cache on success
   */
  async updateUser(
    userId: string,
    data: UpdateUserRequest,
    options?: Partial<MutationOptions<User>>,
  ) {
    return this.mutation<User>("updateUser", `/${userId}`, data, {
      method: "PATCH",
      invalidateTags: [`user:${userId}`, "user:current"],
      ...options,
    });
  }

  /**
   * Delete user account
   * Invalidates all user caches on success
   */
  async deleteUser(userId: string, options?: Partial<MutationOptions<void>>) {
    return this.mutation<void>("deleteUser", `/${userId}`, undefined, {
      method: "DELETE",
      invalidateTags: [`user:${userId}`, "user:current", "users"],
      ...options,
    });
  }
}

export default UsersAPI;
