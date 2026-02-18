/* eslint-disable security/detect-object-injection */
import { vi } from "vitest";

// This file provides test-time shims for native/Expo modules. It intentionally
// manipulates global objects; rules that flag "object injection" or use of
// `any` are disabled for this file only.

declare global {
  // minimal shape we use in tests
  var ExpoGlobal: { EventEmitter?: new (...args: any[]) => any };
}

// Ensure native-like globals expected by some Expo modules
(globalThis as any).__DEV__ = true;
// Provide Expo build-time env used by some libraries when Babel isn't applied
process.env.EXPO_OS = process.env.EXPO_OS || "web";

// Minimal ExpoModulesCore shim for test environment
;(globalThis as any).ExpoGlobal = (globalThis as any).ExpoGlobal || {};
if (!(globalThis as any).ExpoGlobal.EventEmitter) {
  class _SimpleEventEmitter {
    listeners: Record<string, Function[]> = {};
    addListener(event: string, cb: Function) {
      this.listeners[event] = this.listeners[event] || [];
      this.listeners[event].push(cb);
      return { remove: () => { this.listeners[event] = this.listeners[event].filter(f => f !== cb); } };
    }
    removeAllListeners() { this.listeners = {}; }
    emit(event: string, ...args: any[]) { (this.listeners[event] || []).forEach(f => f(...args)); }
  }
  (globalThis as any).ExpoGlobal.EventEmitter = _SimpleEventEmitter as any;
}

// Mock the runtime module to avoid eager imports that expect native runtime shims
vi.mock("expo-modules-core", () => ({
  EventEmitter: (globalThis as any).ExpoGlobal.EventEmitter,
  // Minimal native bridge helpers expected by downstream libs
  requireNativeModule: (name: string) => ({}),
  default: {},
}));

// Provide a simple implementation of expo-crypto.digest for tests
vi.mock("expo-crypto", () => ({
  digest: async (algorithm: string, data: ArrayBuffer | Uint8Array) => {
    // Use Node's crypto to produce a SHA-256 hash compatible with ArrayBuffer
    const nodeCrypto = require("crypto");
    const buf = Buffer.from(data instanceof ArrayBuffer ? new Uint8Array(data) : data as Uint8Array);
    const hash = nodeCrypto.createHash("sha256").update(buf).digest();
    return hash.buffer;
  },
  CryptoDigestAlgorithm: {
    SHA256: "SHA-256",
  },
  getRandomBytes: (n: number) => {
    const nodeCrypto = require("crypto");
    return new Uint8Array(nodeCrypto.randomBytes(n));
  },
}));

// Mock react-native to prevent Rollup errors in tests
vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
  NativeModules: {},
  // Some expo modules expect TurboModuleRegistry to exist on react-native
  TurboModuleRegistry: {
    get: () => null,
  },
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
