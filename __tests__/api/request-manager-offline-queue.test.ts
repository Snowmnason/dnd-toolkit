// Mock react-native to prevent Rollup errors
import { CircuitBreakerManager } from "@/lib/api/resilience/circuit-breaker";
import { OfflineQueueManager } from "@/lib/api/resilience/offline-queue";
import { RequestManager } from "@/system/API/request-manager";
import { ConnectionQuality, NetworkDetection } from "@/system/Network";
import { SecureStorage } from "@/system/Storage";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockedFunction,
} from "vitest";

vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
  NativeModules: {},
}));

// Mock expo-constants
vi.mock("expo-constants", () => ({
  default: {
    expoConfig: {
      extra: { sentryDsn: null },
    },
  },
}));

// Mock problematic dependencies
vi.mock("@/lib/auth/auth-layer", () => ({
  AuthLayer: {
    injectAuthHeader: vi.fn(),
    handle401Response: vi.fn(),
  },
}));

vi.mock("@/lib/api/interceptor", () => ({
  InterceptorManager: {
    executeBeforeRequestHooks: vi.fn(),
    executeAfterResponseHooks: vi.fn(),
    executeErrorHooks: vi.fn(),
  },
  parseEndpoint: vi.fn().mockReturnValue("test"),
}));

vi.mock("@/lib/analytics", () => ({
  Analytics: {
    captureException: vi.fn(),
    captureMessage: vi.fn(),
    track: vi.fn(),
    enabled: vi.fn().mockReturnValue(false),
  },
  sanitizeError: vi.fn(),
}));

vi.mock("@/lib/config", () => ({
  getAppConfig: vi.fn().mockReturnValue({
    version: 1,
    features: {},
  }),
}));

vi.mock("@/lib/cache", () => ({
  QueryCache: {
    get: vi.fn(),
    set: vi.fn(),
    isStale: vi.fn(),
    getCurrentVersion: vi.fn().mockReturnValue(1),
  },
}));

vi.mock("@/lib/utils/logger", () => ({
  logger: {
    category: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock dependencies
vi.mock("@/system/Network", () => ({
  NetworkDetection: {
    getStatus: vi.fn(),
    subscribe: vi.fn(),
  },
  ConnectionQuality: {
    GOOD: "good",
    BAD: "bad",
    CELLULAR: "cellular",
    OFFLINE: "offline",
  },
}));

vi.mock("@/lib/api/circuit-breaker", () => ({
  CircuitBreakerManager: {
    getState: vi.fn(),
    recordSuccess: vi.fn(),
    recordFailure: vi.fn(),
    tryAcquireProbe: vi.fn(),
    getStats: vi.fn(),
  },
}));

vi.mock("@/system/Storage", () => ({
  SecureStorage: {
    getJSON: vi.fn(),
    setJSON: vi.fn(),
  },
  STORAGE_KEYS: {
    OFFLINE_QUEUE: "dnd:api:offline_queue",
  },
}));

vi.mock("@sentry/react-native", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  setUser: vi.fn(),
  setTag: vi.fn(),
  setContext: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

vi.mock("@/lib/utils/logger", () => ({
  logger: {
    category: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("RequestManager Offline Queue Integration", () => {
  let mockNetworkDetection: {
    getStatus: MockedFunction<typeof NetworkDetection.getStatus>;
  };

  let mockCircuitBreaker: {
    getState: MockedFunction<typeof CircuitBreakerManager.getState>;
  };

  let mockSecureStorage: {
    getJSON: MockedFunction<typeof SecureStorage.getJSON>;
    setJSON: MockedFunction<typeof SecureStorage.setJSON>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the singleton state
    (OfflineQueueManager as any)._reset();

    // Set up mocks
    mockSecureStorage = {
      getJSON: vi.mocked(SecureStorage.getJSON),
      setJSON: vi.mocked(SecureStorage.setJSON),
    };

    mockNetworkDetection = {
      getStatus: vi.mocked(NetworkDetection.getStatus),
    };

    mockCircuitBreaker = {
      getState: vi.mocked(CircuitBreakerManager.getState),
    };

    // Set default mocks for network detection and circuit breaker
    mockNetworkDetection.getStatus.mockResolvedValue({
      connectionQuality: ConnectionQuality.GOOD,
      isOnline: true,
      type: "wifi",
      isExpensive: false,
    });
    mockCircuitBreaker.getState.mockReturnValue("Closed");

    mockSecureStorage.getJSON.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe("offline queue integration", () => {
    beforeEach(async () => {
      await OfflineQueueManager.initialize();
    });

    it("should queue failed requests when circuit breaker is open and return null", async () => {
      // Mock online status
      mockNetworkDetection.getStatus.mockReturnValue({
        connectionQuality: ConnectionQuality.GOOD,
        isOnline: true,
        type: "wifi",
        isExpensive: false,
      });

      // Mock circuit breaker open
      mockCircuitBreaker.getState.mockReturnValue("Open");

      // Create a fetcher that always fails
      const failingFetcher = vi
        .fn()
        .mockRejectedValue(new Error("Circuit breaker open"));
      const key = "api:test-circuit-open";

      // Call fetch - should queue the request and return null
      const result = await RequestManager.fetch(key, failingFetcher, {
        circuitBreakerKey: "test-endpoint",
        failOpen: false, // Don't fail open, should queue
      });

      // Should return null (queued successfully)
      expect(result).toBeNull();

      // Should have enqueued the request
      const entries = OfflineQueueManager.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].key).toBe(key);

      // Verify fetcher was NOT called (circuit breaker prevents execution)
      expect(failingFetcher).not.toHaveBeenCalled();
    });
  });

  describe("queue entry building", () => {
    beforeEach(async () => {
      await OfflineQueueManager.initialize();
    });

    it("should build queue entry with correct structure", async () => {
      const testEntry = {
        key: "api:test",
        url: "https://api.example.com/test",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: { test: "data" },
        params: { param1: "value1" },
        authStrategy: "bearer",
        options: {
          timeout: 5000,
          // other options...
        },
        createdAt: Date.now(),
        attempts: 0,
      };

      await OfflineQueueManager.enqueue(testEntry);

      const entries = OfflineQueueManager.getEntries();
      expect(entries).toHaveLength(1);
      const entry = entries[0];

      expect(entry.key).toBe("api:test");
      expect(entry.url).toBe("https://api.example.com/test");
      expect(entry.method).toBe("POST");
      expect(entry.headers).toEqual({ "Content-Type": "application/json" });
      expect(entry.body).toEqual({ test: "data" });
      expect(entry.params).toEqual({ param1: "value1" });
      expect(entry.authStrategy).toBe("bearer");
      expect(entry.createdAt).toBeDefined();
      expect(entry.attempts).toBe(0);
    });

    it("should handle entries without optional fields", async () => {
      const minimalEntry = {
        key: "api:minimal",
        url: "https://api.example.com/minimal",
        method: "GET",
        createdAt: Date.now(),
        attempts: 0,
      };

      await OfflineQueueManager.enqueue(minimalEntry);

      const entries = OfflineQueueManager.getEntries();
      expect(entries).toHaveLength(1);
      const entry = entries[0];

      expect(entry.key).toBe("api:minimal");
      expect(entry.url).toBe("https://api.example.com/minimal");
      expect(entry.method).toBe("GET");
      expect(entry.headers).toBeUndefined();
      expect(entry.body).toBeUndefined();
      expect(entry.params).toBeUndefined();
      expect(entry.authStrategy).toBeUndefined();
      expect(entry.createdAt).toBeDefined();
      expect(entry.attempts).toBe(0);
    });
  });

  describe("flushOfflineQueue", () => {
    beforeEach(async () => {
      await OfflineQueueManager.initialize();
    });

    it("should process queued requests", async () => {
      // Add some test entries
      const entries = [
        {
          key: "api:test1",
          url: "https://api.example.com/test1",
          method: "GET",
          createdAt: Date.now() - 2000,
          attempts: 0,
        },
        {
          key: "api:test2",
          url: "https://api.example.com/test2",
          method: "POST",
          createdAt: Date.now() - 1000,
          attempts: 0,
        },
      ];

      for (const entry of entries) {
        await OfflineQueueManager.enqueue(entry);
      }

      expect(OfflineQueueManager.getStats().queueLength).toBe(2);

      // Mock fetch to simulate successful replay
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true }),
        headers: new Map([["content-type", "application/json"]]),
      });

      // Call flushOfflineQueue
      await RequestManager.flushOfflineQueue();

      // Should have processed and removed successful entries
      expect(OfflineQueueManager.getStats().queueLength).toBe(0);
    });
  });

  describe("getOfflineQueueStats", () => {
    beforeEach(async () => {
      await OfflineQueueManager.initialize();
    });

    it("should return queue statistics", async () => {
      const now = Date.now();
      const entries = [
        {
          key: "api:old",
          url: "https://api.example.com/old",
          method: "GET",
          createdAt: now - 10000,
          attempts: 0,
        },
        {
          key: "api:new",
          url: "https://api.example.com/new",
          method: "GET",
          createdAt: now - 1000,
          attempts: 0,
        },
      ];

      for (const entry of entries) {
        await OfflineQueueManager.enqueue(entry);
      }

      // Record some attempts
      await OfflineQueueManager.recordAttempt("api:new");

      const stats = OfflineQueueManager.getStats();

      expect(stats.queueLength).toBe(2);
      expect(stats.oldestEntryTime).toBe(now - 10000);
      expect(stats.failedAttempts).toBe(1); // one entry with attempts > 0
      expect(stats.maxQueueSize).toBe(100);
      expect(stats.maxRetryAttempts).toBe(3);
    });

    it("should return empty stats for empty queue", async () => {
      const stats = OfflineQueueManager.getStats();

      expect(stats.queueLength).toBe(0);
      expect(stats.oldestEntryTime).toBeNull();
      expect(stats.failedAttempts).toBe(0);
      expect(stats.maxQueueSize).toBe(100);
      expect(stats.maxRetryAttempts).toBe(3);
    });
  });
});
