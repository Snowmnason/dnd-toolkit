import type { RequestOptions } from "@/lib/api/request-manager";

export type DbOperation = "read" | "list" | "create" | "update" | "delete" | "rpc";

/**
 * Per-operation RequestManager defaults.
 *
 * Tuned for typical DB access patterns:
 * - **read** (fetch single): dedupe=true (single record queries benefit from dedup),
 *   retries=1 (network assumed stable), timeout=7s
 * - **list** (fetch multiple): dedupe=true (aggregations benefit from dedup),
 *   retries=1, timeout=10s
 * - **create** (insert): dedupe=false (new rows always different),
 *   retries=3 (expensive operation), timeout=20s
 * - **update** (modify): dedupe=false (state changes between calls),
 *   retries=2, timeout=15s
 * - **delete** (soft delete/remove): dedupe=false,
 *   retries=1 (idempotent), timeout=10s
 * - **rpc** (stored procedure): dedupe=false,
 *   retries=2 (depends on function complexity), timeout=15s
 */
export const PER_OPERATION_DEFAULTS: Record<DbOperation, Omit<RequestOptions, "authStrategy">> = {
  read: {
    dedupe: true,
    retries: 1,
    timeout: 7000,
  },
  list: {
    dedupe: true,
    retries: 1,
    timeout: 10000,
  },
  create: {
    dedupe: false,
    retries: 3,
    timeout: 20000,
  },
  update: {
    dedupe: false,
    retries: 2,
    timeout: 15000,
  },
  delete: {
    dedupe: false,
    retries: 1,
    timeout: 10000,
  },
  rpc: {
    dedupe: false,
    retries: 2,
    timeout: 15000,
  },
};

/**
 * Merge per-operation defaults with caller-provided overrides.
 *
 * **IMPORTANT:** `authStrategy` is always explicit (no default provided).
 * Caller must always specify it to ensure permission checks are visible at call sites.
 *
 * @param operation - DB operation type ("read", "create", "update", "delete", "list", "rpc")
 * @param authStrategy - Auth strategy ("user", "public", "invite", etc.) — ALWAYS required
 * @param overrides - Optional overrides for dedupe, retries, timeout
 * @returns Merged RequestOptions for RequestManager.fetch()
 *
 * @example
 * // Standard list read with user auth
 * RequestManager.fetch(key, fn, dbRequestOptions("list", "user"))
 *
 * // Create with longer timeout
 * RequestManager.fetch(key, fn, dbRequestOptions("create", "user", { timeout: 25000 }))
 *
 * // Delete with fewer retries
 * RequestManager.fetch(key, fn, dbRequestOptions("delete", "user", { retries: 0 }))
 *
 * // Public read (world details visible to all)
 * RequestManager.fetch(key, fn, dbRequestOptions("read", "public"))
 *
 * // Invite-only operation
 * RequestManager.fetch(key, fn, dbRequestOptions("rpc", "invite"))
 */
export function dbRequestOptions(
  operation: DbOperation,
  authStrategy: RequestOptions["authStrategy"],
  overrides?: Partial<Omit<RequestOptions, "authStrategy">>,
): RequestOptions {
  return {
    // eslint-disable-next-line security/detect-object-injection
    ...PER_OPERATION_DEFAULTS[operation],
    ...overrides,
    authStrategy,
  };
}
