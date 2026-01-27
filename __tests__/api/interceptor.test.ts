import {
    InterceptorManager,
    type RequestInterceptor,
    parseEndpoint,
} from "@/lib/api/interceptor";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("Interceptor System", () => {
  beforeEach(() => {
    InterceptorManager.clearInterceptors();
  });

  afterEach(() => {
    InterceptorManager.clearInterceptors();
  });

  describe("parseEndpoint", () => {
    it("should extract endpoint from cache key pattern", () => {
      expect(parseEndpoint("worlds:user:123")).toBe("worlds");
      expect(parseEndpoint("users:list:page:1")).toBe("users");
    });

    it("should extract endpoint from URL path", () => {
      expect(parseEndpoint("https://api.example.com/api/worlds")).toBe(
        "worlds",
      );
      expect(parseEndpoint("/api/users/123")).toBe("users");
    });

    it("should extract endpoint from generic path", () => {
      expect(parseEndpoint("/worlds/123")).toBe("worlds");
      expect(parseEndpoint("/users")).toBe("users");
    });

    it("should return undefined for unparseable URLs", () => {
      expect(parseEndpoint("https://example.com")).toBeUndefined();
      expect(parseEndpoint("123")).toBeUndefined();
    });
  });

  describe("Interceptor Registration", () => {
    it("should register and retrieve interceptors", () => {
      const interceptor: RequestInterceptor = { name: "test" };
      InterceptorManager.registerInterceptor(interceptor);

      const interceptors = InterceptorManager.getInterceptors();
      expect(interceptors).toContain(interceptor);
    });

    it("should unregister interceptors", () => {
      const interceptor: RequestInterceptor = { name: "test" };
      InterceptorManager.registerInterceptor(interceptor);
      InterceptorManager.unregisterInterceptor(interceptor);

      const interceptors = InterceptorManager.getInterceptors();
      expect(interceptors).not.toContain(interceptor);
    });

    it("should handle multiple interceptors", () => {
      const interceptor1: RequestInterceptor = { name: "interceptor1" };
      const interceptor2: RequestInterceptor = { name: "interceptor2" };

      InterceptorManager.registerInterceptor(interceptor1);
      InterceptorManager.registerInterceptor(interceptor2);

      const interceptors = InterceptorManager.getInterceptors();
      expect(interceptors).toHaveLength(2);
    });

    it("should clear all interceptors", () => {
      const interceptor1: RequestInterceptor = { name: "interceptor1" };
      const interceptor2: RequestInterceptor = { name: "interceptor2" };

      InterceptorManager.registerInterceptor(interceptor1);
      InterceptorManager.registerInterceptor(interceptor2);
      InterceptorManager.clearInterceptors();

      const interceptors = InterceptorManager.getInterceptors();
      expect(interceptors).toHaveLength(0);
    });
  });

  describe("Hook Execution Order", () => {
    it("should call onAfterResponse hooks in registration order", async () => {
      const callOrder: string[] = [];

      const interceptor1: RequestInterceptor = {
        name: "interceptor1",
        onAfterResponse: async () => {
          callOrder.push("interceptor1");
        },
      };

      const interceptor2: RequestInterceptor = {
        name: "interceptor2",
        onAfterResponse: async () => {
          callOrder.push("interceptor2");
        },
      };

      InterceptorManager.registerInterceptor(interceptor1);
      InterceptorManager.registerInterceptor(interceptor2);

      await InterceptorManager.executeAfterResponseHooks({
        data: {},
      });

      expect(callOrder).toEqual(["interceptor1", "interceptor2"]);
    });

    it("should call onError hooks in registration order", async () => {
      const callOrder: string[] = [];

      const interceptor1: RequestInterceptor = {
        name: "interceptor1",
        onError: async () => {
          callOrder.push("interceptor1");
        },
      };

      const interceptor2: RequestInterceptor = {
        name: "interceptor2",
        onError: async () => {
          callOrder.push("interceptor2");
        },
      };

      InterceptorManager.registerInterceptor(interceptor1);
      InterceptorManager.registerInterceptor(interceptor2);

      await InterceptorManager.executeErrorHooks({
        error: new Error("test"),
        url: "test",
        init: {},
      });

      expect(callOrder).toEqual(["interceptor1", "interceptor2"]);
    });
  });

  describe("Hook Error Isolation", () => {
    it("should continue to next hook if one throws in onAfterResponse", async () => {
      const callOrder: string[] = [];

      const interceptor1: RequestInterceptor = {
        name: "interceptor1",
        onAfterResponse: async () => {
          callOrder.push("interceptor1");
          throw new Error("interceptor1 failed");
        },
      };

      const interceptor2: RequestInterceptor = {
        name: "interceptor2",
        onAfterResponse: async () => {
          callOrder.push("interceptor2");
        },
      };

      InterceptorManager.registerInterceptor(interceptor1);
      InterceptorManager.registerInterceptor(interceptor2);

      await expect(
        InterceptorManager.executeAfterResponseHooks({
          data: {},
        }),
      ).resolves.toBeUndefined();

      expect(callOrder).toEqual(["interceptor1", "interceptor2"]);
    });

    it("should continue to next hook if one throws in onError", async () => {
      const callOrder: string[] = [];

      const interceptor1: RequestInterceptor = {
        name: "interceptor1",
        onError: async () => {
          callOrder.push("interceptor1");
          throw new Error("interceptor1 failed");
        },
      };

      const interceptor2: RequestInterceptor = {
        name: "interceptor2",
        onError: async () => {
          callOrder.push("interceptor2");
        },
      };

      InterceptorManager.registerInterceptor(interceptor1);
      InterceptorManager.registerInterceptor(interceptor2);

      await expect(
        InterceptorManager.executeErrorHooks({
          error: new Error("test"),
          url: "test",
          init: {},
        }),
      ).resolves.toBeUndefined();

      expect(callOrder).toEqual(["interceptor1", "interceptor2"]);
    });
  });

  describe("Hook Request/Response Mutation", () => {
    it("should allow mutation of response data in onAfterResponse", async () => {
      const interceptor: RequestInterceptor = {
        onAfterResponse: async (res) => {
          res.data.transformed = true;
        },
      };

      InterceptorManager.registerInterceptor(interceptor);

      const data: any = { value: 1 };

      await InterceptorManager.executeAfterResponseHooks({
        data,
      });

      expect(data.transformed).toBe(true);

      InterceptorManager.unregisterInterceptor(interceptor);
    });

    it("should pass statusCode and isNetworkError to onError", async () => {
      let capturedContext: any;

      const interceptor: RequestInterceptor = {
        onError: async (err) => {
          capturedContext = err;
        },
      };

      InterceptorManager.registerInterceptor(interceptor);

      await InterceptorManager.executeErrorHooks({
        error: new Error("test"),
        url: "test",
        init: {},
        statusCode: 500,
        isNetworkError: false,
        endpoint: "worlds",
      });

      expect(capturedContext.statusCode).toBe(500);
      expect(capturedContext.isNetworkError).toBe(false);
      expect(capturedContext.endpoint).toBe("worlds");
    });
  });

  describe("RequestManager Integration", () => {
    it("should not break when no interceptors are registered", async () => {
      InterceptorManager.clearInterceptors();

      // Test that interceptor system doesn't crash when empty
      await expect(
        InterceptorManager.executeBeforeRequestHooks({
          url: "test",
          init: {},
        }),
      ).resolves.toBeUndefined();
    });
  });
});
