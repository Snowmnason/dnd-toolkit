import { OfflineQueueManager } from "@/lib/api/resilience/offline-queue";
import { NetworkDetection } from "@/lib/network";
import { SecureStorage } from "@/lib/storage";
import { logger } from "@/lib/utils/logger";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockedFunction,
} from "vitest";

// Mock dependencies
vi.mock("@/lib/network", () => ({
  NetworkDetection: {
    getStatus: vi.fn(),
    subscribe: vi.fn(),
  },
}));

vi.mock("@/lib/storage", () => ({
  SecureStorage: {
    getJSON: vi.fn(),
    setJSON: vi.fn(),
  },
  STORAGE_KEYS: {
    OFFLINE_QUEUE: "dnd:api:offline_queue",
  },
}));

vi.mock("@/lib/utils/logger", () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock RequestManager
vi.mock("@/lib/api/request-manager", () => ({
  RequestManager: {
    flushOfflineQueue: vi.fn(),
  },
}));

describe("Offline Queue Replay", () => {
  let mockNetworkDetection: {
    getStatus: MockedFunction<typeof NetworkDetection.getStatus>;
    subscribe: MockedFunction<typeof NetworkDetection.subscribe>;
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
      subscribe: vi.mocked(NetworkDetection.subscribe),
    };

    // Set up subscribe mock to return unsubscribe function
    mockNetworkDetection.subscribe.mockReturnValue(vi.fn());
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe("initializeOfflineQueueReplay", () => {
    it("should subscribe to network status changes via NetworkDetection", async () => {
      const { initializeOfflineQueueReplay } =
        await import("@/lib/api/resilience/offline-queue-replay");

      initializeOfflineQueueReplay();

      expect(mockNetworkDetection.subscribe).toHaveBeenCalledTimes(1);
    });
  });

  describe("cleanupOfflineQueueReplay", () => {
    it("should clean up replay listener", async () => {
      const { initializeOfflineQueueReplay, cleanupOfflineQueueReplay } =
        await import("@/lib/api/resilience/offline-queue-replay");

      // Set up the unsubscribe mock before initializing
      const unsubscribeMock = vi.fn();
      mockNetworkDetection.subscribe.mockReturnValue(unsubscribeMock);

      // Initialize first to set up the unsubscribe function
      initializeOfflineQueueReplay();

      // Now call cleanup
      cleanupOfflineQueueReplay();

      // Should call the unsubscribe function
      expect(unsubscribeMock).toHaveBeenCalled();
    });
  });

  describe("replay integration", () => {
    it("should process queued requests in FIFO order", async () => {
      await OfflineQueueManager.initialize();

      const now = Date.now();
      const entries = [
        {
          key: "api:first",
          url: "https://api.example.com/first",
          method: "GET",
          createdAt: now - 3000,
          attempts: 0,
        },
        {
          key: "api:second",
          url: "https://api.example.com/second",
          method: "GET",
          createdAt: now - 2000,
          attempts: 0,
        },
        {
          key: "api:third",
          url: "https://api.example.com/third",
          method: "GET",
          createdAt: now - 1000,
          attempts: 0,
        },
      ];

      // Enqueue in reverse order to test FIFO
      for (const entry of entries.reverse()) {
        await OfflineQueueManager.enqueue(entry);
      }

      const queuedEntries = OfflineQueueManager.getEntries();

      // Should be sorted FIFO (oldest first)
      expect(queuedEntries[0].key).toBe("api:first");
      expect(queuedEntries[1].key).toBe("api:second");
      expect(queuedEntries[2].key).toBe("api:third");
    });

    it("should handle replay failures and continue processing", async () => {
      await OfflineQueueManager.initialize();

      const entries = [
        {
          key: "api:success",
          url: "https://api.example.com/success",
          method: "GET",
          createdAt: Date.now() - 2000,
          attempts: 0,
        },
        {
          key: "api:fail",
          url: "https://api.example.com/fail",
          method: "GET",
          createdAt: Date.now() - 1000,
          attempts: 0,
        },
      ];

      for (const entry of entries) {
        await OfflineQueueManager.enqueue(entry);
      }

      // Simulate processing: success for first, failure for second
      await OfflineQueueManager.dequeue("api:success");
      await OfflineQueueManager.recordAttempt("api:fail");

      const remaining = OfflineQueueManager.getEntries();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].key).toBe("api:fail");
      expect(remaining[0].attempts).toBe(1);
    });

    it("should respect max retry attempts during replay", async () => {
      // Initialize with low retry limit
      (OfflineQueueManager as any)._reset();
      mockSecureStorage.getJSON.mockResolvedValue(null);
      await OfflineQueueManager.initialize({ maxRetryAttempts: 2 });

      const entry = {
        key: "api:retry-test",
        url: "https://api.example.com/retry-test",
        method: "GET",
        createdAt: Date.now(),
        attempts: 0,
      };

      await OfflineQueueManager.enqueue(entry);

      // Simulate multiple failures
      await OfflineQueueManager.recordAttempt("api:retry-test");
      await OfflineQueueManager.recordAttempt("api:retry-test");
      await OfflineQueueManager.recordAttempt("api:retry-test"); // Should exceed limit

      // Entry should be removed
      expect(OfflineQueueManager.getStats().queueLength).toBe(0);
      expect(logger.warn).toHaveBeenCalledWith(
        "api",
        "Offline queue entry max retries exceeded",
        {
          key: "api:retry-test",
          attempts: 3,
        },
      );
    });
  });
});
