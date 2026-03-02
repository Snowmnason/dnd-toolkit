import {
  OfflineQueueManager,
  type QueuedRequestEntry,
} from "@/lib/api/resilience/offline-queue";
import { logger } from "@/lib/utils/logger";
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

// Mock dependencies
vi.mock("@/system/Storage", () => ({
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

describe("OfflineQueueManager", () => {
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
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe("initialize", () => {
    it("should initialize with default config when no config provided", async () => {
      mockSecureStorage.getJSON.mockResolvedValue(null);

      await OfflineQueueManager.initialize();

      expect(OfflineQueueManager.getStats().maxQueueSize).toBe(100);
      expect(OfflineQueueManager.getStats().maxRetryAttempts).toBe(3);
    });

    it("should merge provided config with defaults", async () => {
      mockSecureStorage.getJSON.mockResolvedValue(null);

      await OfflineQueueManager.initialize({ maxQueueSize: 50 });

      expect(OfflineQueueManager.getStats().maxQueueSize).toBe(50);
      expect(OfflineQueueManager.getStats().maxRetryAttempts).toBe(3);
    });

    it("should load persisted queue data", async () => {
      const persistedData = {
        version: 1,
        data: {
          entries: [
            {
              key: "test:key",
              url: "https://api.example.com/test",
              method: "GET",
              createdAt: Date.now(),
              attempts: 0,
            },
          ],
          maxQueueSize: 100,
          maxRetryAttempts: 3,
        },
        timestamp: Date.now(),
      };

      mockSecureStorage.getJSON.mockResolvedValue(persistedData);

      await OfflineQueueManager.initialize();

      expect(OfflineQueueManager.getStats().queueLength).toBe(1);
      expect(OfflineQueueManager.getEntries()[0].key).toBe("test:key");
    });

    it("should handle disabled queue", async () => {
      await OfflineQueueManager.initialize({ enabled: false });

      expect(logger.info).toHaveBeenCalledWith("api", "Offline queue disabled");
    });
  });

  describe("enqueue", () => {
    beforeEach(async () => {
      mockSecureStorage.getJSON.mockResolvedValue(null);
      await OfflineQueueManager.initialize();
    });

    it("should enqueue a new entry", async () => {
      const entry: QueuedRequestEntry = {
        key: "test:key",
        url: "https://api.example.com/test",
        method: "GET",
        createdAt: Date.now(),
        attempts: 0,
      };

      await OfflineQueueManager.enqueue(entry);

      expect(OfflineQueueManager.getStats().queueLength).toBe(1);
      expect(mockSecureStorage.setJSON).toHaveBeenCalledTimes(1);
    });

    it("should deduplicate by key, keeping latest", async () => {
      const entry1: QueuedRequestEntry = {
        key: "test:key",
        url: "https://api.example.com/test1",
        method: "GET",
        createdAt: Date.now() - 2000,
        attempts: 0,
      };

      const entry2: QueuedRequestEntry = {
        key: "test:key",
        url: "https://api.example.com/test2",
        method: "POST",
        createdAt: Date.now(),
        attempts: 0,
      };

      await OfflineQueueManager.enqueue(entry1);
      await OfflineQueueManager.enqueue(entry2);

      expect(OfflineQueueManager.getStats().queueLength).toBe(1);
      const stored = OfflineQueueManager.getEntries()[0];
      expect(stored.url).toBe("https://api.example.com/test2");
      expect(stored.method).toBe("POST");
      expect(stored.attempts).toBe(0); // Reset on deduplication
    });

    it("should enforce max queue size by dropping oldest", async () => {
      // Reset and initialize with small max size
      (OfflineQueueManager as any)._reset();
      mockSecureStorage.getJSON.mockResolvedValue(null);
      await OfflineQueueManager.initialize({ maxQueueSize: 2 });

      const now = Date.now();
      const entries: QueuedRequestEntry[] = [
        {
          key: "oldest",
          url: "url1",
          method: "GET",
          createdAt: now - 3000,
          attempts: 0,
        },
        {
          key: "middle",
          url: "url2",
          method: "GET",
          createdAt: now - 2000,
          attempts: 0,
        },
        {
          key: "newest",
          url: "url3",
          method: "GET",
          createdAt: now - 1000,
          attempts: 0,
        },
      ];

      for (const entry of entries) {
        await OfflineQueueManager.enqueue(entry);
      }

      expect(OfflineQueueManager.getStats().queueLength).toBe(2);
      const remainingKeys = OfflineQueueManager.getEntries().map((e) => e.key);
      expect(remainingKeys).toContain("middle");
      expect(remainingKeys).toContain("newest");
      expect(remainingKeys).not.toContain("oldest");
      expect(logger.warn).toHaveBeenCalledWith(
        "api",
        "Offline queue size exceeded, dropped oldest entries",
        {
          queueSize: 2,
        },
      );
    });
  });

  describe("dequeue", () => {
    beforeEach(async () => {
      mockSecureStorage.getJSON.mockResolvedValue(null);
      await OfflineQueueManager.initialize();
    });

    it("should remove entry by key", async () => {
      const entry: QueuedRequestEntry = {
        key: "test:key",
        url: "https://api.example.com/test",
        method: "GET",
        createdAt: Date.now(),
        attempts: 0,
      };

      await OfflineQueueManager.enqueue(entry);
      expect(OfflineQueueManager.getStats().queueLength).toBe(1);

      await OfflineQueueManager.dequeue("test:key");

      expect(OfflineQueueManager.getStats().queueLength).toBe(0);
    });
  });

  describe("recordAttempt", () => {
    beforeEach(async () => {
      mockSecureStorage.getJSON.mockResolvedValue(null);
      await OfflineQueueManager.initialize();
    });

    it("should increment attempt count", async () => {
      const entry: QueuedRequestEntry = {
        key: "test:key",
        url: "https://api.example.com/test",
        method: "GET",
        createdAt: Date.now(),
        attempts: 0,
      };

      await OfflineQueueManager.enqueue(entry);
      await OfflineQueueManager.recordAttempt("test:key");

      const stored = OfflineQueueManager.getEntries()[0];
      expect(stored.attempts).toBe(1);
      expect(stored.lastAttemptAt).toBeDefined();
    });

    it("should remove entry when max attempts exceeded", async () => {
      // Reset and initialize with low max attempts
      (OfflineQueueManager as any)._reset();
      mockSecureStorage.getJSON.mockResolvedValue(null);
      await OfflineQueueManager.initialize({ maxRetryAttempts: 2 });

      const entry: QueuedRequestEntry = {
        key: "test:key",
        url: "https://api.example.com/test",
        method: "GET",
        createdAt: Date.now(),
        attempts: 0,
      };

      await OfflineQueueManager.enqueue(entry);
      await OfflineQueueManager.recordAttempt("test:key");
      await OfflineQueueManager.recordAttempt("test:key");
      await OfflineQueueManager.recordAttempt("test:key"); // Exceeds max

      expect(OfflineQueueManager.getStats().queueLength).toBe(0);
      expect(logger.warn).toHaveBeenCalledWith(
        "api",
        "Offline queue entry max retries exceeded",
        {
          key: "test:key",
          attempts: 3,
        },
      );
    });
  });

  describe("getStats", () => {
    beforeEach(async () => {
      mockSecureStorage.getJSON.mockResolvedValue(null);
      await OfflineQueueManager.initialize();
    });

    it("should return correct statistics", async () => {
      const now = Date.now();
      const entries: QueuedRequestEntry[] = [
        {
          key: "key1",
          url: "url1",
          method: "GET",
          createdAt: now - 5000,
          attempts: 0,
        },
        {
          key: "key2",
          url: "url2",
          method: "GET",
          createdAt: now - 2000,
          attempts: 0,
        },
        {
          key: "key3",
          url: "url3",
          method: "GET",
          createdAt: now - 1000,
          attempts: 0,
        },
      ];

      for (const entry of entries) {
        await OfflineQueueManager.enqueue(entry);
      }

      // Record attempts to create failed entries
      await OfflineQueueManager.recordAttempt("key2"); // 1 attempt
      await OfflineQueueManager.recordAttempt("key3"); // 1 attempt
      await OfflineQueueManager.recordAttempt("key3"); // 2 attempts

      const stats = OfflineQueueManager.getStats();
      expect(stats.queueLength).toBe(3);
      expect(stats.oldestEntryTime).toBe(now - 5000);
      expect(stats.failedAttempts).toBe(2); // entries with attempts > 0
      expect(stats.maxQueueSize).toBe(100);
      expect(stats.maxRetryAttempts).toBe(3);
    });
  });

  describe("clear", () => {
    beforeEach(async () => {
      mockSecureStorage.getJSON.mockResolvedValue(null);
      await OfflineQueueManager.initialize();
    });

    it("should clear specific key", async () => {
      const entries: QueuedRequestEntry[] = [
        {
          key: "key1",
          url: "url1",
          method: "GET",
          createdAt: Date.now(),
          attempts: 0,
        },
        {
          key: "key2",
          url: "url2",
          method: "GET",
          createdAt: Date.now(),
          attempts: 0,
        },
      ];

      await OfflineQueueManager.enqueue(entries[0]);
      await OfflineQueueManager.enqueue(entries[1]);
      expect(OfflineQueueManager.getStats().queueLength).toBe(2);

      await OfflineQueueManager.clear("key1");

      expect(OfflineQueueManager.getStats().queueLength).toBe(1);
      expect(OfflineQueueManager.getEntries()[0].key).toBe("key2");
    });

    it("should clear all entries", async () => {
      const entries: QueuedRequestEntry[] = [
        {
          key: "key1",
          url: "url1",
          method: "GET",
          createdAt: Date.now(),
          attempts: 0,
        },
        {
          key: "key2",
          url: "url2",
          method: "GET",
          createdAt: Date.now(),
          attempts: 0,
        },
      ];

      await OfflineQueueManager.enqueue(entries[0]);
      await OfflineQueueManager.enqueue(entries[1]);
      expect(OfflineQueueManager.getStats().queueLength).toBe(2);

      await OfflineQueueManager.clear();

      expect(OfflineQueueManager.getStats().queueLength).toBe(0);
    });
  });

  describe("getEntries", () => {
    beforeEach(async () => {
      mockSecureStorage.getJSON.mockResolvedValue(null);
      await OfflineQueueManager.initialize();
    });

    it("should return entries sorted by creation time (FIFO)", async () => {
      const now = Date.now();
      const entries: QueuedRequestEntry[] = [
        {
          key: "key3",
          url: "url3",
          method: "GET",
          createdAt: now - 1000,
          attempts: 0,
        },
        {
          key: "key1",
          url: "url1",
          method: "GET",
          createdAt: now - 3000,
          attempts: 0,
        },
        {
          key: "key2",
          url: "url2",
          method: "GET",
          createdAt: now - 2000,
          attempts: 0,
        },
      ];

      for (const entry of entries) {
        await OfflineQueueManager.enqueue(entry);
      }

      const retrieved = OfflineQueueManager.getEntries();
      expect(retrieved).toHaveLength(3);
      expect(retrieved[0].key).toBe("key1"); // oldest
      expect(retrieved[1].key).toBe("key2");
      expect(retrieved[2].key).toBe("key3"); // newest
    });
  });
});
