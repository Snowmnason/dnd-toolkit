/**
 * Example Sync Handler Templates
 *
 * This file demonstrates how to implement sync handlers for different data types.
 * Copy and adapt these patterns for your DB modules.
 *
 * Each handler is responsible for:
 * 1. Taking offline mutation payload (table-specific data)
 * 2. Executing the operation (create/update/delete) against Supabase
 * 3. Returning success/error/conflict status
 * 4. Checking timestamps for conflict detection
 *
 * Import pattern:
 * import { registerSyncHandler, type SyncHandler } from "@/lib/offline";
 */

/**
 * EXAMPLE 1: Notes Sync Handler
 *
 * For a future `notesDB` module:
 * ```ts
 * const notesSyncHandler: SyncHandler = async (payload, operation, supabase) => {
 *   try {
 *     switch (operation) {
 *       case "create": {
 *         const { data, error } = await supabase
 *           .from("notes")
 *           .insert(payload)
 *           .select()
 *           .single();
 *         if (error) throw new Error(error.message);
 *         return { success: true, data };
 *       }
 *
 *       case "update": {
 *         const { noteId, ...updates } = payload;
 *
 *         // Check for conflicts using serverVersion if available
 *         if (payload.serverVersion) {
 *           const { data: current } = await supabase
 *             .from("notes")
 *             .select("updated_at")
 *             .eq("id", noteId)
 *             .single();
 *
 *           if (current && current.updated_at > payload.serverVersion) {
 *             // Conflict detected — newer version exists on server
 *             return {
 *               success: false,
 *               error: `Conflict: server version ${current.updated_at} is newer`,
 *               conflict: true,
 *             };
 *           }
 *         }
 *
 *         const { data, error } = await supabase
 *           .from("notes")
 *           .update({ ...updates, updated_at: new Date().toISOString() })
 *           .eq("id", noteId)
 *           .select()
 *           .single();
 *
 *         if (error) throw new Error(error.message);
 *         return { success: true, data };
 *       }
 *
 *       case "delete": {
 *         const { noteId } = payload;
 *         const { error } = await supabase
 *           .from("notes")
 *           .delete()
 *           .eq("id", noteId);
 *         if (error) throw new Error(error.message);
 *         return { success: true, data: { id: noteId } };
 *       }
 *
 *       default:
 *         throw new Error(`Unknown operation: ${operation}`);
 *     }
 *   } catch (error) {
 *     const msg = (error as Error).message;
 *     return {
 *       success: false,
 *       error: msg,
 *       conflict: msg.includes("conflict") || msg.includes("version"),
 *     };
 *   }
 * };
 *
 * // Register handler in notesDB module initialization
 * registerSyncHandler("notes", notesSyncHandler);
 * ```
 */

/**
 * EXAMPLE 2: Characters Sync Handler
 *
 * For a future `charactersDB` module:
 * ```ts
 * const charactersSyncHandler: SyncHandler = async (payload, operation, supabase) => {
 *   try {
 *     switch (operation) {
 *       case "create": {
 *         // Characters typically belong to a user/world context
 *         const { data, error } = await supabase
 *           .from("characters")
 *           .insert({
 *             ...payload,
 *             created_at: new Date().toISOString(),
 *           })
 *           .select()
 *           .single();
 *         if (error) throw new Error(error.message);
 *         return { success: true, data };
 *       }
 *
 *       case "update": {
 *         const { characterId, ...updates } = payload;
 *         const { data, error } = await supabase
 *           .from("characters")
 *           .update({ ...updates, updated_at: new Date().toISOString() })
 *           .eq("id", characterId)
 *           .select()
 *           .single();
 *         if (error) throw new Error(error.message);
 *         return { success: true, data };
 *       }
 *
 *       case "delete": {
 *         const { characterId } = payload;
 *         const { error } = await supabase
 *           .from("characters")
 *           .delete()
 *           .eq("id", characterId);
 *         if (error) throw new Error(error.message);
 *         return { success: true, data: { id: characterId } };
 *       }
 *
 *       default:
 *         throw new Error(`Unknown operation: ${operation}`);
 *     }
 *   } catch (error) {
 *     return {
 *       success: false,
 *       error: (error as Error).message,
 *     };
 *   }
 * };
 *
 * registerSyncHandler("characters", charactersSyncHandler);
 * ```
 */

/**
 * EXAMPLE 3: Shops Sync Handler
 *
 * For a future `shopsDB` module:
 * ```ts
 * const shopsSyncHandler: SyncHandler = async (payload, operation, supabase) => {
 *   try {
 *     switch (operation) {
 *       case "create": {
 *         const { data, error } = await supabase
 *           .from("shops")
 *           .insert(payload)
 *           .select()
 *           .single();
 *         if (error) throw new Error(error.message);
 *         return { success: true, data };
 *       }
 *
 *       case "update": {
 *         const { shopId, ...updates } = payload;
 *         const { data, error } = await supabase
 *           .from("shops")
 *           .update({ ...updates, updated_at: new Date().toISOString() })
 *           .eq("id", shopId)
 *           .select()
 *           .single();
 *         if (error) throw new Error(error.message);
 *         return { success: true, data };
 *       }
 *
 *       case "delete": {
 *         const { shopId } = payload;
 *         const { error } = await supabase
 *           .from("shops")
 *           .delete()
 *           .eq("id", shopId);
 *         if (error) throw new Error(error.message);
 *         return { success: true, data: { id: shopId } };
 *       }
 *
 *       default:
 *         throw new Error(`Unknown operation: ${operation}`);
 *     }
 *   } catch (error) {
 *     return {
 *       success: false,
 *       error: (error as Error).message,
 *     };
 *   }
 * };
 *
 * registerSyncHandler("shops", shopsSyncHandler);
 * ```
 */

/**
 * INTEGRATION CHECKLIST
 *
 * When implementing a new DB module with offline support:
 *
 * 1. [ ] Create sync handler (adapt from templates above)
 * 2. [ ] Call `registerSyncHandler(tableName, handler)` during module initialization
 * 3. [ ] Wrap mutations with `enqueueIfOffline()` in your create/update/delete functions
 * 4. [ ] Include `invalidateTags` in mutation payload for cache invalidation
 * 5. [ ] Capture `serverVersion` (updated_at timestamp) before mutations for conflict detection
 * 6. [ ] Test with offline mode enabled
 * 7. [ ] Verify sync works after reconnecting
 *
 * Example mutation wrapper:
 * ```ts
 * async function updateNote(noteId: string, updates: Partial<Note>): Promise<Note> {
 *   // Capture server version for conflict detection
 *   const { data: current } = await supabase
 *     .from("notes")
 *     .select("updated_at")
 *     .eq("id", noteId)
 *     .single();
 *
 *   return enqueueIfOffline(
 *     async () => {
 *       // Online path: direct Supabase call
 *       const { data, error } = await supabase
 *         .from("notes")
 *         .update(updates)
 *         .eq("id", noteId)
 *         .select()
 *         .single();
 *       if (error) throw new Error(error.message);
 *       return data;
 *     },
 *     {
 *       operation: "update",
 *       table: "notes",
 *       payload: { noteId, ...updates, serverVersion: current?.updated_at },
 *       invalidateTags: ["notes", `note:${noteId}`],
 *     }
 *   );
 * }
 * ```
 */

export { };

