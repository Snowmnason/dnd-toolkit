/**
 * Worlds API Client
 *
 * Domain-specific client for world/campaign-related endpoints
 * Demonstrates query and mutation patterns with nested resources
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
export interface World {
  world_id: string;
  name: string;
  description?: string;
  owner_id: string;
  createdAt: string;
}

export interface CreateWorldRequest {
  name: string;
  description?: string;
}

export interface UpdateWorldRequest {
  name?: string;
  description?: string;
}

export interface WorldMember {
  user_id: string;
  world_id: string;
  role: "owner" | "admin" | "editor" | "viewer";
}

/**
 * WorldsAPI client
 * Handles world/campaign management with member operations
 */
export class WorldsAPI extends APIClient {
  constructor() {
    super({
      baseUrl: "/api/worlds",
      authStrategy: "user", // Requires authenticated user
      circuitBreakerKey: "worlds",
      defaultTags: ["worlds"],
      ...CACHE_DEFAULTS.world,
    });
  }
  /**
   * Get all worlds for current user (owned and shared)
   * Cached per-user
   */
  async getMyWorlds(userId: string, options?: Partial<QueryOptions<World[]>>) {
    return this.query<World[]>("getMyWorlds", `/user/${userId}`, {
      tags: [`user:${userId}:worlds`, "worlds"],
      ...options,
    });
  }

  /**
   * Get single world by ID
   */
  async getWorld(worldId: string, options?: Partial<QueryOptions<World>>) {
    return this.query<World>("getWorld", `/${worldId}`, {
      tags: [`world:${worldId}`],
      ...options,
    });
  }

  /**
   * Create new world
   * Invalidates user's world list on success
   */
  async createWorld(
    userId: string,
    data: CreateWorldRequest,
    options?: Partial<MutationOptions<World>>,
  ) {
    return this.mutation<World>("createWorld", "", data, {
      method: "POST",
      invalidateTags: [`user:${userId}:worlds`, "worlds"],
      ...options,
    });
  }

  /**
   * Update world details
   * Invalidates world cache on success
   */
  async updateWorld(
    worldId: string,
    data: UpdateWorldRequest,
    options?: Partial<MutationOptions<World>>,
  ) {
    return this.mutation<World>("updateWorld", `/${worldId}`, data, {
      method: "PATCH",
      invalidateTags: [`world:${worldId}`],
      ...options,
    });
  }

  /**
   * Delete world
   * Invalidates all related caches
   */
  async deleteWorld(worldId: string, options?: Partial<MutationOptions<void>>) {
    return this.mutation<void>("deleteWorld", `/${worldId}`, undefined, {
      method: "DELETE",
      invalidateTags: [`world:${worldId}`, "worlds"],
      ...options,
    });
  }

  /**
   * Get world members
   * Cached per-world
   */
  async getMembers(
    worldId: string,
    options?: Partial<QueryOptions<WorldMember[]>>,
  ) {
    return this.query<WorldMember[]>("getMembers", `/${worldId}/members`, {
      tags: [`world:${worldId}:members`],
      ...options,
    });
  }

  /**
   * Add member to world
   * Invalidates member list on success
   */
  async addMember(
    worldId: string,
    userId: string,
    role: "editor" | "viewer" = "viewer",
    options?: Partial<MutationOptions<WorldMember>>,
  ) {
    return this.mutation<WorldMember>(
      "addMember",
      `/${worldId}/members`,
      { user_id: userId, role },
      {
        method: "POST",
        invalidateTags: [`world:${worldId}:members`, `user:${userId}:worlds`],
        ...options,
      },
    );
  }

  /**
   * Remove member from world
   * Invalidates member list on success
   */
  async removeMember(
    worldId: string,
    userId: string,
    options?: Partial<MutationOptions<void>>,
  ) {
    return this.mutation<void>(
      "removeMember",
      `/${worldId}/members/${userId}`,
      undefined,
      {
        method: "DELETE",
        invalidateTags: [`world:${worldId}:members`, `user:${userId}:worlds`],
        ...options,
      },
    );
  }

  /**
   * Update member role
   * Invalidates member list on success
   */
  async updateMemberRole(
    worldId: string,
    userId: string,
    role: "owner" | "admin" | "editor" | "viewer",
    options?: Partial<MutationOptions<WorldMember>>,
  ) {
    return this.mutation<WorldMember>(
      "updateMemberRole",
      `/${worldId}/members/${userId}`,
      { role },
      {
        method: "PATCH",
        invalidateTags: [`world:${worldId}:members`],
        ...options,
      },
    );
  }
}

export default WorldsAPI;
