/**
 * Database Service — Middleware between lib modules and System/Services database-adapter
 *
 * This is the ONLY file in lib that imports from the database adapter.
 * All other lib modules, hooks, components, and screens call these functions instead.
 *
 * Middleware Responsibilities:
 * - Precondition: Check network connectivity (DB queries need Supabase)
 * - Precondition: Check database provider is initialized (isServiceReady)
 * - Precondition: Check auth readiness for authenticated queries
 * - Single entry point to database adapter
 *
 * Does NOT:
 * - Validate data (entity modules validate their own data before calling here)
 * - Contain query logic (that stays in lib/database/*.ts entity files)
 * - Transform entities (modules do that)
 */

import { reportFault } from '@/lib/error/degrade/degrade-manager';
import { logger } from '@/lib/utils/logger';
import { ConnectionQuality, NetworkDetection } from '@/system/Network';
import {
    getDatabaseProvider,
    isServiceReady,
    type DatabaseProvider
} from '@/system/Services';
import { DegradeCapability } from '@/type-definitions/degrade';

// ─── RPC Procedure Map ────────────────────────────────────────────
// Maps semantic edge function names to their Supabase PostgreSQL RPC procedure names.
// All calls go through getDatabaseProvider().rpc() — no direct Supabase dependency.

const RPC_PROCEDURE_MAP: Record<string, string> = {
    leaveWorld: 'leave_world',
    joinWorldWithInvite: 'join_world_with_invite',
    createInviteLink: 'create_invite_link',
    resolveInviteToken: 'resolve_invite_token',
    deleteInviteLink: 'delete_invite_link',
    removeWorldAccess: 'remove_world_access',
};

// ─── Precondition Checks ───────────────────────────────────────────

/**
 * Check if database provider is initialized and ready.
 * Returns false if provider not ready (NoOp provider will throw on query).
 */
function isDatabaseReady(): boolean {
    return isServiceReady('database');
}

/**
 * Check if network is available for database operations.
 * Database queries go through request-manager which has its own offline queue,
 * but direct provider calls need network.
 */
function isNetworkAvailable(): boolean {
    const networkStatus = NetworkDetection.getStatus();
    return networkStatus.connectionQuality !== ConnectionQuality.OFFLINE;
}

// ─── Database Access ───────────────────────────────────────────────

/**
 * Get the registered database provider.
 * Checks provider readiness and network before returning.
 *
 * If provider not ready: returns NoOp provider (will throw clear error on query).
 * If network offline: logs warning but returns provider anyway
 * (request-manager has offline queue for entity queries).
 */
export function getDatabase(): DatabaseProvider {

    if (!isNetworkAvailable()) {
        // Don't block — request-manager has offline queue.
        // Direct provider calls will fail, but entity queries go through request-manager.
        logger.category('database').debug('[database-service] Network offline — request-manager will queue if applicable');
    }

    if (!isDatabaseReady()) {
        // TODO: Should we throw here, or let NoOp provider handle with clear error?
        // Current behavior: NoOp provider returns, throws on actual query with clear message.
        logger.category('database').warn('[database-service] Database provider not initialized — queries will fail');
        reportFault(DegradeCapability.DATABASE, 'Provider not initialized');
    }

    return getDatabaseProvider();
}

/**
 * Get the database provider for an authenticated query.
 * Checks database AND auth service readiness.
 *
 * @throws Error if auth is not ready (auth-gated operations must not proceed)
 */
export function getDatabaseWithAuth(): DatabaseProvider {
    // Check auth readiness first — auth-gated DB operations need a valid session
    if (!isServiceReady('auth')) {
        // TODO: Should we throw a typed error? Queue for later?
        // For now, throw immediately — auth-gated DB writes must not proceed without auth.
        reportFault(DegradeCapability.DATABASE, 'Authenticated database unavailable — auth not ready');
        throw new Error('[database-service] Auth provider not ready — cannot perform authenticated database operation');
    }

    // Delegate to standard database check
    return getDatabase();
}

/**
 * Check if the database provider is configured and ready for queries.
 * Useful for guarding initialization code.
 */
export function isDatabaseConfigured(): boolean {
    return isDatabaseReady();
}

// ─── Edge Functions (RPC) ──────────────────────────────────────────

/**
 * Run a PostgreSQL stored procedure via the database provider.
 * Maps semantic names → procedure names via RPC_PROCEDURE_MAP.
 *
 * Preconditions:
 * - Network must be available
 * - Database provider must be ready
 */
export async function runEdgeFunction<T = any>(
    functionName: string,
    input: Record<string, any>
): Promise<T> {
    if (!isNetworkAvailable()) {
        throw new Error('[edge-function] Network offline — RPC calls require connectivity');
    }

    if (!isDatabaseReady()) {
        throw new Error('[edge-function] Database provider not ready — cannot execute RPC call');
    }

    // eslint-disable-next-line security/detect-object-injection
    const rpcProcedure = RPC_PROCEDURE_MAP[functionName];
    if (!rpcProcedure) {
        throw new Error(
            `Unknown edge function: "${functionName}". Supported: ${Object.keys(RPC_PROCEDURE_MAP).join(', ')}`
        );
    }

    logger.category('database').debug('[edge-function] Executing RPC call', { functionName });

    try {
        const { data, error } = await getDatabaseProvider().rpc(rpcProcedure, input);
        if (error) {
            logger.category('database').error('[edge-function] RPC call failed', { functionName, error: error.message });
            throw new Error(`RPC call "${rpcProcedure}" failed: ${error.message}`);
        }
        logger.category('database').debug('[edge-function] RPC call succeeded', { functionName });
        return data as T;
    } catch (error) {
        logger.category('database').error('[edge-function] RPC call failed', { functionName, error });
        throw error;
    }
}

/**
 * Invoke a Supabase Edge Function by name.
 * Uses the raw client escape hatch on the database provider for Edge Function calls,
 * which cannot be expressed through the standard DatabaseProvider RPC interface.
 *
 * Preconditions:
 * - Network must be available
 * - Database provider must be ready and have a raw client
 */
export async function invokeEdgeFunction<T = any>(
    functionName: string,
    input?: Record<string, any>
): Promise<T> {
    if (!isNetworkAvailable()) {
        throw new Error('[invoke-edge-function] Network offline — Edge Function calls require connectivity');
    }

    if (!isDatabaseReady()) {
        throw new Error('[invoke-edge-function] Database provider not ready');
    }

    const rawClient = getDatabaseProvider().getRawClient?.();
    if (!rawClient) {
        throw new Error('[invoke-edge-function] Database provider does not expose a raw client');
    }

    logger.category('database').debug('[invoke-edge-function] Invoking Edge Function', { functionName });

    try {
        const { data, error } = await rawClient.functions.invoke(functionName, {
            body: input,
        });
        if (error) {
            logger.category('database').error('[invoke-edge-function] Edge Function failed', { functionName, error: error.message });
            throw new Error(`Edge Function "${functionName}" failed: ${error.message}`);
        }
        logger.category('database').debug('[invoke-edge-function] Edge Function succeeded', { functionName });
        return data as T;
    } catch (error) {
        logger.category('database').error('[invoke-edge-function] Edge Function threw', { functionName, error });
        throw error;
    }
}

