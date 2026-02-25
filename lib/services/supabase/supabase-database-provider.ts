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

import { ERROR_CODES } from '../../utils/ERROR_CODES';
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

  or(filter: string): QueryBuilder {
    this.pending.filters.push({ type: 'or', args: [filter] });
    return this;
  }

  not(column: string, operator: string, value: any): QueryBuilder {
    this.pending.filters.push({ type: 'not', args: [column, operator, value] });
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

  range(from: number, to: number): QueryBuilder {
    this.pending.operations.push({ type: 'range', args: [from, to] });
    return this;
  }

  async single(): Promise<QueryResult> {
    // Delegate to Supabase's native .single() so it sends the correct
    // Accept: application/vnd.pgrst.object+json header and handles PGRST116
    // (0 or >1 rows) natively at the API level.
    return this.executeInternal('single');
  }

  async maybeSingle(): Promise<QueryResult> {
    // Delegate to Supabase's native .maybeSingle() — returns null for 0 rows,
    // errors on >1 row natively.
    return this.executeInternal('maybeSingle');
  }

  async execute(): Promise<QueryResult> {
    return this.executeInternal();
  }

  /**
   * Build and execute the query against Supabase.
   *
   * @param terminator - Optional row-count enforcer applied as the final
   *   step of the Supabase chain. Passing 'single' or 'maybeSingle' lets the
   *   Supabase SDK (PostgREST) handle PGRST116 errors natively rather than
   *   re-implementing the logic in JS.
   */
  private async executeInternal(
    terminator?: 'single' | 'maybeSingle'
  ): Promise<QueryResult> {
    try {
      // Start with schema and table
      let query = this.supabaseClient
        .schema(this.pending.schema)
        .from(this.pending.table);

      // Apply DML / column-selection operations (select, insert, update, delete)
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
        } else if (op.type === 'range') {
          query = query.range(op.args[0], op.args[1]);
        }
      }

      // Apply filters (WHERE clauses)
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
        } else if (filter.type === 'or') {
          // `or` and `not` are not on Supabase's static chain type at this point
          // because TypeScript loses the overloaded return type after chaining.
          // Both methods exist at runtime; the cast is safe and contained here.
          query = (query as any).or(filter.args[0]);
        } else if (filter.type === 'not') {
          query = (query as any).not(filter.args[0], filter.args[1], filter.args[2]);
        }
      }

      // Apply row-count terminator LAST so Supabase handles it natively
      const { data, error } =
        terminator === 'single'
          ? await query.single()
          : terminator === 'maybeSingle'
            ? await query.maybeSingle()
            : await query;

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
          code: ERROR_CODES.DATABASE.UNKNOWN,
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
            code: error.code || ERROR_CODES.DATABASE.QUERY_FAILED,
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
          code: ERROR_CODES.DATABASE.QUERY_FAILED,
          details: err?.toString?.(),
        },
      };
    }
  }

  isConfigured(): boolean {
    return !!(
      this.supabaseClient &&
      typeof this.supabaseClient.from === 'function' &&
      typeof this.supabaseClient.rpc === 'function'
    );
  }

  getRawClient(): any {
    return this.supabaseClient;
  }
}
