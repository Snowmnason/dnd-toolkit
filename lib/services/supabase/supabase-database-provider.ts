/**
 * Supabase Database Provider Implementation
 *
 * Wraps the Supabase SDK (PostgREST API) in the `DatabaseProvider` interface
 * so entity files don't depend on @supabase/supabase-js directly.
 *
 * Fluent QueryBuilder mirrors Supabase's chain-able API:
 *   from('users', 'public').select('id, email').eq('id', '123').single()
 *
 * Error mapping converts Supabase `PostgrestError` to `QueryError`.
 */

import {
    DatabaseProvider,
    QueryBuilder,
    QueryError,
    QueryResult,
} from '../database-adapter';

/**
 * Internal representation of a pending Supabase query
 * Tracks the chained methods to build the final query
 */
interface PendingQuery {
  table: string;
  schema: string;
  filters: { type: string; args: any[] }[];
  operations: { type: string; args: any[] }[];
}

/**
 * Supabase QueryBuilder implementation
 * Wraps Supabase's fluent API and converts responses to QueryResult format
 */
class SupabaseQueryBuilder implements QueryBuilder {
  private pending: PendingQuery;

  constructor(
    private supabaseClient: any,
    table: string,
    schema: string = 'public'
  ) {
    this.pending = {
      table,
      schema,
      filters: [],
      operations: [],
    };
  }

  select(columns?: string): QueryBuilder {
    this.pending.operations.push({ type: 'select', args: [columns] });
    return this;
  }

  insert(data: Record<string, any> | Record<string, any>[]): QueryBuilder {
    this.pending.operations.push({ type: 'insert', args: [data] });
    return this;
  }

  update(data: Record<string, any>): QueryBuilder {
    this.pending.operations.push({ type: 'update', args: [data] });
    return this;
  }

  delete(): QueryBuilder {
    this.pending.operations.push({ type: 'delete', args: [] });
    return this;
  }

  eq(column: string, value: any): QueryBuilder {
    this.pending.filters.push({ type: 'eq', args: [column, value] });
    return this;
  }

  neq(column: string, value: any): QueryBuilder {
    this.pending.filters.push({ type: 'neq', args: [column, value] });
    return this;
  }

  gt(column: string, value: any): QueryBuilder {
    this.pending.filters.push({ type: 'gt', args: [column, value] });
    return this;
  }

  lt(column: string, value: any): QueryBuilder {
    this.pending.filters.push({ type: 'lt', args: [column, value] });
    return this;
  }

  gte(column: string, value: any): QueryBuilder {
    this.pending.filters.push({ type: 'gte', args: [column, value] });
    return this;
  }

  lte(column: string, value: any): QueryBuilder {
    this.pending.filters.push({ type: 'lte', args: [column, value] });
    return this;
  }

  in(column: string, values: any[]): QueryBuilder {
    this.pending.filters.push({ type: 'in', args: [column, values] });
    return this;
  }

  is(column: string, value: null | boolean): QueryBuilder {
    this.pending.filters.push({ type: 'is', args: [column, value] });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): QueryBuilder {
    this.pending.operations.push({
      type: 'order',
      args: [column, options],
    });
    return this;
  }

  limit(count: number): QueryBuilder {
    this.pending.operations.push({ type: 'limit', args: [count] });
    return this;
  }

  async single(): Promise<QueryResult> {
    const result = await this.executeInternal();
    if (result.error) return result;

    // Validate single row expectation
    if (!result.data) {
      return {
        data: null,
        error: {
          message: 'No rows returned',
          code: 'PGRST116',
          details: 'Call to single() did not return exactly one row',
        },
      };
    }

    if (Array.isArray(result.data) && result.data.length !== 1) {
      return {
        data: null,
        error: {
          message: `Expected exactly one row, got ${Array.isArray(result.data) ? result.data.length : 'unexpected'}`,
          code: 'PGRST116',
          details: 'single() requires exactly one matching row',
        },
      };
    }

    return result;
  }

  async maybeSingle(): Promise<QueryResult> {
    const result = await this.executeInternal();
    if (result.error) return result;

    // Allow 0 or 1 rows
    if (Array.isArray(result.data) && result.data.length > 1) {
      return {
        data: null,
        error: {
          message: `Expected at most one row, got ${result.data.length}`,
          code: 'PGRST116',
          details: 'maybeSingle() allows 0 or 1 rows, not more',
        },
      };
    }

    // Convert single-element array to object, or keep null
    if (Array.isArray(result.data) && result.data.length === 1) {
      return { data: result.data[0], error: null };
    }

    return result;
  }

  async execute(): Promise<QueryResult> {
    return this.executeInternal();
  }

  /**
   * Build and execute the query against Supabase
   */
  private async executeInternal(): Promise<QueryResult> {
    try {
      // Start with schema and table
      let query = this.supabaseClient
        .schema(this.pending.schema)
        .from(this.pending.table);

      // Apply operations (select, insert, update, delete)
      for (const op of this.pending.operations) {
        if (op.type === 'select') {
          query = query.select(op.args[0]);
        } else if (op.type === 'insert') {
          query = query.insert(op.args[0]);
        } else if (op.type === 'update') {
          query = query.update(op.args[0]);
        } else if (op.type === 'delete') {
          query = query.delete();
        } else if (op.type === 'order') {
          query = query.order(op.args[0], op.args[1]);
        } else if (op.type === 'limit') {
          query = query.limit(op.args[0]);
        }
      }

      // Apply filters
      for (const filter of this.pending.filters) {
        if (filter.type === 'eq') {
          query = query.eq(filter.args[0], filter.args[1]);
        } else if (filter.type === 'neq') {
          query = query.neq(filter.args[0], filter.args[1]);
        } else if (filter.type === 'gt') {
          query = query.gt(filter.args[0], filter.args[1]);
        } else if (filter.type === 'lt') {
          query = query.lt(filter.args[0], filter.args[1]);
        } else if (filter.type === 'gte') {
          query = query.gte(filter.args[0], filter.args[1]);
        } else if (filter.type === 'lte') {
          query = query.lte(filter.args[0], filter.args[1]);
        } else if (filter.type === 'in') {
          query = query.in(filter.args[0], filter.args[1]);
        } else if (filter.type === 'is') {
          query = query.is(filter.args[0], filter.args[1]);
        }
      }

      // Execute and return normalized response
      const { data, error } = await query;

      if (error) {
        return {
          data: null,
          error: this.mapPostgrestError(error),
        };
      }

      return {
        data,
        error: null,
      };
    } catch (err: any) {
      return {
        data: null,
        error: {
          message: err?.message || 'Unknown query error',
          code: 'UNKNOWN_ERROR',
          details: err?.toString?.(),
        },
      };
    }
  }

  /**
   * Map Supabase PostgrestError to QueryError interface
   */
  private mapPostgrestError(error: any): QueryError {
    return {
      message: error.message || 'Query failed',
      code: error.code || 'UNKNOWN_CODE',
      details: error.details,
      hint: error.hint,
    };
  }
}

/**
 * Supabase Database Provider
 * Implements DatabaseProvider by wrapping the Supabase client
 *
 * Usage:
 *   const provider = new SupabaseDatabaseProvider(supabaseClient);
 *   const result = await provider.from('users').select().eq('id', '123').single();
 */
export class SupabaseDatabaseProvider implements DatabaseProvider {
  readonly name = 'Supabase';
  private supabaseClient: any;
  private cachedConfigured: boolean | null = null;

  constructor(supabaseClient: any) {
    this.supabaseClient = supabaseClient;
  }

  from(table: string, schema: string = 'public'): QueryBuilder {
    return new SupabaseQueryBuilder(this.supabaseClient, table, schema);
  }

  async rpc(
    functionName: string,
    params?: Record<string, any>,
    schema: string = 'public'
  ): Promise<QueryResult> {
    try {
      const { data, error } = await this.supabaseClient
        .schema(schema)
        .rpc(functionName, params || {});

      if (error) {
        return {
          data: null,
          error: {
            message: error.message || 'RPC call failed',
            code: error.code || 'RPC_ERROR',
            details: error.details,
            hint: error.hint,
          },
        };
      }

      return {
        data,
        error: null,
      };
    } catch (err: any) {
      return {
        data: null,
        error: {
          message: err?.message || 'RPC execution error',
          code: 'RPC_ERROR',
          details: err?.toString?.(),
        },
      };
    }
  }

  isConfigured(): boolean {
    // Check if client is initialized and has auth/rest methods
    if (this.cachedConfigured === null) {
      this.cachedConfigured = !!(
        this.supabaseClient &&
        typeof this.supabaseClient.from === 'function' &&
        typeof this.supabaseClient.rpc === 'function'
      );
    }
    return this.cachedConfigured;
  }

  getRawClient(): any {
    return this.supabaseClient;
  }
}
