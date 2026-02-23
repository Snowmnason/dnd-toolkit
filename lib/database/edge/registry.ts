/**
 * Edge Function Registry
 *
 * Central registry for edge function (stored procedure / RPC) implementations.
 * Allows swapping between different backends (Supabase RPC, Cloud Functions, etc.)
 * without changing call sites.
 *
 * @example
 * // Register a Supabase RPC adapter
 * registerEdgeFunction('leaveWorld', {
 *   name: 'leaveWorld',
 *   handler: (input) => runSupabaseRpc('leave_world', input)
 * });
 *
 * // Call it semantically
 * const result = await executeEdgeFunction('leaveWorld', { world_id: '123' });
 */

import { logger } from "@/lib/utils";

/**
 * Generic edge function implementation interface
 *
 * Each implementation maps a semantic function name to a backend-specific handler.
 */
export interface EdgeFunctionImplementation<Input = any, Output = any> {
  /** Semantic function name (e.g., 'leaveWorld', 'createInviteLink') */
  name: string;
  /** Backend-specific handler that executes the function */
  handler: (input: Input) => Promise<Output>;
}

/**
 * Edge function registry
 *
 * Maps semantic function names to their implementations.
 * Supports runtime swapping of backends.
 */
class EdgeFunctionRegistry {
  private implementations = new Map<
    string,
    EdgeFunctionImplementation<any, any>
  >();

  /**
   * Register an edge function implementation
   *
   * @param name semantic function name (e.g., 'leaveWorld')
   * @param impl implementation with handler
   */
  register<Input, Output>(
    name: string,
    impl: EdgeFunctionImplementation<Input, Output>
  ): void {
    if (this.implementations.has(name)) {
      logger
        .category("database")
        .warn(`Edge function "${name}" already registered, overwriting`);
    }
    this.implementations.set(name, impl);
    logger
      .category("database")
      .debug(`Registered edge function: ${name}`);
  }

  /**
   * Get an edge function implementation
   *
   * @param name semantic function name
   * @returns implementation if found, null otherwise
   */
  get<Input, Output>(
    name: string
  ): EdgeFunctionImplementation<Input, Output> | null {
    const impl = this.implementations.get(name);
    return impl || null;
  }

  /**
   * Check if an edge function is registered
   *
   * @param name semantic function name
   * @returns true if registered
   */
  has(name: string): boolean {
    return this.implementations.has(name);
  }

  /**
   * Get all registered function names
   *
   * @returns array of registered names
   */
  getRegisteredNames(): string[] {
    return Array.from(this.implementations.keys());
  }

  /**
   * Clear all registrations (useful for tests)
   */
  clear(): void {
    this.implementations.clear();
  }
}

/**
 * Singleton registry instance
 */
const registry = new EdgeFunctionRegistry();

/**
 * Register an edge function implementation
 *
 * @param name semantic function name
 * @param impl implementation with handler
 *
 * @example
 * registerEdgeFunction('leaveWorld', {
 *   name: 'leaveWorld',
 *   handler: async (input) => { ... }
 * });
 */
export function registerEdgeFunction<Input, Output>(
  name: string,
  impl: EdgeFunctionImplementation<Input, Output>
): void {
  registry.register(name, impl);
}

/**
 * Get a registered edge function implementation
 *
 * @param name semantic function name
 * @returns implementation if found
 * @throws Error if not found
 *
 * @example
 * const impl = getEdgeFunction('leaveWorld');
 * const result = await impl.handler({ world_id: '123' });
 */
export function getEdgeFunction<Input = any, Output = any>(
  name: string
): EdgeFunctionImplementation<Input, Output> {
  const impl = registry.get<Input, Output>(name);
  if (!impl) {
    const available = registry.getRegisteredNames();
    throw new Error(
      `Edge function "${name}" not registered. Available: ${available.length > 0 ? available.join(", ") : "none"}`
    );
  }
  return impl;
}

/**
 * Execute a registered edge function
 *
 * @param name semantic function name
 * @param input parameters to pass to the handler
 * @returns result from the handler
 * @throws Error if function not registered
 *
 * @example
 * const result = await executeEdgeFunction('leaveWorld', { world_id: '123' });
 */
export async function executeEdgeFunction<Output = any>(
  name: string,
  input: any
): Promise<Output> {
  const impl = getEdgeFunction(name);
  try {
    logger
      .category("database")
      .debug(`Executing edge function: ${name}`);
    const result = await impl.handler(input);
    logger
      .category("database")
      .debug(`Edge function "${name}" completed successfully`);
    return result;
  } catch (err) {
    logger
      .category("database")
      .error(`Edge function "${name}" failed:`, { err });
    throw err;
  }
}

/**
 * Check if an edge function is registered
 *
 * @param name semantic function name
 * @returns true if registered
 */
export function isEdgeFunctionRegistered(name: string): boolean {
  return registry.has(name);
}

/**
 * Get all registered edge function names
 *
 * Useful for debugging and testing.
 *
 * @returns array of registered names
 */
export function getRegisteredEdgeFunctions(): string[] {
  return registry.getRegisteredNames();
}

/**
 * Clear all registered edge functions
 *
 * **Use with caution** — only for testing or complete provider swaps.
 */
export function clearEdgeFunctionRegistry(): void {
  registry.clear();
  logger
    .category("database")
    .warn("Cleared all edge function registrations");
}

export { EdgeFunctionRegistry };

