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
  "@/lib/middleware/storage/compression/compression-provider",
  () => ({
    getCompressionProvider: () => ({
      compress: async (data: Uint8Array) => data,
      decompress: async (data: Uint8Array) => data,
      supports: (_alg: string) => true,
    }),
    resetCompressionProvider: () => {},
  }),
);

import { decode, encode } from "@/lib/middleware/storage/compression/compression-middleware";

describe("Compression Middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("encodes and decodes a large JSON object (roundtrip)", async () => {
    const value = { id: "1", text: "x".repeat(2000) };

    const encoded = await encode(value, { key: "test:key" });

    // Encoded should be a CompressedEntry (have version)
    expect(encoded).toHaveProperty("version", 1);

    const decoded = await decode(encoded);
    expect(decoded).toEqual(value);
  });
});
