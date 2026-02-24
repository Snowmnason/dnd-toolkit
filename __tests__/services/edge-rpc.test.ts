import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock getDatabaseProvider to control rpc behavior
vi.mock("@/lib/services", () => ({
  getDatabaseProvider: vi.fn(),
}));

import { getDatabaseProvider } from "@/lib/services";
import * as rpcModule from "@/lib/services/supabase/supabase-rpc-adapter";

describe("Supabase RPC Adapter / runEdgeFunction", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("throws when database provider not configured", async () => {
    (getDatabaseProvider as any).mockReturnValue({ isConfigured: () => false });
    await expect(rpcModule.runEdgeFunction("leaveWorld", { world_id: "1" })).rejects.toThrow(
      /require Supabase configuration/i
    );
  });

  it("throws for unknown function name", async () => {
    (getDatabaseProvider as any).mockReturnValue({ isConfigured: () => true, rpc: vi.fn() });
    await expect(rpcModule.runEdgeFunction("unknownFn", {} as any)).rejects.toThrow(/Unknown edge function/);
  });

  it("throws when rpc returns error", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    (getDatabaseProvider as any).mockReturnValue({ isConfigured: () => true, rpc });
    await expect(rpcModule.runEdgeFunction("leaveWorld", { world_id: "1" })).rejects.toThrow(/RPC call/);
    expect(rpc).toHaveBeenCalledWith("leave_world", { world_id: "1" });
  });

  it("returns data when rpc succeeds", async () => {
    const expected = { success: true };
    const rpc = vi.fn().mockResolvedValue({ data: expected, error: null });
    (getDatabaseProvider as any).mockReturnValue({ isConfigured: () => true, rpc });
    const res = await rpcModule.runEdgeFunction("leaveWorld", { world_id: "1" });
    expect(res).toEqual(expected);
    expect(rpc).toHaveBeenCalledWith("leave_world", { world_id: "1" });
  });
});
