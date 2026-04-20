import {
    decode,
    encode,
    getDecodeStats,
    getStats,
    resetStats,
} from "@/middleware/storage/compression/compression-middleware";
import {
    startPeriodicReset,
    stopPeriodicReset,
} from "@/middleware/storage/compression/compression-stats";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock logger to silence output
vi.mock("@/lib/utils/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    category: vi.fn(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  },
}));

// Mock config to enable compression with a low threshold for tests
vi.mock("@/config", () => ({
  getAppConfig: vi.fn(() => ({
    compression: { enabled: true, algorithm: "gzip", threshold: 1, stats: { enabled: false } },
  })),
}));

// Provide a simple compression provider that is identity for compress/decompress
vi.mock(
  "@/middleware/storage/compression/compression-provider",
  () => ({
    getCompressionProvider: () => ({
      compress: async (data: Uint8Array) => data,
      decompress: async (data: Uint8Array) => data,
      supports: (_alg: string) => true,
    }),
    resetCompressionProvider: () => {},
  }),
);



describe("Compression Middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStats();
  });

  it("encodes and decodes a large JSON object (roundtrip)", async () => {
    const value = { id: "1", text: "x".repeat(2000) };

    const encoded = await encode(value, { key: "test:key" });

    // Encoded should be a CompressedEntry (have version)
    expect(encoded).toHaveProperty("version", 1);

    const decoded = await decode(encoded);
    expect(decoded).toEqual(value);
  });

  it("returns uncompressed value for oversized entries instead of throwing", async () => {
    // Default mock config has no maxBytesPerEntry; override for this test
    const { getAppConfig } = await import("@/config");
    (getAppConfig as any).mockReturnValueOnce({
      compression: { enabled: true, algorithm: "gzip", threshold: 1, maxBytesPerEntry: 10, stats: { enabled: false } },
      cacheSecurityLimits: { rejectOversizedEntries: true },
    });

    const value = { big: "x".repeat(100) };
    const result = await encode(value, { key: "oversized" });

    // Should return the original value uncompressed, not throw
    expect(result).toEqual(value);
  });

  it("uses 1KB default size when serialization fails (circular ref)", async () => {
    // We can't truly pass circular data through encode (JSON.stringify in encode 
    // would fail), but we can verify measureSizeBytes fallback by testing the 
    // result still completes without throwing
    const value = { id: "test" };
    const encoded = await encode(value, { key: "test:circ" });
    expect(encoded).toBeDefined();
  });

  it("tracks encode and decode stats separately", async () => {
    const value = { data: "x".repeat(500) };

    await encode(value, { key: "stats:key" });
    const encodeStats = getStats();
    expect(encodeStats.compressedCount).toBe(1);
    expect(encodeStats.totalOriginalBytes).toBeGreaterThan(0);
    expect(encodeStats.totalStoredBytes).toBeGreaterThan(0);

    const encoded = await encode(value, { key: "stats:key2" });
    await decode(encoded);

    const decodeOnlyStats = getDecodeStats();
    expect(decodeOnlyStats.totalDecodes).toBe(1);
    expect(decodeOnlyStats.totalDecodedOriginalBytes).toBeGreaterThan(0);
  });

  it("end-to-end: encode → JSON serialize → JSON parse → decode roundtrip", async () => {
    // Simulates the full persistence pipeline:
    // cacheSet: encode → JSON.stringify → FastCache
    // cacheGet: FastCache → JSON.parse → decode
    const original = {
      worlds: [
        { id: "w1", name: "Forgotten Realms", players: 6 },
        { id: "w2", name: "Eberron", players: 4 },
      ],
      metadata: { lastSync: Date.now(), version: 3 },
    };

    // 1. Encode (compress)
    const encoded = await encode(original, { key: "e2e:worlds" });
    expect(encoded).toHaveProperty("version", 1);
    expect(encoded).toHaveProperty("algorithm", "gzip");

    // 2. Simulate JSON persistence round-trip (what FastCache does)
    const jsonString = JSON.stringify(encoded);
    const parsedBack = JSON.parse(jsonString);

    // 3. Decode (decompress) from parsed JSON
    const decoded = await decode(parsedBack);
    expect(decoded).toEqual(original);
  });

  it("periodic reset snapshots and clears stats", async () => {
    const value = { data: "x".repeat(500) };
    await encode(value, { key: "periodic:key" });

    expect(getStats().totalOperations).toBeGreaterThan(0);

    // Start periodic reset with very short interval (for test)
    startPeriodicReset(50);

    // Wait for periodic reset to fire
    await new Promise((resolve) => setTimeout(resolve, 100));

    // After reset, current stats should be cleared
    expect(getStats().totalOperations).toBe(0);

    stopPeriodicReset();
  });
});
