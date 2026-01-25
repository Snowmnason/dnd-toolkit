import { vi } from "vitest";

// Mock storage modules with correct FastCache API
vi.mock("@/lib/storage", () => ({
  FastCache: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    getJSON: vi.fn(),
    setJSON: vi.fn(),
    removeItem: vi.fn(),
    hasItem: vi.fn(),
    removeByPrefix: vi.fn(),
    multiSet: vi.fn(),
    clear: vi.fn(),
    subscribe: vi.fn(() => () => {}), // Return unsubscribe function
    getStats: vi.fn(),
  },
  SecureStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    getJSON: vi.fn(),
    setJSON: vi.fn(),
    removeItem: vi.fn(),
    hasItem: vi.fn(),
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
