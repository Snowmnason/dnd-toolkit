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

import { logger } from '@/lib/utils/logger';
import { ConnectionQuality, NetworkDetection } from '@/system/Network';
import {
    getDatabaseProvider,
    isServiceReady,
    type DatabaseProvider
} from '@/system/Services';
import {
    runEdgeFunction as rawRunEdgeFunction,
    type EdgeFunctionInput,
    type EdgeFunctionOutput,
} from '@/system/Services/supabase/supabase-rpc-provider';

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
 * Run an edge function via RPC with precondition checks.
 * Checks network availability and database provider readiness before executing.
 *
 * @param functionName semantic name (e.g., 'leaveWorld')
 * @param input parameters to pass to the RPC call
 * @returns result from the RPC call
 *
 * Preconditions:
 * - Network must be available (database operations require connectivity)
 * - Database provider must be ready (initialized)
 *
 * If preconditions fail, throws with descriptive error.
 */
export async function runEdgeFunction<T extends EdgeFunctionOutput = any>(
    functionName: string,
    input: EdgeFunctionInput
): Promise<T> {
    if (!isNetworkAvailable()) {
        throw new Error('[edge-function] Network offline — RPC calls require connectivity');
    }

    if (!isDatabaseReady()) {
        throw new Error('[edge-function] Database provider not ready — cannot execute RPC call');
    }

    logger.category('database').debug('[edge-function] Executing RPC call', {
        functionName,
    });

    try {
        const result = await rawRunEdgeFunction<T>(functionName, input);
        logger.category('database').debug('[edge-function] RPC call succeeded', {
            functionName,
        });
        return result;
    } catch (error) {
        logger.category('database').error('[edge-function] RPC call failed', {
            functionName,
            error,
        });
        throw error;
    }
}

