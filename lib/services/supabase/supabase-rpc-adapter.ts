/**
 * Supabase RPC Adapter
 *
 * Maps semantic `runEdgeFunction()` calls to Supabase `.rpc()` calls.
 * Handles all 6 current RPC stored procedures:
 * - leaveWorld
 * - joinWorldWithInvite
 * - createInviteLink
 * - resolveInviteToken
 * - deleteInviteLink
 * - removeWorldAccess
 */

import { getDatabaseProvider } from "@/lib/services";
import { logger } from "@/lib/utils";

/**
 * Generic edge function implementation interface
 * Note: `name` is not stored on the object — keyed by registry string. See lib/database/edge/registry.ts.
 */
export interface EdgeFunctionImplementation<Input = any, Output = any> {
  handler: (input: Input) => Promise<Output>;
}

/**
 * Type-safe input/output pairs for each RPC call
 */
export interface LeaveWorldInput {
  world_id: string;
}

export interface LeaveWorldOutput {
  success: boolean;
  message?: string;
}

export interface JoinWorldWithInviteInput {
  invite_token: string;
}

export interface JoinWorldWithInviteOutput {
  world_id: string;
  user_world_id: string;
  message?: string;
}

export interface CreateInviteLinkInput {
  world_id: string;
  max_uses?: number;
  expires_in_days?: number;
}

export interface CreateInviteLinkOutput {
  invite_token: string;
  invite_code: string;
  expires_at: string;
}

export interface ResolveInviteTokenInput {
  invite_token: string;
}

export interface ResolveInviteTokenOutput {
  world_id: string;
  world_name: string;
  created_by_user_id: string;
  created_by_name: string;
}

export interface DeleteInviteLinkInput {
  invite_token: string;
}

export interface DeleteInviteLinkOutput {
  success: boolean;
  message?: string;
}

export interface RemoveWorldAccessInput {
  world_id: string;
  user_id: string;
}

export interface RemoveWorldAccessOutput {
  success: boolean;
  message?: string;
}

/**
 * Union type for all RPC inputs and outputs
 */
type EdgeFunctionInput =
  | LeaveWorldInput
  | JoinWorldWithInviteInput
  | CreateInviteLinkInput
  | ResolveInviteTokenInput
  | DeleteInviteLinkInput
  | RemoveWorldAccessInput;

type EdgeFunctionOutput =
  | LeaveWorldOutput
  | JoinWorldWithInviteOutput
  | CreateInviteLinkOutput
  | ResolveInviteTokenOutput
  | DeleteInviteLinkOutput
  | RemoveWorldAccessOutput;

/**
 * Maps function names to their RPC procedure names
 */
const RPC_PROCEDURE_MAP: Record<string, string> = {
  leaveWorld: "leave_world",
  joinWorldWithInvite: "join_world_with_invite",
  createInviteLink: "create_invite_link",
  resolveInviteToken: "resolve_invite_token",
  deleteInviteLink: "delete_invite_link",
  removeWorldAccess: "remove_world_access",
};

/**
 * Run an edge function via Supabase RPC
 *
 * @param functionName semantic name (e.g., 'leaveWorld')
 * @param input parameters to pass to the RPC call
 * @returns result from the RPC call
 *
 * @example
 * const result = await runEdgeFunction('leaveWorld', { world_id: '123' });
 */
export async function runEdgeFunction<T extends EdgeFunctionOutput = any>(
  functionName: string,
  input: EdgeFunctionInput
): Promise<T> {
  if (!getDatabaseProvider().isConfigured()) {
    throw new Error(
      "Edge functions require Supabase configuration to be initialized"
    );
  }

  // eslint-disable-next-line security/detect-object-injection
  const rpcProcedure = RPC_PROCEDURE_MAP[functionName];
  if (!rpcProcedure) {
    throw new Error(
      `Unknown edge function: "${functionName}". Supported: ${Object.keys(RPC_PROCEDURE_MAP).join(", ")}`
    );
  }

  try {
    const client = getDatabaseProvider();
    const { data, error } = await client.rpc(rpcProcedure, input);

    if (error) {
      logger
        .category("database")
        .error(`Edge function "${functionName}" failed:`, {
          procedure: rpcProcedure,
          error: error.message,
          input,
        });
      throw new Error(
        `RPC call "${rpcProcedure}" failed: ${error.message}`
      );
    }

    logger
      .category("database")
      .debug(`Edge function "${functionName}" executed successfully`, {
        procedure: rpcProcedure,
      });

    return data as T;
  } catch (err) {
    logger
      .category("database")
      .error(`Exception in edge function "${functionName}":`, { err });
    throw err;
  }
}

/**
 * Create an RPC adapter implementation (for registry pattern)
 *
 * @param functionName semantic name
 * @returns EdgeFunctionImplementation that can be registered
 */
export function createSupabaseRpcAdapter<
  Input extends EdgeFunctionInput = any,
  Output extends EdgeFunctionOutput = any
>(functionName: string): EdgeFunctionImplementation<Input, Output> {
  return {
    handler: (input: Input) => runEdgeFunction<Output>(functionName, input),
  };
}
