/**
 * Unit tests for APIClient factory
 *
 * Verifies:
 * - Cache key generation determinism
 * - Validation/error transformation
 * - Caching behavior (hits, misses, stale fallback)
 * - Batch invalidation via tags
 * - Auth strategy enforcement
 * - Interceptor registration
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

// Now import the client factory after mocking
import type {
    MutationOptions,
    QueryOptions,
} from "../../lib/api/client-factory";
import { APIClient } from "../../lib/api/client-factory";

// Mock logger first to prevent any downstream react-native imports
vi.mock("../../lib/utils/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    category: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

// Mock CircuitBreakerManager
vi.mock("../../lib/api/circuit-breaker", () => ({
  CircuitBreakerManager: {
    getState: vi.fn(),
    recordSuccess: vi.fn(),
    recordFailure: vi.fn(),
  },
}));

// Mock AuthLayer
vi.mock("../../lib/api/auth-layer", () => ({
  AuthLayer: vi.fn(),
}));

// Mock RequestManager
vi.mock("../../lib/api/request-manager", () => ({
  RequestManager: vi.fn(),
}));

// ==========================================
// Test Fixtures & Mocks
// ==========================================

const mockQueryCache = {
  get: vi.fn(),
  set: vi.fn(),
  isStale: vi.fn(),
  invalidateByTags: vi.fn(),
  getCurrentVersion: vi.fn(() => 1),
};

const mockRequestManager = {
  fetch: vi.fn(),
};

const mockAuthLayer = {};

// Test API client
class TestUsersAPI extends APIClient {
  constructor(config?: any) {
    super({
      baseUrl: "/api/users",
      authStrategy: "user",
      circuitBreakerKey: "users",
      defaultTags: ["users"],
      queryCache: mockQueryCache as any,
      requestManager: mockRequestManager as any,
      authLayer: mockAuthLayer as any,
      ...config,
    });
  }

  async getUser(userId: string, options?: Partial<QueryOptions>) {
    return this.query("getUser", `/${userId}`, {
      tags: [`user:${userId}`],
      ...options,
    });
  }

  async updateUser(
    userId: string,
    data: any,
    options?: Partial<MutationOptions>,
  ) {
    return this.mutation("updateUser", `/${userId}`, data, {
      method: "PATCH",
      invalidateTags: [`user:${userId}`, "users"],
      ...options,
    });
  }
}

// ==========================================
// Test Suites
// ==========================================

describe("APIClient Factory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryCache.get.mockResolvedValue(null);
    mockQueryCache.set.mockResolvedValue(undefined);
    mockQueryCache.invalidateByTags.mockResolvedValue(undefined);
    mockRequestManager.fetch.mockResolvedValue({ id: "123", name: "John" });
  });

  // ===== Cache Key Generation (Determinism) =====
  describe("Cache Key Generation", () => {
    it("should generate deterministic cache keys from method and endpoint", () => {
      const api = new TestUsersAPI();

      const key1 = (api as any).generateCacheKey("getUser", "/123");
      const key2 = (api as any).generateCacheKey("getUser", "/123");

      expect(key1).toBe(key2);
      expect(key1).toBe("TestUsersAPI:getUser:/123");
    });

    it("should include client name in cache key", () => {
      const api = new TestUsersAPI();
      const key = (api as any).generateCacheKey("getUser", "/123");

      expect(key).toContain("TestUsersAPI");
    });

    it("should use custom cache key when provided", () => {
      const api = new TestUsersAPI();
      const customKey = (api as any).generateCacheKey(
        "getUser",
        "/123",
        "custom:key",
      );

      expect(customKey).toBe("custom:key");
    });

    it("should generate different keys for different methods", () => {
      const api = new TestUsersAPI();

      const key1 = (api as any).generateCacheKey("getUser", "/123");
      const key2 = (api as any).generateCacheKey("updateUser", "/123");

      expect(key1).not.toBe(key2);
    });

    it("should generate different keys for different endpoints", () => {
      const api = new TestUsersAPI();

      const key1 = (api as any).generateCacheKey("getUser", "/123");
      const key2 = (api as any).generateCacheKey("getUser", "/456");

      expect(key1).not.toBe(key2);
    });
  });

  // ===== URL Building =====
  describe("URL Building", () => {
    it("should build full URL from base and endpoint", () => {
      const api = new TestUsersAPI();
      const url = (api as any).buildUrl("/123");

      expect(url).toBe("/api/users/123");
    });

    it("should handle endpoints with leading slash", () => {
      const api = new TestUsersAPI();
      const url = (api as any).buildUrl("/123");

      expect(url).toBe("/api/users/123");
    });

    it("should handle endpoints without leading slash", () => {
      const api = new TestUsersAPI();
      const url = (api as any).buildUrl("123");

      expect(url).toBe("/api/users/123");
    });

    it("should handle absolute URLs", () => {
      const api = new TestUsersAPI();
      const url = (api as any).buildUrl("https://external.com/api");

      expect(url).toBe("https://external.com/api");
    });

    it("should handle base URL with trailing slash", () => {
      const api = new TestUsersAPI({
        baseUrl: "/api/users/",
      });
      const url = (api as any).buildUrl("123");

      expect(url).toBe("/api/users/123");
    });
  });

  // ===== Query Operations & Caching =====
  describe("Query Operations", () => {
    it("should return cached data on cache hit", async () => {
      const cachedData = { id: "123", name: "John" };
      mockQueryCache.get.mockResolvedValue(cachedData);
      mockQueryCache.isStale.mockResolvedValue(false);

      const api = new TestUsersAPI();
      const result = await api.getUser("123");

      expect(result).toEqual(cachedData);
      expect(mockRequestManager.fetch).not.toHaveBeenCalled();
    });

    it("should skip cache on cache miss", async () => {
      mockQueryCache.get.mockResolvedValue(null);
      mockQueryCache.isStale.mockResolvedValue(false);
      const responseData = { id: "123", name: "John" };
      mockRequestManager.fetch.mockResolvedValue(responseData);

      const api = new TestUsersAPI();
      const result = await api.getUser("123");

      expect(result).toEqual(responseData);
      expect(mockRequestManager.fetch).toHaveBeenCalled();
    });

    it("should refetch on stale cache", async () => {
      mockQueryCache.get.mockResolvedValue({ id: "123", name: "OldName" });
      mockQueryCache.isStale.mockResolvedValue(true);
      const newData = { id: "123", name: "NewName" };
      mockRequestManager.fetch.mockResolvedValue(newData);

      const api = new TestUsersAPI();
      const result = await api.getUser("123");

      expect(result).toEqual(newData);
      expect(mockRequestManager.fetch).toHaveBeenCalled();
    });

    it("should validate response with Zod schema", async () => {
      mockQueryCache.get.mockResolvedValue(null);
      mockQueryCache.isStale.mockResolvedValue(false);

      const schema = z.object({
        id: z.string(),
        name: z.string(),
      });

      const responseData = { id: "123", name: "John" };
      mockRequestManager.fetch.mockResolvedValue(responseData);

      const api = new TestUsersAPI();
      const result = await api.getUser("123", { responseSchema: schema });

      expect(result).toEqual(responseData);
    });

    it("should fail on invalid response schema", async () => {
      mockQueryCache.get.mockResolvedValue(null);
      mockQueryCache.isStale.mockResolvedValue(false);

      const schema = z.object({
        id: z.string(),
        name: z.string(),
      });

      mockRequestManager.fetch.mockResolvedValue({ id: "123" });

      const api = new TestUsersAPI();

      await expect(
        api.getUser("123", { responseSchema: schema }),
      ).rejects.toThrow();
    });

    it("should cache validated data", async () => {
      mockQueryCache.get.mockResolvedValue(null);
      mockQueryCache.isStale.mockResolvedValue(false);

      const schema = z.object({
        id: z.string(),
        name: z.string(),
      });

      const responseData = { id: "123", name: "John" };
      mockRequestManager.fetch.mockResolvedValue(responseData);

      const api = new TestUsersAPI();
      await api.getUser("123", { responseSchema: schema });

      expect(mockQueryCache.set).toHaveBeenCalledWith(
        expect.stringContaining("getUser"),
        responseData,
        expect.objectContaining({
          tags: ["user:123"],
        }),
        expect.any(Number),
      );
    });

    it("should return stale cache on fetch error", async () => {
      const staleData = { id: "123", name: "OldName" };
      mockQueryCache.get.mockResolvedValue(staleData);
      mockQueryCache.isStale.mockResolvedValue(true);
      mockRequestManager.fetch.mockRejectedValue(new Error("Network error"));

      const api = new TestUsersAPI();
      const result = await api.getUser("123");

      expect(result).toEqual(staleData);
    });

    it("should throw error if no cache and fetch fails", async () => {
      mockQueryCache.get.mockResolvedValue(null);
      mockQueryCache.isStale.mockResolvedValue(false);
      mockRequestManager.fetch.mockRejectedValue(new Error("Network error"));

      const api = new TestUsersAPI();

      await expect(api.getUser("123")).rejects.toThrow();
    });

    it("should apply custom cache tags", async () => {
      mockQueryCache.get.mockResolvedValue(null);
      mockQueryCache.isStale.mockResolvedValue(false);
      mockRequestManager.fetch.mockResolvedValue({ id: "123" });

      const api = new TestUsersAPI();
      await api.getUser("123", { tags: ["custom:tag"] });

      expect(mockQueryCache.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          tags: ["custom:tag"],
        }),
        expect.any(Number),
      );
    });

    it("should use default tags when not overridden", async () => {
      mockQueryCache.get.mockResolvedValue(null);
      mockQueryCache.isStale.mockResolvedValue(false);
      mockRequestManager.fetch.mockResolvedValue({ id: "123" });

      const api = new TestUsersAPI();
      await api.getUser("123", { tags: undefined });

      expect(mockQueryCache.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          tags: ["users"],
        }),
        expect.any(Number),
      );
    });
  });

  // ===== Mutation Operations & Invalidation =====
  describe("Mutation Operations", () => {
    it("should execute mutation without caching", async () => {
      mockRequestManager.fetch.mockResolvedValue({
        id: "123",
        name: "Updated",
      });

      const api = new TestUsersAPI();
      const result = await api.updateUser("123", { name: "Updated" });

      expect(result).toEqual({ id: "123", name: "Updated" });
    });

    it("should require method in mutation options", async () => {
      const api = new TestUsersAPI();

      await expect(
        api.mutation("test", "/test", {}, { method: undefined as any }),
      ).rejects.toThrow("requires options.method");
    });

    it("should invalidate tags on successful mutation", async () => {
      mockRequestManager.fetch.mockResolvedValue({
        id: "123",
        name: "Updated",
      });

      const api = new TestUsersAPI();
      await api.updateUser("123", { name: "Updated" });

      expect(mockQueryCache.invalidateByTags).toHaveBeenCalledWith([
        "user:123",
        "users",
      ]);
    });

    it("should not invalidate tags on mutation failure", async () => {
      mockRequestManager.fetch.mockRejectedValue(new Error("Failed"));

      const api = new TestUsersAPI();

      try {
        await api.updateUser("123", { name: "Updated" });
      } catch {
        // Expected to fail
      }

      expect(mockQueryCache.invalidateByTags).not.toHaveBeenCalled();
    });

    it("should call onSuccess hook on successful mutation", async () => {
      mockRequestManager.fetch.mockResolvedValue({
        id: "123",
        name: "Updated",
      });
      const onSuccess = vi.fn();

      const api = new TestUsersAPI();
      await api.mutation(
        "update",
        "/123",
        { name: "Updated" },
        {
          method: "PATCH",
          onSuccess,
        },
      );

      expect(onSuccess).toHaveBeenCalledWith({ id: "123", name: "Updated" });
    });

    it("should call onError hook on mutation failure", async () => {
      const error = new Error("Network failed");
      mockRequestManager.fetch.mockRejectedValue(error);
      const onError = vi.fn();

      const api = new TestUsersAPI();

      try {
        await api.mutation(
          "update",
          "/123",
          {},
          {
            method: "PATCH",
            onError,
          },
        );
      } catch {
        // Expected
      }

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ===== Batch Invalidation =====
  describe("Batch Cache Invalidation", () => {
    it("should invalidate multiple tags atomically", async () => {
      mockRequestManager.fetch.mockResolvedValue({ id: "123" });

      const api = new TestUsersAPI();
      await api.updateUser(
        "123",
        {},
        {
          invalidateTags: ["user:123", "users", "custom:tag"],
        },
      );

      expect(mockQueryCache.invalidateByTags).toHaveBeenCalledWith([
        "user:123",
        "users",
        "custom:tag",
      ]);
    });

    it("should not call invalidateByTags if no tags provided", async () => {
      mockRequestManager.fetch.mockResolvedValue({ id: "123" });

      const api = new TestUsersAPI();
      await api.mutation(
        "update",
        "/123",
        {},
        {
          method: "PATCH",
          invalidateTags: [],
        },
      );

      expect(mockQueryCache.invalidateByTags).not.toHaveBeenCalled();
    });
  });

  // ===== Error Transformation =====
  describe("Error Transformation", () => {
    it("should transform 401 to auth error", async () => {
      const errorType = await (new TestUsersAPI() as any).transformError(
        new Response(JSON.stringify({}), { status: 401 }),
      );

      expect(errorType).toEqual({ type: "auth", code: "unauthorized" });
    });

    it("should transform 403 to forbidden auth error", async () => {
      const errorType = await (new TestUsersAPI() as any).transformError(
        new Response(JSON.stringify({}), { status: 403 }),
      );

      expect(errorType).toEqual({ type: "auth", code: "forbidden" });
    });

    it("should transform 404 to not_found error", async () => {
      const errorType = await (new TestUsersAPI() as any).transformError(
        new Response(JSON.stringify({}), { status: 404 }),
      );

      expect(errorType).toEqual({ type: "not_found" });
    });

    it("should transform 408/504 to timeout error", async () => {
      const errorType408 = await (new TestUsersAPI() as any).transformError(
        new Response(JSON.stringify({}), { status: 408 }),
      );
      const errorType504 = await (new TestUsersAPI() as any).transformError(
        new Response(JSON.stringify({}), { status: 504 }),
      );

      expect(errorType408).toEqual({ type: "timeout" });
      expect(errorType504).toEqual({ type: "timeout" });
    });

    it("should transform 429 to rate_limited error", async () => {
      const errorType = await (new TestUsersAPI() as any).transformError(
        new Response(JSON.stringify({}), {
          status: 429,
          headers: { "Retry-After": "60" },
        }),
      );

      expect(errorType).toEqual({
        type: "rate_limited",
        retryAfter: 60,
      });
    });

    it("should transform validation error (4xx with errors field)", async () => {
      const errorType = await (new TestUsersAPI() as any).transformError(
        new Response(JSON.stringify({ errors: { email: "Invalid email" } }), {
          status: 400,
        }),
      );

      expect(errorType).toEqual({
        type: "validation",
        errors: { email: "Invalid email" },
      });
    });

    it("should transform validation error (Zod)", () => {
      const schema = z.object({ id: z.string() });
      const zodError = schema.safeParse({ id: 123 }).error;

      const errorType = (new TestUsersAPI() as any).transformValidationError(
        zodError,
      );

      expect(errorType.type).toBe("validation");
      expect(errorType).toHaveProperty("errors");
    });
  });

  // ===== Interceptor Registration =====
  describe("Interceptor Registration", () => {
    it("should register interceptors", () => {
      const api = new TestUsersAPI();
      const mockInterceptor = { name: "test-interceptor" };

      api.use(mockInterceptor as any);

      expect((api as any).interceptors).toContain(mockInterceptor);
    });

    it("should allow chaining use() calls", () => {
      const api = new TestUsersAPI();
      const interceptor1 = { name: "interceptor1" };
      const interceptor2 = { name: "interceptor2" };

      const result = api.use(interceptor1 as any).use(interceptor2 as any);

      expect(result).toBe(api);
      expect((api as any).interceptors.length).toBe(2);
    });

    it("should store multiple interceptors in order", () => {
      const api = new TestUsersAPI();
      const interceptor1 = { name: "first" };
      const interceptor2 = { name: "second" };

      api.use(interceptor1 as any);
      api.use(interceptor2 as any);

      const interceptors = (api as any).interceptors;
      expect(interceptors[0]).toBe(interceptor1);
      expect(interceptors[1]).toBe(interceptor2);
    });
  });

  // ===== Auth Strategy =====
  describe("Auth Strategy", () => {
    it("should use client-level auth strategy", async () => {
      mockQueryCache.get.mockResolvedValue(null);
      mockQueryCache.isStale.mockResolvedValue(false);
      mockRequestManager.fetch.mockResolvedValue({ id: "123" });

      const api = new TestUsersAPI({
        authStrategy: "user",
      });

      await api.getUser("123");

      expect(mockRequestManager.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Function),
        expect.objectContaining({
          authStrategy: "user",
        }),
      );
    });

    it("should override auth strategy per method", async () => {
      mockQueryCache.get.mockResolvedValue(null);
      mockQueryCache.isStale.mockResolvedValue(false);
      mockRequestManager.fetch.mockResolvedValue({ id: "123" });

      const api = new TestUsersAPI({
        authStrategy: "user",
      });

      await api.getUser("123", { authStrategy: "admin" });

      expect(mockRequestManager.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Function),
        expect.objectContaining({
          authStrategy: "admin",
        }),
      );
    });

    it("should not include authStrategy if not provided", async () => {
      mockQueryCache.get.mockResolvedValue(null);
      mockQueryCache.isStale.mockResolvedValue(false);
      mockRequestManager.fetch.mockResolvedValue({ id: "123" });

      const api = new TestUsersAPI({
        authStrategy: undefined,
      });

      await api.getUser("123");

      const call = mockRequestManager.fetch.mock.calls[0][2];
      expect(call).not.toHaveProperty("authStrategy");
    });
  });

  // ===== Client Mockability =====
  describe("Client Mockability (Dependency Injection)", () => {
    it("should allow injecting custom RequestManager", async () => {
      const customRequestManager = {
        fetch: vi.fn().mockResolvedValue({ id: "123" }),
      };

      const api = new TestUsersAPI({
        requestManager: customRequestManager as any,
      });

      mockQueryCache.get.mockResolvedValue(null);
      mockQueryCache.isStale.mockResolvedValue(false);

      await api.getUser("123");

      expect(customRequestManager.fetch).toHaveBeenCalled();
    });

    it("should allow injecting custom QueryCache", async () => {
      const customQueryCache = {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue(undefined),
        isStale: vi.fn().mockResolvedValue(false),
        invalidateByTags: vi.fn(),
        getCurrentVersion: vi.fn().mockReturnValue(1),
      };

      mockRequestManager.fetch.mockResolvedValue({ id: "123" });

      const api = new TestUsersAPI({
        queryCache: customQueryCache as any,
      });

      await api.getUser("123");

      expect(customQueryCache.get).toHaveBeenCalled();
      expect(customQueryCache.set).toHaveBeenCalled();
    });
  });
});
