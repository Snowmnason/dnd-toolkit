import { vi } from "vitest";

// Mock storage modules
vi.mock("@/lib/storage", () => ({
  FastCache: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
  },
}));

// Mock NetworkDetection - return online status by default
vi.mock("@/lib/network/network-detection", () => ({
  NetworkDetection: {
    isOnline: true,
    getStatus: vi.fn(() => ({ isOnline: true })),
    subscribe: vi.fn(() => () => {}), // Return unsubscribe function
  },
}));

// Mock logger
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
