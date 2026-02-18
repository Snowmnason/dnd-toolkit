import { vi } from "vitest";

// Mock react-native to prevent Rollup errors in tests
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
  // Provide ConnectionQuality constants used by tests
  ConnectionQuality: {
    GOOD: "good",
    BAD: "bad",
    CELLULAR: "cellular",
    OFFLINE: "offline",
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

// Mock Sentry to avoid pulling react-native internals during tests
vi.mock("@sentry/react-native", () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  setUser: vi.fn(),
  withScope: (cb: Function) => cb({ setExtras: () => {}, setTag: () => {} }),
}));

// Fail tests on unhandled promise rejections or uncaught exceptions so
// Vitest surfaces the actual error/stack instead of worker exits.
// Log worker id and initial memory so we can trace OOMs to a worker.
console.log(
  "Vitest setup loaded",
  { workerId: process.env.VITEST_WORKER_ID ?? null, pid: process.pid },
  "mem",
  process.memoryUsage()
);

process.on("unhandledRejection", (reason: unknown) => {
  console.error("UnhandledRejection in tests:", reason, "mem", process.memoryUsage());
  if (reason instanceof Error) throw reason;
  throw new Error(String(reason));
});

process.on("uncaughtException", (err: unknown) => {
  console.error("UncaughtException in tests:", err, "mem", process.memoryUsage());
  if (err instanceof Error) throw err;
  throw new Error(String(err));
});

// Periodically log memory usage in case a worker is growing unexpectedly.
const memInterval = setInterval(() => {
  console.log("Vitest worker memory", { pid: process.pid, mem: process.memoryUsage() });
}, 2000);

// Clear interval when process exits
process.on("exit", () => clearInterval(memInterval));
