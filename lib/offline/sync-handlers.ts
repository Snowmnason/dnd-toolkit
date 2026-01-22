/**
 * Sync Handlers Template
 *
 * Generic, reusable template for syncing offline mutations to Supabase.
 * Any DB module can register handlers here without coupling to specific data types.
 *
 * Pattern:
 * 1. Define operation interface for your table
 * 2. Register handler via `registerSyncHandler()`
 * 3. When sync manager processes mutations, it calls registered handler
 *
 * Example (for future notesDB):
 * ```ts
 * interface NoteOperation {
 *   table: 'notes';
 *   noteId: string;
 *   title?: string;
 *   content?: string;
 * }
 *
 * registerSyncHandler('notes', async (payload, operation, supabase) => {
 *   if (operation === 'create') {
 *     return await supabase.from('notes').insert(payload).select().single();
 *   }
 *   if (operation === 'update') {
 *     return await supabase.from('notes').update(payload).eq('id', payload.noteId).select().single();
 *   }
 *   if (operation === 'delete') {
 *     return await supabase.from('notes').delete().eq('id', payload.noteId);
 *   }
 * });
 * ```
 */

import type { QueuedMutation } from "./types";

/**
 * Result of executing a sync handler
 *
 * @param success - Whether the operation succeeded
 * @param data - Response data (single row/object). Should include server metadata when available:
 *              - updated_at: ISO8601 or epoch-ms timestamp (optional, for LWW conflict resolution)
 *              - version or etag: integer version or string etag (optional, for future versioning)
 * @param error - Error message if failed
 * @param conflict - Whether this is a conflict error (version mismatch, etag mismatch)
 */
export interface SyncHandlerResult {
  success: boolean;
  data?: any; // Single row/object, may include updated_at, version, etag
  error?: string;
  conflict?: boolean;
}

/**
 * Async handler for syncing a mutation to a specific table
 *
 * @param payload - The mutation payload (table-specific data)
 * @param operation - Operation type (create, update, delete)
 * @param supabaseClient - Supabase client for database access
 * @returns Result with success/error/conflict status
 */
export type SyncHandler = (
  payload: any,
  operation: "create" | "update" | "delete",
  supabaseClient: any,
) => Promise<SyncHandlerResult>;

/**
 * Registry for sync handlers by table name
 * Maps table -> handler function
 */
const handlerRegistry = new Map<string, SyncHandler>();

/**
 * Register a sync handler for a table
 *
 * Call this once during app initialization or module load.
 * Example:
 * ```ts
 * registerSyncHandler('notes', notesHandler);
 * registerSyncHandler('characters', charactersHandler);
 * ```
 *
 * @param table - Table name (e.g., 'notes', 'characters', 'shops')
 * @param handler - Handler function that knows how to sync for this table
 */
export function registerSyncHandler(table: string, handler: SyncHandler): void {
  if (handlerRegistry.has(table)) {
    console.warn(
      `[SyncHandlers] Handler for table '${table}' already registered, overwriting`,
    );
  }
  handlerRegistry.set(table, handler);
}

/**
 * Get a registered sync handler for a table
 * Returns null if no handler registered (e.g., for v1 excluded tables like 'worlds')
 *
 * @param table - Table name
 * @returns Handler function or null
 */
export function getSyncHandler(table: string): SyncHandler | null {
  return handlerRegistry.get(table) || null;
}

/**
 * Execute a mutation via its registered handler
 * Used by OnlineSyncManager.syncMutation()
 *
 * @param mutation - Queued mutation with table/operation/payload
 * @param supabaseClient - Supabase client
 * @returns Sync result
 */
export async function executeSyncHandler(
  mutation: QueuedMutation,
  supabaseClient: any,
): Promise<SyncHandlerResult> {
  const handler = getSyncHandler(mutation.table);

  if (!handler) {
    return {
      success: false,
      error: `No sync handler registered for table: ${mutation.table}`,
    };
  }

  try {
    return await handler(mutation.payload, mutation.operation, supabaseClient);
  } catch (error) {
    const errorMsg = (error as Error).message;
    return {
      success: false,
      error: errorMsg,
      conflict: errorMsg.includes("conflict") || errorMsg.includes("version"),
    };
  }
}

/**
 * Clear all registered handlers (mainly for testing)
 */
export function clearAllHandlers(): void {
  handlerRegistry.clear();
}

/**
 * Get list of tables with registered handlers (for debugging)
 */
export function getRegisteredTables(): string[] {
  return Array.from(handlerRegistry.keys());
}
