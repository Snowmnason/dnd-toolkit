# Database Provider Abstraction: Implementation Guide

This guide covers the technical implementation details of the `DatabaseProvider` abstraction, including interface design, provider implementations, and migration patterns.

## DatabaseProvider Interface

**Core interface definition:**

```typescript
export interface DatabaseProvider {
  /**
   * Create a query builder for the specified table and schema
   * @param table The table name to query
   * @param schema Optional schema name (defaults to 'public')
   * @returns A QueryBuilder instance for fluent query construction
   */
  from(table: string, schema?: string): QueryBuilder;

  /**
   * Execute a stored procedure or RPC function
   * @param name The function/procedure name
   * @param params Parameters to pass to the function
   * @param schema Optional schema name
   * @returns Promise resolving to QueryResult
   */
  rpc(name: string, params?: any, schema?: string): Promise<QueryResult>;

  /**
   * Check if this provider is configured and ready to handle queries
   * @returns true if provider can execute database operations
   */
  isConfigured(): boolean;
}
```

**QueryBuilder interface for fluent API:**

```typescript
export interface QueryBuilder {
  /**
   * Specify columns to select
   * @param columns Column names or '*' for all (default: '*')
   */
  select(columns?: string): this;

  /**
   * Add WHERE equality condition
   * @param column Column name
   * @param value Value to match
   */
  eq(column: string, value: any): this;

  /**
   * Add WHERE inequality condition
   * @param column Column name
   * @param value Value to not match
   */
  neq(column: string, value: any): this;

  /**
   * Add WHERE greater than condition
   * @param column Column name
   * @param value Minimum value
   */
  gt(column: string, value: any): this;

  /**
   * Add WHERE less than condition
   * @param column Column name
   * @param value Maximum value
   */
  lt(column: string, value: any): this;

  /**
   * Add WHERE IN condition
   * @param column Column name
   * @param values Array of values to match
   */
  in(column: string, values: any[]): this;

  /**
   * Add ORDER BY clause
   * @param column Column name
   * @param ascending Sort direction (default: true)
   */
  order(column: string, ascending?: boolean): this;

  /**
   * Add LIMIT clause
   * @param count Maximum number of rows to return
   */
  limit(count: number): this;

  /**
   * Add OFFSET clause
   * @param count Number of rows to skip
   */
  offset(count: number): this;

  /**
   * Specify data for INSERT operation
   * @param data Object with column-value pairs
   */
  insert(data: any): this;

  /**
   * Specify data for UPDATE operation
   * @param data Object with column-value pairs
   */
  update(data: any): this;

  /**
   * Mark as DELETE operation
   */
  delete(): this;

  /**
   * Execute query and return multiple rows
   * @returns Promise resolving to QueryResult with data array
   */
  execute(): Promise<QueryResult>;

  /**
   * Execute query expecting exactly one row
   * @returns Promise resolving to QueryResult with single data object
   */
  single(): Promise<QueryResult>;

  /**
   * Execute query expecting zero or one row
   * @returns Promise resolving to QueryResult with single data object or null
   */
  maybeSingle(): Promise<QueryResult>;
}
```

**QueryResult and supporting types:**

```typescript
export interface QueryResult {
  data: any | any[] | null;
  error: QueryError | null;
}

export class QueryError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any,
    public hint?: string
  ) {
    super(message);
    this.name = 'QueryError';
  }
}
```

## Provider Registration and Initialization

**Singleton pattern with lazy initialization:**

```typescript
// lib/services/database-adapter.ts
let currentProvider: DatabaseProvider | null = null;

/**
 * Register the database provider implementation
 * Should be called once during app initialization
 */
export function registerDatabaseProvider(provider: DatabaseProvider): void {
  currentProvider = provider;
}

/**
 * Get the current database provider (always returns a provider)
 * Falls back to NoOpDatabaseProvider if none registered
 */
export function getDatabaseProvider(): DatabaseProvider {
  if (!currentProvider) {
    // Lazy initialization with warning in development
    if (__DEV__) {
      console.warn('No database provider registered, using NoOpDatabaseProvider');
    }
    currentProvider = new NoOpDatabaseProvider();
  }
  return currentProvider;
}
```

**NoOp fallback implementation:**

```typescript
export class NoOpDatabaseProvider implements DatabaseProvider {
  from(table: string, schema?: string): QueryBuilder {
    throw new Error(
      'Database not configured. Register a DatabaseProvider before making queries.'
    );
  }

  async rpc(name: string, params?: any, schema?: string): Promise<QueryResult> {
    throw new Error(
      'Database not configured. Register a DatabaseProvider before making queries.'
    );
  }

  isConfigured(): boolean {
    return false;
  }
}
```

## SupabaseDatabaseProvider Implementation

**Complete implementation wrapping Supabase SDK:**

```typescript
import { SupabaseClient } from '@supabase/supabase-js';
import { DatabaseProvider, QueryBuilder, QueryResult, QueryError } from './database-adapter';

export class SupabaseDatabaseProvider implements DatabaseProvider {
  constructor(private client?: SupabaseClient) {}

  from(table: string, schema: string = 'public'): QueryBuilder {
    const supabaseQuery = this.client.schema(schema).from(table);
    return new SupabaseQueryBuilder(supabaseQuery);
  }

  async rpc(name: string, params?: any, schema: string = 'public'): Promise<QueryResult> {
    try {
      const { data, error } = await this.client.schema(schema).rpc(name, params);

      if (error) {
        return {
          data: null,
          error: new QueryError(error.message, error.code, error.details, error.hint)
        };
      }

      return { data, error: null };
    } catch (error) {
      return {
        data: null,
        error: new QueryError(error.message, 'RPC_ERROR', error)
      };
    }
  }

  isConfigured(): boolean {
    return !!this.client;
  }
}
```

**SupabaseQueryBuilder implementation:**

```typescript
import { SupabaseClient } from '@supabase/supabase-js';

export class SupabaseQueryBuilder implements QueryBuilder {
  private query: any;

  constructor(private supabaseQuery: any) {
    this.query = supabaseQuery;
  }

  select(columns: string = '*'): this {
    this.query = this.query.select(columns);
    return this;
  }

  eq(column: string, value: any): this {
    this.query = this.query.eq(column, value);
    return this;
  }

  neq(column: string, value: any): this {
    this.query = this.query.neq(column, value);
    return this;
  }

  gt(column: string, value: any): this {
    this.query = this.query.gt(column, value);
    return this;
  }

  lt(column: string, value: any): this {
    this.query = this.query.lt(column, value);
    return this;
  }

  in(column: string, values: any[]): this {
    this.query = this.query.in(column, values);
    return this;
  }

  order(column: string, ascending: boolean = true): this {
    this.query = this.query.order(column, { ascending });
    return this;
  }

  limit(count: number): this {
    this.query = this.query.limit(count);
    return this;
  }

  offset(count: number): this {
    this.query = this.query.offset(count);
    return this;
  }

  insert(data: any): this {
    this.query = this.query.insert(data);
    return this;
  }

  update(data: any): this {
    this.query = this.query.update(data);
    return this;
  }

  delete(): this {
    this.query = this.query.delete();
    return this;
  }

  async execute(): Promise<QueryResult> {
    try {
      const { data, error } = await this.query;

      if (error) {
        return {
          data: null,
          error: new QueryError(error.message, error.code, error.details, error.hint)
        };
      }

      return { data, error: null };
    } catch (error) {
      return {
        data: null,
        error: new QueryError(error.message, 'EXECUTE_ERROR', error)
      };
    }
  }

  async single(): Promise<QueryResult> {
    try {
      const { data, error } = await this.query.single();

      if (error) {
        return {
          data: null,
          error: new QueryError(error.message, error.code, error.details, error.hint)
        };
      }

      return { data, error: null };
    } catch (error) {
      return {
        data: null,
        error: new QueryError(error.message, 'SINGLE_ERROR', error)
      };
    }
  }

  async maybeSingle(): Promise<QueryResult> {
    try {
      const { data, error } = await this.query.maybeSingle();

      if (error) {
        return {
          data: null,
          error: new QueryError(error.message, error.code, error.details, error.hint)
        };
      }

      return { data, error: null };
    } catch (error) {
      return {
        data: null,
        error: new QueryError(error.message, 'MAYBE_SINGLE_ERROR', error)
      };
    }
  }
}
```

## Service Initialization Pattern

**Supabase initializer following established patterns:**

```typescript
// lib/services/supabase/supabase-initializer.ts
import { SupabaseClient } from '@supabase/supabase-js';
import { registerDatabaseProvider } from '../database-adapter';
import { SupabaseDatabaseProvider } from './supabase-database-provider';

let _initialized = false;

/**
 * Initialize Supabase database provider
 * Idempotent - safe to call multiple times
 */
export async function initializeSupabaseDatabaseProvider(): Promise<boolean> {
  if (_initialized) {
    return true;
  }

  try {
    // Get or create Supabase client
    const client = await getSupabaseClient();

    if (!client) {
      console.warn('Supabase client not available, registering NoOp provider');
      registerDatabaseProvider(new NoOpDatabaseProvider());
      return false;
    }

    // Register Supabase provider
    const provider = new SupabaseDatabaseProvider(client);
    registerDatabaseProvider(provider);

    _initialized = true;
    return true;
  } catch (error) {
    console.error('Failed to initialize Supabase database provider:', error);
    registerDatabaseProvider(new NoOpDatabaseProvider());
    return false;
  }
}

/**
 * Reset initializer state (for testing)
 */
export function resetSupabaseInitializer(): void {
  _initialized = false;
}
```

**Integration with service initializer:**

```typescript
// lib/services/service-initializer.ts
export async function initializeServices(): Promise<void> {
  // Initialize database provider first (other services may depend on it)
  await initializeDatabaseProvider();

  // Then initialize other providers
  await initializeAuthProvider();
  await initializeErrorTracker();
}

async function initializeDatabaseProvider(): Promise<void> {
  // Check configuration for provider type
  const dbConfig = getAppConfig().services?.database;
  const providerType = dbConfig?.provider || 'supabase';

  switch (providerType) {
    case 'supabase':
      await initializeSupabaseDatabaseProvider();
      break;
    default:
      console.warn(`Unknown database provider: ${providerType}, using NoOp`);
      registerDatabaseProvider(new NoOpDatabaseProvider());
  }
}
```

## Migration Patterns

**Pattern 1: Direct Supabase Client Replacement**

**Before:**
```typescript
// lib/database/users.ts
import { supabase } from "./supabase";

export async function createUser(userData: UserInput): Promise<User> {
  const { data, error } = await supabase
    .schema('public')
    .from('users')
    .insert(userData)
    .select()
    .single();

  if (error) throw error;
  return data;
}
```

**After:**
```typescript
// lib/database/users.ts
import { getDatabaseProvider } from "@/lib/services";

export async function createUser(userData: UserInput): Promise<User> {
  const result = await getDatabaseProvider()
    .from('users', 'public')
    .insert(userData)
    .select()
    .single();

  if (result.error) throw result.error;
  return result.data;
}
```

**Pattern 2: Schema-Specific Queries**

**Before:**
```typescript
// lib/database/worlds.ts
import { supabase } from "../supabase";

export async function getWorldsForUser(userId: string): Promise<World[]> {
  const { data, error } = await supabase
    .schema('worlds')
    .from('worlds')
    .select('*')
    .eq('owner_id', userId);

  if (error) throw error;
  return data || [];
}
```

**After:**
```typescript
// lib/database/worlds.ts
import { getDatabaseProvider } from "@/lib/services";

export async function getWorldsForUser(userId: string): Promise<World[]> {
  const result = await getDatabaseProvider()
    .from('worlds', 'worlds')
    .select('*')
    .eq('owner_id', userId)
    .execute();

  if (result.error) throw result.error;
  return result.data || [];
}
```

**Pattern 3: Stored Procedure Calls**

**Before:**
```typescript
// lib/database/worlds.ts
import { supabase } from "../supabase";

export async function joinWorldWithInvite(inviteCode: string, userId: string): Promise<void> {
  const { error } = await supabase
    .schema('worlds')
    .rpc('join_world_with_invite', { invite_code: inviteCode, user_id: userId });

  if (error) throw error;
}
```

**After:**
```typescript
// lib/database/worlds.ts
import { getDatabaseProvider } from "@/lib/services";

export async function joinWorldWithInvite(inviteCode: string, userId: string): Promise<void> {
  const result = await getDatabaseProvider()
    .rpc('join_world_with_invite', { invite_code: inviteCode, user_id: userId }, 'worlds');

  if (result.error) throw result.error;
}
```

**Pattern 4: Auth Calls Migration**

**Before (with direct Supabase):**
```typescript
// lib/database/common.ts
import { supabase } from "./supabase";

export async function getCurrentAuthId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id || null;
}
```

**After (with AuthProvider - assumes #187 complete):**
```typescript
// lib/database/common.ts
import { getAuthProvider } from "@/lib/services";

export async function getCurrentAuthId(): Promise<string | null> {
  const session = await getAuthProvider().getSession();
  return session?.user?.id || null;
}
```

## Error Handling and Mapping

**Supabase error normalization:**

```typescript
// Error code mappings for consistent error handling
const ERROR_CODE_MAP = {
  'PGRST116': 'NOT_FOUND',        // No rows returned
  'PGRST301': 'INSUFFICIENT_PERMISSION', // RLS policy violation
  '23505': 'UNIQUE_VIOLATION',    // Unique constraint violation
  '23503': 'FOREIGN_KEY_VIOLATION', // Foreign key constraint violation
  '42P01': 'UNDEFINED_TABLE',     // Table doesn't exist
  '42703': 'UNDEFINED_COLUMN',    // Column doesn't exist
} as const;

function mapSupabaseError(error: any): QueryError {
  const mappedCode = ERROR_CODE_MAP[error.code] || error.code || 'UNKNOWN_ERROR';

  return new QueryError(
    error.message || 'Database operation failed',
    mappedCode,
    error.details,
    error.hint
  );
}
```

**Provider-specific error handling:**

```typescript
// In SupabaseQueryBuilder.execute()
async execute(): Promise<QueryResult> {
  try {
    const { data, error } = await this.query;

    if (error) {
      return {
        data: null,
        error: mapSupabaseError(error)
      };
    }

    return { data, error: null };
  } catch (unexpectedError) {
    // Handle network errors, connection issues, etc.
    return {
      data: null,
      error: new QueryError(
        'Database connection failed',
        'CONNECTION_ERROR',
        unexpectedError
      )
    };
  }
}
```

## Testing Patterns

**Mock provider for unit tests:**

```typescript
// __tests__/mocks/database-provider.ts
import { DatabaseProvider, QueryBuilder, QueryResult } from '@/lib/services';

export class MockDatabaseProvider implements DatabaseProvider {
  mockResults = new Map<string, QueryResult>();

  from(table: string, schema?: string): QueryBuilder {
    const key = `${schema || 'public'}.${table}`;
    return new MockQueryBuilder(this.mockResults.get(key));
  }

  async rpc(name: string, params?: any, schema?: string): Promise<QueryResult> {
    const key = `rpc:${schema || 'public'}.${name}`;
    return this.mockResults.get(key) || { data: null, error: null };
  }

  isConfigured(): boolean {
    return true;
  }

  setMockResult(key: string, result: QueryResult): void {
    this.mockResults.set(key, result);
  }
}

export class MockQueryBuilder implements QueryBuilder {
  constructor(private result?: QueryResult) {}

  select(): this { return this; }
  eq(): this { return this; }
  // ... implement all methods to return this

  async execute(): Promise<QueryResult> {
    return this.result || { data: [], error: null };
  }

  async single(): Promise<QueryResult> {
    return this.result || { data: null, error: null };
  }

  async maybeSingle(): Promise<QueryResult> {
    return this.result || { data: null, error: null };
  }
}
```

**Test setup and usage:**

```typescript
// __tests__/users.test.ts
import { registerDatabaseProvider } from '@/lib/services';
import { MockDatabaseProvider } from '../mocks/database-provider';

describe('usersDB', () => {
  let mockProvider: MockDatabaseProvider;

  beforeEach(() => {
    mockProvider = new MockDatabaseProvider();
    registerDatabaseProvider(mockProvider);
  });

  it('should create user successfully', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    mockProvider.setMockResult('public.users', {
      data: mockUser,
      error: null
    });

    const result = await usersDB.create({
      email: 'test@example.com',
      username: 'testuser'
    });

    expect(result).toEqual(mockUser);
  });
});
```

## Performance Considerations

**Connection pooling and reuse:**
- Supabase client is created once and reused across all operations
- Provider abstraction adds minimal overhead (one function call per query)
- Query builders are lightweight and don't hold state between operations

**Query optimization:**
- RequestManager handles deduplication automatically
- QueryCache provides result caching with invalidation
- Schema routing ensures queries hit correct indexes

**Memory management:**
- No persistent connections held open
- Query results are returned as plain objects
- Error objects are lightweight and serializable

**Async operation handling:**
- All operations return promises, never block
- Network timeouts are handled by RequestManager
- Circuit breaker pattern prevents cascade failures

## Schema Evolution and Compatibility

**Handling schema changes:**
```typescript
// Schema version detection
async function getSchemaVersion(): Promise<string> {
  const result = await getDatabaseProvider()
    .from('schema_version', 'public')
    .select('version')
    .single();

  return result.data?.version || '1.0.0';
}

// Conditional query building based on schema version
export async function getUsersWithVersionCheck(): Promise<User[]> {
  const version = await getSchemaVersion();

  if (version >= '2.0.0') {
    // New schema with additional fields
    return await getDatabaseProvider()
      .from('users', 'public')
      .select('id, email, username, created_at, last_login_at')
      .execute()
      .then(r => r.data || []);
  } else {
    // Legacy schema
    return await getDatabaseProvider()
      .from('users', 'public')
      .select('id, email, username, created_at')
      .execute()
      .then(r => r.data || []);
  }
}
```

**Provider-specific schema handling:**
```typescript
// PostgreSQL provider with schema versioning
export class PostgreSQLDatabaseProvider implements DatabaseProvider {
  constructor(private connectionString: string, private schemaVersion = '1.0.0') {}

  from(table: string, schema?: string): QueryBuilder {
    // Apply schema transformations based on version
    const transformedTable = this.transformTableForVersion(table, this.schemaVersion);
    return new PostgreSQLQueryBuilder(transformedTable, this.connectionString);
  }

  private transformTableForVersion(table: string, version: string): string {
    if (version >= '2.0.0' && table === 'users') {
      return 'user_accounts'; // Table renamed in v2
    }
    return table;
  }
}
```

This implementation enables reliable database backend swapping while maintaining type safety, error handling, and performance characteristics across different providers.