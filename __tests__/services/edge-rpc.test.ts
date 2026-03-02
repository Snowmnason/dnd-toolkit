import { beforeEach, describe, expect, it, vi } from "vitest";

import { runEdgeFunction } from "@/lib/middleware/services";
import * as rawRpcModule from "@/system/Services/supabase/supabase-rpc-provider";

// Mock the raw RPC adapter and network/service readiness checks
vi.mock("@/system/Services/supabase/supabase-rpc-provider", () => ({
  runEdgeFunction: vi.fn(),
}));

vi.mock("@/system/Network", () => ({
  ConnectionQuality: { OFFLINE: "offline", GOOD: "good" },
  NetworkDetection: {
    getStatus: vi.fn(() => ({ connectionQuality: "good" })),
  },
}));

vi.mock("@/system/Services", async () => {
  const actual = await vi.importActual("@/system/Services");
  return {
    ...actual,
    isServiceReady: vi.fn((service) => service !== "database" || true), // Default: all services ready
  };
});

describe("RPC Middleware / runEdgeFunction", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("throws when database provider not ready", async () => {
    const { isServiceReady } = await import("@/system/Services");
    (isServiceReady as any).mockImplementation((service: string) => service !== "database");
    
    await expect(runEdgeFunction("leaveWorld", { world_id: "1" })).rejects.toThrow(
      /database provider not ready/i
    );
  });

  it("throws when network offline", async () => {
    const { NetworkDetection } = await import("@/system/Network");
    (NetworkDetection.getStatus as any).mockReturnValue({ connectionQuality: "offline" });
    
    await expect(runEdgeFunction("leaveWorld", { world_id: "1" })).rejects.toThrow(
      /network offline/i
    );
  });

  it("throws for unknown function name", async () => {
    (rawRpcModule.runEdgeFunction as any).mockRejectedValue(
      new Error('Unknown edge function: "unknownFn"')
    );
    await expect(runEdgeFunction("unknownFn", {} as any)).rejects.toThrow(/Unknown edge function/);
  });

  it("throws when rpc returns error", async () => {
    (rawRpcModule.runEdgeFunction as any).mockRejectedValue(
      new Error('RPC call "leave_world" failed: boom')
    );
    await expect(runEdgeFunction("leaveWorld", { world_id: "1" })).rejects.toThrow(/RPC call/);
  });

  it("returns data when rpc succeeds", async () => {
    const expected = { success: true };
    (rawRpcModule.runEdgeFunction as any).mockResolvedValue(expected);
    const res = await runEdgeFunction("leaveWorld", { world_id: "1" });
    expect(res).toEqual(expected);
    expect(rawRpcModule.runEdgeFunction).toHaveBeenCalledWith("leaveWorld", { world_id: "1" });
  });
});
