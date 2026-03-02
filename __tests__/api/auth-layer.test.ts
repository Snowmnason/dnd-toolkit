/**
 * AuthLayer Integration Tests
 *
 * Tests auth token injection, 401 handling, per-strategy locking,
 * and integration with RequestManager
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AuthLayer,
  type AuthContext,
  type AuthStrategy,
} from "../../lib/auth/auth-layer";

// Mock logger to avoid noise in tests
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

describe("AuthLayer", () => {
  beforeEach(() => {
    AuthLayer.clearAuthStrategies();
  });

  describe("Strategy Registration", () => {
    it("should register auth strategy by name", () => {
      const strategy: AuthStrategy = {
        async getToken() {
          return "test-token";
        },
      };

      AuthLayer.registerAuthStrategy("test", strategy);

      expect(AuthLayer.getAuthStrategy("test")).toBe(strategy);
    });

    it("should get registered strategies list", () => {
      const strategy1: AuthStrategy = {
        async getToken() {
          return "token1";
        },
      };

      const strategy2: AuthStrategy = {
        async getToken() {
          return "token2";
        },
      };

      AuthLayer.registerAuthStrategy("user", strategy1);
      AuthLayer.registerAuthStrategy("service", strategy2);

      const strategies = AuthLayer.getRegisteredStrategies();
      expect(strategies).toContain("user");
      expect(strategies).toContain("service");
      expect(strategies.length).toBe(2);
    });

    it("should return undefined for unregistered strategy", () => {
      expect(AuthLayer.getAuthStrategy("nonexistent")).toBeUndefined();
    });

    it("should clear all strategies", () => {
      AuthLayer.registerAuthStrategy("user", {
        async getToken() {
          return "token";
        },
      });

      AuthLayer.clearAuthStrategies();
      expect(AuthLayer.getRegisteredStrategies().length).toBe(0);
    });
  });

  describe("Token Injection", () => {
    it("should inject bearer token header", async () => {
      const strategy: AuthStrategy = {
        async getToken() {
          return "test-token-123";
        },
      };

      AuthLayer.registerAuthStrategy("test", strategy);

      const headers = await AuthLayer.injectAuthHeader(
        { "Content-Type": "application/json" },
        "test",
        { url: "http://example.com/api", method: "GET" },
      );

      expect(headers.Authorization).toBe("Bearer test-token-123");
      expect(headers["Content-Type"]).toBe("application/json");
    });

    it("should return original headers if token is null", async () => {
      const strategy: AuthStrategy = {
        async getToken() {
          return null;
        },
      };

      AuthLayer.registerAuthStrategy("test", strategy);

      const originalHeaders = { "Content-Type": "application/json" };
      const headers = await AuthLayer.injectAuthHeader(
        originalHeaders,
        "test",
        { url: "http://example.com/api", method: "GET" },
      );

      expect(headers).toEqual(originalHeaders);
      expect(headers.Authorization).toBeUndefined();
    });

    it("should return original headers if strategy not found", async () => {
      const originalHeaders = { "Content-Type": "application/json" };
      const headers = await AuthLayer.injectAuthHeader(
        originalHeaders,
        "nonexistent",
        { url: "http://example.com/api", method: "GET" },
      );

      expect(headers).toEqual(originalHeaders);
    });

    it("should pass context to strategy", async () => {
      const getTokenSpy = vi.fn(async () => "token");
      const strategy: AuthStrategy = {
        getToken: getTokenSpy,
      };

      AuthLayer.registerAuthStrategy("test", strategy);

      const context: AuthContext = {
        url: "http://example.com/api/users",
        method: "POST",
        endpoint: "users",
        retryCount: 0,
      };

      await AuthLayer.injectAuthHeader({}, "test", context);

      expect(getTokenSpy).toHaveBeenCalledWith(context);
    });

    it("should handle strategy.getToken() errors gracefully", async () => {
      const strategy: AuthStrategy = {
        async getToken() {
          throw new Error("Token fetch failed");
        },
      };

      AuthLayer.registerAuthStrategy("test", strategy);

      const headers = await AuthLayer.injectAuthHeader(
        { "Content-Type": "application/json" },
        "test",
        { url: "http://example.com/api", method: "GET" },
      );

      // Should return original headers without Authorization
      expect(headers["Content-Type"]).toBe("application/json");
      expect(headers.Authorization).toBeUndefined();
    });
  });

  describe("401 Handling with Per-Strategy Locking", () => {
    it("should call onTokenExpire on 401 response", async () => {
      const onTokenExpireSpy = vi.fn();
      const strategy: AuthStrategy = {
        async getToken() {
          return "token";
        },
        async onTokenExpire() {
          await onTokenExpireSpy();
        },
      };

      AuthLayer.registerAuthStrategy("test", strategy);

      const context: AuthContext = {
        url: "http://example.com/api",
        method: "GET",
        endpoint: "test",
        retryCount: 0,
      };

      await AuthLayer.handle401Response("test", context);

      expect(onTokenExpireSpy).toHaveBeenCalledTimes(1);
    });

    it("should use per-strategy lock for concurrent 401s", async () => {
      let refreshCount = 0;
      const strategy: AuthStrategy = {
        async getToken() {
          return "token";
        },
        async onTokenExpire() {
          refreshCount++;
          // Simulate async refresh
          await new Promise((resolve) => setTimeout(resolve, 50));
        },
      };

      AuthLayer.registerAuthStrategy("user", strategy);

      const context: AuthContext = {
        url: "http://example.com/api",
        method: "GET",
        retryCount: 0,
      };

      // Fire three concurrent 401s for same strategy
      await Promise.all([
        AuthLayer.handle401Response("user", context),
        AuthLayer.handle401Response("user", context),
        AuthLayer.handle401Response("user", context),
      ]);

      // Should only refresh once due to locking
      expect(refreshCount).toBe(1);
    });

    it("should handle concurrent 401s on different strategies independently", async () => {
      let userRefreshCount = 0;
      let serviceRefreshCount = 0;

      const userStrategy: AuthStrategy = {
        async getToken() {
          return "user-token";
        },
        async onTokenExpire() {
          userRefreshCount++;
          await new Promise((resolve) => setTimeout(resolve, 50));
        },
      };

      const serviceStrategy: AuthStrategy = {
        async getToken() {
          return "service-token";
        },
        async onTokenExpire() {
          serviceRefreshCount++;
          await new Promise((resolve) => setTimeout(resolve, 50));
        },
      };

      AuthLayer.registerAuthStrategy("user", userStrategy);
      AuthLayer.registerAuthStrategy("service", serviceStrategy);

      const context: AuthContext = {
        url: "http://example.com/api",
        method: "GET",
        retryCount: 0,
      };

      // Concurrent 401s on different strategies
      await Promise.all([
        AuthLayer.handle401Response("user", context),
        AuthLayer.handle401Response("user", context),
        AuthLayer.handle401Response("service", context),
        AuthLayer.handle401Response("service", context),
      ]);

      // Each strategy should refresh once independently
      expect(userRefreshCount).toBe(1);
      expect(serviceRefreshCount).toBe(1);
    });

    it("should set isRefreshing flag during token refresh", async () => {
      let isRefreshingDuringCall = false;
      const strategy: AuthStrategy = {
        async getToken() {
          return "token";
        },
        async onTokenExpire() {
          // Check flag during refresh - need to yield to event loop first
          // so the promise executor can run
          await Promise.resolve();
          isRefreshingDuringCall = AuthLayer.isRefreshing("test");
          await new Promise((resolve) => setTimeout(resolve, 10));
        },
      };

      AuthLayer.registerAuthStrategy("test", strategy);

      const context: AuthContext = {
        url: "http://example.com/api",
        method: "GET",
        retryCount: 0,
      };

      const refreshPromise = AuthLayer.handle401Response("test", context);

      // Should be refreshing immediately (lock is set before returning promise)
      expect(AuthLayer.isRefreshing("test")).toBe(true);

      // Wait a microtask to ensure the async IIFE actually starts
      await Promise.resolve();

      await refreshPromise;

      // Should be done refreshing
      expect(AuthLayer.isRefreshing("test")).toBe(false);
      // During the refresh callback, flag should have been true
      expect(isRefreshingDuringCall).toBe(true);
    });

    it("should clear isRefreshing flag even if onTokenExpire throws", async () => {
      const strategy: AuthStrategy = {
        async getToken() {
          return "token";
        },
        async onTokenExpire() {
          throw new Error("Refresh failed");
        },
      };

      AuthLayer.registerAuthStrategy("test", strategy);

      const context: AuthContext = {
        url: "http://example.com/api",
        method: "GET",
        retryCount: 0,
      };

      try {
        await AuthLayer.handle401Response("test", context);
      } catch {
        // Expected to throw
      }

      // Lock should be cleared despite error
      expect(AuthLayer.isRefreshing("test")).toBe(false);
    });

    it("should not call onTokenExpire if strategy not found", async () => {
      const context: AuthContext = {
        url: "http://example.com/api",
        method: "GET",
        retryCount: 0,
      };

      // Should not throw, just log warning
      await AuthLayer.handle401Response("nonexistent", context);

      expect(AuthLayer.isRefreshing("nonexistent")).toBe(false);
    });

    it("should return same promise for concurrent lock acquisitions", async () => {
      const strategy: AuthStrategy = {
        async getToken() {
          return "token";
        },
        async onTokenExpire() {
          await new Promise((resolve) => setTimeout(resolve, 50));
        },
      };

      AuthLayer.registerAuthStrategy("test", strategy);

      const context: AuthContext = {
        url: "http://example.com/api",
        method: "GET",
        retryCount: 0,
      };

      // Get both promises synchronously (before the first promise executes)
      const promise1 = AuthLayer.handle401Response("test", context);
      const promise2 = AuthLayer.handle401Response("test", context);

      // Mark promise1 to verify it's the same object
      (promise1 as any)._test_marker = "same_promise";

      // Should be same promise object (lock mechanism returns cached promise)
      expect((promise2 as any)._test_marker).toBe("same_promise");
      expect(promise1).toBe(promise2);

      // Both should resolve to undefined
      const result1 = await promise1;
      const result2 = await promise2;
      expect(result1).toBeUndefined();
      expect(result2).toBeUndefined();
    });
  });

  describe("Context Passing to Strategy", () => {
    it("should pass endpoint in context", async () => {
      const getTokenSpy = vi.fn(async () => null);
      const strategy: AuthStrategy = {
        getToken: getTokenSpy,
      };

      AuthLayer.registerAuthStrategy("test", strategy);

      await AuthLayer.injectAuthHeader({}, "test", {
        url: "http://example.com/api/users",
        method: "POST",
        endpoint: "admin",
        retryCount: 1,
      });

      expect(getTokenSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: "admin",
          retryCount: 1,
        }),
      );
    });

    it("should allow strategy to make decisions based on endpoint", async () => {
      const strategy: AuthStrategy = {
        async getToken(context) {
          // Different token based on endpoint
          if (context.endpoint?.startsWith("admin/")) {
            return "admin-token";
          }
          return "user-token";
        },
      };

      AuthLayer.registerAuthStrategy("test", strategy);

      const userHeaders = await AuthLayer.injectAuthHeader({}, "test", {
        url: "http://example.com/api/worlds",
        method: "GET",
        endpoint: "worlds",
      });

      const adminHeaders = await AuthLayer.injectAuthHeader({}, "test", {
        url: "http://example.com/api/admin/users",
        method: "GET",
        endpoint: "admin/users",
      });

      expect(userHeaders.Authorization).toBe("Bearer user-token");
      expect(adminHeaders.Authorization).toBe("Bearer admin-token");
    });
  });
});
