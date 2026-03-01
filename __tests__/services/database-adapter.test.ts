import { beforeEach, describe, expect, it, vi } from "vitest";

describe("Database Provider Abstraction - basic unit tests", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("getDatabaseProvider returns NoOp before registration", async () => {
    const mod = await import("@/system/Services/database-adapter");
    const provider = mod.getDatabaseProvider();
    // NoOp should be the initial fallback
    expect(provider).toBeDefined();
    if (mod.NoOpDatabaseProvider) {
      expect(provider).toBeInstanceOf(mod.NoOpDatabaseProvider);
    }
    // calling common query entry should throw a clear error
    expect(() => (provider as any).from()).toThrow();
  });

  it("registerDatabaseProvider replaces the default provider and QueryBuilder chains return this", async () => {
    const mod = await import("@/system/Services/database-adapter");

    // Create a mock QueryBuilder with chained methods returning `this`
    const mockQueryBuilder = {
      select: vi.fn(function (this: any) { return this; }),
      eq: vi.fn(function (this: any) { return this; }),
      single: vi.fn(async function (this: any) { return { data: [] }; }),
    };

    const mockProvider = {
      from: vi.fn(() => mockQueryBuilder),
      rpc: vi.fn(),
      isConfigured: () => true,
    } as any;

    mod.registerDatabaseProvider(mockProvider);
    const current = mod.getDatabaseProvider();
    expect(current).toBe(mockProvider);

    const qb = current.from("users");
    expect(qb).toBe(mockQueryBuilder);
    // chain methods return the same builder
    expect(qb.select()).toBe(qb);
    expect(qb.eq("id", 1)).toBe(qb);
    const res = await qb.single();
    expect(res).toHaveProperty("data");
  });

  it("NoOpDatabaseProvider throws on query methods when instantiated", async () => {
    const mod = await import("@/system/Services/database-adapter");
    if (mod.NoOpDatabaseProvider) {
      const noop = new mod.NoOpDatabaseProvider();
      expect(() => noop.from()).toThrow();
    } else {
      // If NoOp not exported, at least getDatabaseProvider should throw on operations
      const provider = mod.getDatabaseProvider();
      expect(() => (provider as any).from("users")).toThrow();
    }
  });
});
