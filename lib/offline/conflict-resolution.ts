/**
 * Conflict Resolution — Last-Write-Wins Strategy (v1)
 *
 * Simple conflict resolution for v1 offline support.
 * Only uses Last-Write-Wins (LWW): compare timestamps, newer version wins.
 *
 * Future: Support for field-level merging and multi-device sync in later phases.
 */

import { QueuedMutation, SyncConflict } from "./types";

/**
 * Represents the result of applying a conflict resolution strategy
 */
export interface ConflictResolutionResult {
  /** Which strategy was used */
  strategy: "last-write-wins";

  /** Should the offline mutation be retried/reapplied? */
  shouldRetry: boolean;

  /** If false, discard the mutation from queue */
  shouldKeep: boolean;

  /** Reason for decision (for logging) */
  reason: string;
}

/**
 * Last-Write-Wins (LWW): Compare timestamps, newer wins
 * Simpler but may lose data. Use for low-stakes content (v1).
 */
export function resolveLastWriteWins(
  mutation: QueuedMutation,
  conflict: SyncConflict,
  serverTimestamp?: number,
): ConflictResolutionResult {
  const localTimestamp = mutation.timestamp;
  const serverTime = serverTimestamp || 0;

  if (serverTime > localTimestamp) {
    // Server is newer, discard offline mutation
    return {
      strategy: "last-write-wins",
      shouldRetry: false,
      shouldKeep: false,
      reason: `Server version is newer (server: ${serverTime}, local: ${localTimestamp})`,
    };
  } else {
    // Local is newer or equal, retry with local version
    return {
      strategy: "last-write-wins",
      shouldRetry: true,
      shouldKeep: true,
      reason: `Local version is newer or equal (local: ${localTimestamp}, server: ${serverTime})`,
    };
  }
}

/**
 * FUTURE: Server-Wins strategy (commented out for v1)
 *
 * Always defer to server, discard offline changes.
 * Safe but user loses offline work. Use for critical/permission-sensitive data.
 *
 * export function resolveServerWins(
 *   mutation: QueuedMutation,
 *   conflict: SyncConflict,
 *   serverData?: Record<string, any>,
 * ): ConflictResolutionResult {
 *   return {
 *     strategy: "server-wins",
 *     shouldRetry: false,
 *     shouldKeep: false,
 *     reason:
 *       "Server-wins strategy: discarding offline mutation to preserve server state",
 *   };
 * }
 */

/**
 * FUTURE: Client-Wins strategy (commented out for v1)
 *
 * Always keep offline changes, override server.
 * Preserves user intent but may overwrite newer server data.
 * Use for user-owned editable content (notes, characters, drafts).
 *
 * export function resolveClientWins(
 *   mutation: QueuedMutation,
 *   conflict: SyncConflict,
 * ): ConflictResolutionResult {
 *   return {
 *     strategy: "client-wins",
 *     shouldRetry: true,
 *     shouldKeep: true,
 *     reason:
 *       "Client-wins strategy: retrying offline mutation to preserve user intent",
 *   };
 * }
 */

/**
 * FUTURE: User-Chooses strategy (commented out for v1)
 *
 * Defer decision to user via modal.
 * Safest but requires UI interaction. Use for important/destructive operations.
 *
 * export function resolveUserChoosesRequired(
 *   mutation: QueuedMutation,
 *   conflict: SyncConflict,
 * ): ConflictResolutionResult {
 *   return {
 *     strategy: "user-choice",
 *     shouldRetry: false,
 *     shouldKeep: true, // Keep in queue until user decides
 *     reason: "User input required to resolve this conflict",
 *   };
 * }
 */

/**
 * FUTURE: Apply user's conflict resolution choice (commented out for v1)
 *
 * Called after user selects resolution strategy from modal.
 *
 * export function applyUserChoice(
 *   choice: "client-wins" | "server-wins" | "discard",
 *   mutation: QueuedMutation,
 *   conflict: SyncConflict,
 * ): ConflictResolutionResult {
 *   switch (choice) {
 *     case "client-wins":
 *       return {
 *         strategy: "client-wins",
 *         shouldRetry: true,
 *         shouldKeep: true,
 *         reason: "User chose to keep offline changes",
 *       };
 *     case "server-wins":
 *       return {
 *         strategy: "server-wins",
 *         shouldRetry: false,
 *         shouldKeep: false,
 *         reason: "User chose to keep server version",
 *       };
 *     case "discard":
 *       return {
 *         strategy: "user-choice",
 *         shouldRetry: false,
 *         shouldKeep: false,
 *         reason: "User chose to discard offline changes",
 *       };
 *   }
 * }
 */

/**
 * FUTURE: Determine best conflict resolution strategy (commented out for v1)
 *
 * In v1, always use LWW. Future phases will add intelligent strategy selection.
 *
 * export function getRecommendedStrategy(
 *   operation: "create" | "update" | "delete",
 *   resourceType: string,
 *   isUserOwned: boolean,
 * ): "last-write-wins" | "server-wins" | "client-wins" | "user-choice" {
 *   // Destructive operations should require user input
 *   if (operation === "delete") {
 *     return "user-choice";
 *   }
 *
 *   // User-owned editable content: default to client-wins to preserve intent
 *   if (
 *     isUserOwned &&
 *     (resourceType === "notes" ||
 *       resourceType === "characters" ||
 *       resourceType === "shops")
 *   ) {
 *     return "client-wins";
 *   }
 *
 *   // Shared/permission-sensitive content: default to server-wins for safety
 *   if (resourceType === "worlds" || resourceType === "members") {
 *     return "server-wins";
 *   }
 *
 *   // Fall back to LWW for unknown types
 *   return "last-write-wins";
 * }
 */

/**
 * Execute conflict resolution using Last-Write-Wins (v1 only)
 */
export function executeConflictResolution(
  mutation: QueuedMutation,
  conflict: SyncConflict,
  serverData?: { timestamp?: number; data?: Record<string, any> },
): ConflictResolutionResult {
  // v1: Always use LWW
  return resolveLastWriteWins(mutation, conflict, serverData?.timestamp);
}
