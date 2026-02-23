# Database Provider Abstraction: Usage Guide

This guide shows how to use the `DatabaseProvider` abstraction that enables swapping database backends (Supabase, PostgreSQL, Firebase) without changing application code.

## Querying with getDatabaseProvider()

**Import the database provider and use it directly:**

```typescript
import { getDatabaseProvider } from '@/lib/services';

// In any module that needs database operations
const db = getDatabaseProvider();

// All methods return QueryResult (never throw)
const result = await db.from('users', 'public')
  .select('id, email, username')
  .eq('id', userId)
  .single();
```

**Key Points:**
- `getDatabaseProvider()` always returns a provider (never null)
- If no provider is registered, returns `NoOpDatabaseProvider` (throws clear errors)
- All operations are async and return `QueryResult` objects
- Schema parameter routes queries to correct database schema

## Basic CRUD Operations

**Create a user:**

```typescript
import { getDatabaseProvider } from '@/lib/services';

const result = await getDatabaseProvider()
  .from('users', 'public')
  .insert({
    email: 'user@example.com',
    username: 'newuser',
    created_at: new Date().toISOString()
  })
  .select('id')
  .single();

if (result.error) {
  throw new Error(`Failed to create user: ${result.error.message}`);
}

const userId = result.data.id;
```

**Read user data:**

```typescript
const result = await getDatabaseProvider()
  .from('users', 'public')
  .select('id, email, username, created_at')
  .eq('id', userId)
  .single();

if (result.error) {
  console.error('User not found:', result.error.message);
  return null;
}

return result.data;
```

**Update user profile:**

```typescript
const result = await getDatabaseProvider()
  .from('users', 'public')
  .update({
    username: 'updateduser',
    updated_at: new Date().toISOString()
  })
  .eq('id', userId)
  .select('id, username')
  .single();

if (result.error) {
  throw new Error(`Failed to update user: ${result.error.message}`);
}
```

**Delete user:**

```typescript
const result = await getDatabaseProvider()
  .from('users', 'public')
  .delete()
  .eq('id', userId);

if (result.error) {
  throw new Error(`Failed to delete user: ${result.error.message}`);
}
```

## Schema Handling

Supabase organizes data across multiple PostgreSQL schemas. The provider abstraction handles schema routing:

**Public schema (user profiles, settings):**

```typescript
// User profiles and settings
const users = await getDatabaseProvider()
  .from('users', 'public')
  .select('*')
  .execute();

const settings = await getDatabaseProvider()
  .from('user_settings', 'public')
  .select('*')
  .eq('user_id', userId)
  .execute();
```

**Worlds schema (gameplay data):**

```typescript
// World entities and access control
const worlds = await getDatabaseProvider()
  .from('worlds', 'worlds')
  .select('id, name, description, owner_id')
  .eq('owner_id', userId)
  .execute();

const access = await getDatabaseProvider()
  .from('world_access', 'worlds')
  .select('*')
  .eq('world_id', worldId)
  .eq('user_id', userId)
  .single();
```

**Feature flags schema (entitlements, overrides):**

```typescript
// Feature flags and user entitlements
const flags = await getDatabaseProvider()
  .from('feature_flags', 'feature_flags')
  .select('flag_name, enabled')
  .execute();

const entitlements = await getDatabaseProvider()
  .from('entitlements', 'feature_flags')
  .select('*')
  .eq('user_id', userId)
  .eq('key', 'premium')
  .execute();
```

**Schema Mapping:**
- `'public'` - User accounts, settings, basic app data
- `'worlds'` - World entities, characters, gameplay data
- `'feature_flags'` - Feature flags, entitlements, overrides

## Stored Procedure (RPC) Calls

**Call database functions and stored procedures:**

```typescript
// Join world with invite (stored procedure)
const result = await getDatabaseProvider()
  .rpc('join_world_with_invite', {
    invite_code: 'ABC123',
    user_id: userId
  }, 'worlds');

if (result.error) {
  throw new Error(`Failed to join world: ${result.error.message}`);
}

// Leave world (stored procedure)
const leaveResult = await getDatabaseProvider()
  .rpc('leave_world', {
    world_id: worldId,
    user_id: userId
  }, 'worlds');

if (leaveResult.error) {
  console.error('Failed to leave world:', leaveResult.error.message);
}
```

**RPC Best Practices:**
- Include schema parameter for multi-schema databases
- Handle both successful results and errors
- RPC functions may have provider-specific behavior
- Document any Supabase-specific stored procedures

## Edge Function Pattern (Supabase Coupling)

**Known Coupling:** Edge functions remain Supabase-specific and bypass the provider abstraction.

```typescript
// EDGE_FUNCTION: Direct Supabase client access required
// Cannot be abstracted due to Supabase-specific authentication and invocation
import { supabase } from '@/lib/services/supabase/supabase-client';

const { data, error } = await supabase.functions.invoke('delete-account', {
  body: { userId, confirmation: 'DELETE_MY_ACCOUNT' }
});

if (error) {
  throw new Error(`Account deletion failed: ${error.message}`);
}
```

**When to use edge functions:**
- Complex business logic that needs database transactions
- File processing or external API integrations
- Operations requiring Supabase-specific authentication
- Real-time subscriptions or webhooks

**Migration Path:**
```typescript
// Current: Direct Supabase call
const supabase = getDatabaseProvider() as SupabaseDatabaseProvider;
await supabase.client.functions.invoke('complex-operation', params);

// Future: Abstracted edge function client (out of scope)
const edgeClient = getEdgeFunctionClient();
await edgeClient.invoke('complex-operation', params);
```

## Adding a New Database Provider

**1. Implement DatabaseProvider Interface:**

```typescript
import { DatabaseProvider, QueryBuilder, QueryResult, QueryError } from '@/lib/services';

export class PostgreSQLDatabaseProvider implements DatabaseProvider {
  constructor(private connectionString: string) {}

  from(table: string, schema?: string): QueryBuilder {
    const fullTableName = schema ? `${schema}.${table}` : table;
    return new PostgreSQLQueryBuilder(fullTableName, this.connectionString);
  }

  async rpc(name: string, params?: any, schema?: string): Promise<QueryResult> {
    try {
      // Implement stored procedure call
      const result = await this.callStoredProcedure(name, params, schema);
      return { data: result.rows, error: null };
    } catch (error) {
      return {
        data: null,
        error: new QueryError(error.message, error.code, 'rpc_error')
      };
    }
  }

  isConfigured(): boolean {
    return !!this.connectionString;
  }
}
```

**2. Implement QueryBuilder for Fluent API:**

```typescript
export class PostgreSQLQueryBuilder implements QueryBuilder {
  private query: string = '';
  private params: any[] = [];

  constructor(private table: string, private connectionString: string) {}

  select(columns: string = '*'): this {
    this.query = `SELECT ${columns} FROM ${this.table}`;
    return this;
  }

  insert(data: any): this {
    const columns = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map((_, i) => `$${i + 1}`).join(', ');
    this.params = Object.values(data);

    this.query = `INSERT INTO ${this.table} (${columns}) VALUES (${placeholders})`;
    return this;
  }

  update(data: any): this {
    const setClause = Object.keys(data)
      .map((key, i) => `${key} = $${i + 1}`)
      .join(', ');
    this.params = Object.values(data);

    this.query = `UPDATE ${this.table} SET ${setClause}`;
    return this;
  }

  delete(): this {
    this.query = `DELETE FROM ${this.table}`;
    return this;
  }

  eq(column: string, value: any): this {
    const paramIndex = this.params.length + 1;
    this.params.push(value);
    this.query += ` WHERE ${column} = $${paramIndex}`;
    return this;
  }

  async execute(): Promise<QueryResult> {
    try {
      const result = await this.runQuery(this.query, this.params);
      return { data: result.rows, error: null };
    } catch (error) {
      return {
        data: null,
        error: new QueryError(error.message, error.code, 'query_error')
      };
    }
  }

  async single(): Promise<QueryResult> {
    const result = await this.execute();
    if (result.data && result.data.length > 0) {
      return { data: result.data[0], error: null };
    }
    return { data: null, error: new QueryError('No rows found', 'PGRST116', 'not_found') };
  }

  async maybeSingle(): Promise<QueryResult> {
    const result = await this.execute();
    if (result.data && result.data.length > 0) {
      return { data: result.data[0], error: null };
    }
    return { data: null, error: null };
  }
}
```

**3. Register the Provider:**

```typescript
// In service initialization
import { registerDatabaseProvider } from '@/lib/services';

const pgProvider = new PostgreSQLDatabaseProvider(process.env.POSTGRES_URL);
registerDatabaseProvider(pgProvider);
```

**4. Handle Firebase Implementation:**

```typescript
export class FirebaseDatabaseProvider implements DatabaseProvider {
  constructor(private firestore: FirebaseFirestore) {}

  from(table: string, schema?: string): QueryBuilder {
    // Firebase doesn't have schemas, map to collections
    return new FirebaseQueryBuilder(this.firestore.collection(table));
  }

  async rpc(name: string, params?: any, schema?: string): Promise<QueryResult> {
    // Firebase doesn't have stored procedures
    // Implement as callable functions or client-side logic
    throw new Error('RPC not supported in Firebase');
  }

  isConfigured(): boolean {
    return !!this.firestore;
  }
}
```

## Debugging Database Queries

**Enable query logging in development:**

```typescript
// Queries are automatically logged via RequestManager
// Check console for database operation logs (category: 'storage')

// Example log output:
[storage] SELECT id, email FROM users WHERE id = $1
[storage] Parameters: ["user-123"]
[storage] Execution time: 45ms
[storage] Result: 1 row(s)
```

**Inspect QueryResult objects:**

```typescript
const result = await getDatabaseProvider()
  .from('users', 'public')
  .select('*')
  .eq('id', userId)
  .single();

if (result.error) {
  console.error('Query failed:', {
    message: result.error.message,
    code: result.error.code,
    details: result.error.details,
    hint: result.error.hint
  });
} else {
  console.log('Query succeeded:', result.data);
}
```

**Debug provider configuration:**

```typescript
import { getDatabaseProvider } from '@/lib/services';

const provider = getDatabaseProvider();
console.log('Provider configured:', provider.isConfigured());
console.log('Provider type:', provider.constructor.name);

// Test basic connectivity
try {
  const testResult = await provider.from('users', 'public')
    .select('count(*)')
    .execute();
  console.log('Database connection OK');
} catch (error) {
  console.error('Database connection failed:', error);
}
```

**Common debugging scenarios:**

```typescript
// 1. Query returns no results
const result = await getDatabaseProvider()
  .from('users', 'public')
  .select('*')
  .eq('id', userId)
  .single();

if (!result.data && !result.error) {
  console.log('No user found with ID:', userId);
}

// 2. Permission denied (RLS)
if (result.error?.code === 'PGRST301') {
  console.error('RLS policy violation - check user permissions');
}

// 3. Schema routing issues
const worldsResult = await getDatabaseProvider()
  .from('worlds', 'worlds') // Ensure correct schema
  .select('*')
  .execute();

console.log('Worlds in correct schema:', worldsResult.data?.length || 0);
```

**Performance monitoring:**

```typescript
// Queries automatically integrate with RequestManager timing
// Check for slow queries in logs:
// [storage] Slow query detected: 2500ms for SELECT * FROM worlds

// Add explicit timing for critical operations
const startTime = Date.now();

const result = await getDatabaseProvider()
  .from('worlds', 'worlds')
  .select('*')
  .execute();

const duration = Date.now() - startTime;
if (duration > 1000) {
  console.warn(`Slow worlds query: ${duration}ms`);
}
```

This abstraction enables swapping database backends in 1-2 days without touching application code, as demonstrated by the PostgreSQL and Firebase examples above.