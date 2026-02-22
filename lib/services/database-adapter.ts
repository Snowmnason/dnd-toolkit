/**
 * Database Provider Abstraction
 *
 * This module defines the `DatabaseProvider` interface and factory functions to abstract
 * the database backend (currently Supabase, future: PostgreSQL, Firebase). Entity files
 * use `getDatabaseProvider()` instead of direct Supabase imports, enabling provider swaps.
 *
 * Decisions:
 * - Fluent QueryBuilder API matches existing entity query patterns
 * - Schema as optional parameter: `from(table, schema?)` defaults to 'public'
 * - RPC support with schema parameter for stored procedures
 * - NoOp provider throws clear errors if called before registration
 */

import { logger } from '@/lib/utils';

/**
 * Error type representing a query failure
 */
export interface QueryError {
  /** Human-readable error message */
  message: string;
  /** Machine-readable error code (e.g., "PGRST001") */
  code: string;
  /** Additional context about the error */
  details?: string;
  /** Hint for resolving the error */
  hint?: string;
}

/**
 * Result of a query execution
 * Mirrors Supabase's response format: either data or error, never both
 */
export interface QueryResult<T = any> {
  /** Query result data, or null if the query returned no rows or encountered an error */
  data: T | null;
  /** Error object if the query failed, null otherwise */
  error: QueryError | null;
}

/**
 * Fluent query builder interface
 * Represents a pending database query that can be chained and executed
 *
 * Example:
 *   getDatabaseProvider()
 *     .from('users', 'public')
 *     .select('id, email, name')
 *     .eq('id', '123')
 *     .single()
 */
export interface QueryBuilder {
  /**
   * Select specific columns
   * @param columns - Comma-separated list of columns, or undefined for *
   */
  select(columns?: string): QueryBuilder;

  /**
   * Insert one or more rows
   * @param data - Single object or array of objects to insert
   */
  insert(data: Record<string, any> | Record<string, any>[]): QueryBuilder;

  /**
   * Update rows
   * @param data - Object with columns to update
   */
  update(data: Record<string, any>): QueryBuilder;

  /**
   * Delete rows
   */
  delete(): QueryBuilder;

  /**
   * Filter by exact match
   * @param column - Column name
   * @param value - Value to match
   */
  eq(column: string, value: any): QueryBuilder;

  /**
   * Filter by not equal
   * @param column - Column name
   * @param value - Value to exclude
   */
  neq(column: string, value: any): QueryBuilder;

  /**
   * Filter by greater than
   * @param column - Column name
   * @param value - Value to compare
   */
  gt(column: string, value: any): QueryBuilder;

  /**
   * Filter by less than
   * @param column - Column name
   * @param value - Value to compare
   */
  lt(column: string, value: any): QueryBuilder;

  /**
   * Filter by greater than or equal
   * @param column - Column name
   * @param value - Value to compare
   */
  gte(column: string, value: any): QueryBuilder;

  /**
   * Filter by less than or equal
   * @param column - Column name
   * @param value - Value to compare
   */
  lte(column: string, value: any): QueryBuilder;

  /**
   * Filter by inclusion in array
   * @param column - Column name
   * @param values - Values to match (any)
   */
  in(column: string, values: any[]): QueryBuilder;

  /**
   * Filter by null or boolean value
   * @param column - Column name
   * @param value - null, true, or false
   */
  is(column: string, value: null | boolean): QueryBuilder;

  /**
   * Order results
   * @param column - Column name to order by
   * @param options - { ascending?: boolean } (default: ascending = true)
   */
  order(column: string, options?: { ascending?: boolean }): QueryBuilder;

  /**
   * Limit result count
   * @param count - Number of rows to return
   */
  limit(count: number): QueryBuilder;

  /**
   * Execute and return exactly one row (throws if 0 or >1 rows)
   */
  single(): Promise<QueryResult>;

  /**
   * Execute and return 0 or 1 rows (succeeds with null data if empty)
   */
  maybeSingle(): Promise<QueryResult>;

  /**
   * Execute the query and return results
   */
  execute(): Promise<QueryResult>;
}

/**
 * Database provider interface
 * Abstracts the database backend so entity files don't depend on Supabase directly
 *
 * Implementations:
 * - SupabaseDatabaseProvider: wraps @supabase/supabase-js
 * - NoOpDatabaseProvider: throws clear errors (used when DB not configured)
 * - Future: PostgresDatabaseProvider, FirebaseDatabaseProvider
 */
export interface DatabaseProvider {
  /**
   * Get a query builder for a table
   * @param table - Table name
   * @param schema - Schema name (optional, defaults to 'public')
   */
  from(table: string, schema?: string): QueryBuilder;

  /**
   * Call a stored procedure / RPC
   * @param functionName - RPC function name
   * @param params - Parameters to pass to the function
   * @param schema - Schema containing the function (optional, defaults to 'public')
   */
  rpc(
    functionName: string,
    params?: Record<string, any>,
    schema?: string
  ): Promise<QueryResult>;

  /**
   * Check if the provider is configured and ready to use
   */
  isConfigured(): boolean;

  /**
   * Provider name for logging and debugging
   */
  readonly name: string;

  /**
   * Optional: Get the raw client for edge cases (e.g., Supabase functions)
   * @deprecated Prefer using DatabaseProvider methods. Only use for Supabase-specific edge functions.
   */
  getRawClient?(): any;
}

/**
 * NoOp (no-operation) database provider
 * Used when the database is not configured. Throws clear errors on all operations.
 * Prevents app crashes when database init fails.
 */
export class NoOpDatabaseProvider implements DatabaseProvider {
  readonly name = 'NoOp';

  private throwNotConfigured(operation: string): never {
    const error = new Error(
      `[Database] Not configured: Cannot ${operation}. ` +
        `DatabaseProvider not registered. This usually means the app is running ` +
        `without database credentials or initialization failed. Check Supabase config.`
    );
    logger.category('api').error(error.message);
    throw error;
  }

  from(): QueryBuilder {
    this.throwNotConfigured('query (from)');
  }

  async rpc(): Promise<QueryResult> {
    this.throwNotConfigured('call RPC');
  }

  isConfigured(): boolean {
    return false;
  }

  getRawClient() {
    this.throwNotConfigured('get raw client');
  }
}

/**
 * Service registry for database provider
 * Singleton that holds the currently registered provider
 */
let registeredProvider: DatabaseProvider | null = null;
const noOpProvider = new NoOpDatabaseProvider();

/**
 * Get the current database provider
 * Returns NoOp if no provider has been registered
 *
 * Safe to call before app fully boots; will throw clear error if query attempted
 * before registration.
 */
export function getDatabaseProvider(): DatabaseProvider {
  if (!registeredProvider) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[Database] getDatabaseProvider() called before registerDatabaseProvider(). ' +
          'Returning NoOp provider which will throw on query attempts. ' +
          'Ensure DatabaseProvider is registered in service-initializer before any entity queries run.'
      );
    }
    return noOpProvider;
  }
  return registeredProvider;
}

/**
 * Register a database provider
 * Called during app bootstrap in service-initializer.ts
 *
 * @param provider - The provider to register (e.g., SupabaseDatabaseProvider)
 */
export function registerDatabaseProvider(provider: DatabaseProvider): void {
  registeredProvider = provider;
  logger
    .category('api')
    .info(`Database provider registered: ${provider.name}`);
}

/**
 * Reset provider (for testing)
 * @internal
 */
export function resetDatabaseProvider(): void {
  registeredProvider = null;
}
