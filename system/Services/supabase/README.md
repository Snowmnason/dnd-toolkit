# Supabase Services

Supabase-specific implementations of service abstractions (DatabaseProvider, AuthProvider) and client infrastructure. Provides lazy-loaded Supabase client initialization, provider implementations, and service registration for the broader service layer architecture.

## When to Use This Module

**Use this module to:**
- Initialize Supabase client with platform-specific session handling
- Register SupabaseDatabaseProvider for database operations
- Register SupabaseAuthProvider for authentication operations
- Access Supabase client directly for edge functions (documented coupling)
- Configure Supabase-specific service initialization

**Do NOT use this module for:**
- Direct database queries (use `lib/database` entity files instead)
- Direct authentication operations (use `lib/auth` instead)
- App-specific business logic (belongs in domain modules)

## Architecture & Data Flow

```
Service Layer Request
        ↓
DatabaseProvider / AuthProvider Interface
        ↓
SupabaseDatabaseProvider / SupabaseAuthProvider Implementation
        ↓
Supabase Client (lazy-loaded, platform-aware)
        ↓
Supabase SDK (@supabase/supabase-js)
        ↓
PostgreSQL Database / Auth Service
```

**Key Principles:**
- **Lazy Loading**: Supabase client initialized only when needed (saves bundle size)
- **Platform Aware**: Session handling differs between web (no persistence) and mobile (encrypted storage)
- **Provider Pattern**: All Supabase operations go through provider interfaces
- **Service Registration**: Providers registered during kernel bootstrap
- **Edge Function Coupling**: Direct Supabase client access allowed for edge functions (documented)

## API Reference

### DatabaseProvider Interface

```typescript
interface DatabaseProvider {
  from(table: string, schema?: string): QueryBuilder;
  rpc(name: string, params?: any, schema?: string): Promise<QueryResult>;
  isConfigured(): boolean;
}
```

### SupabaseDatabaseProvider

```typescript
class SupabaseDatabaseProvider implements DatabaseProvider {
  constructor(client?: SupabaseClient);

  from(table: string, schema?: string): SupabaseQueryBuilder;
  rpc(name: string, params?: any, schema?: string): Promise<QueryResult>;
  isConfigured(): boolean;
}
```

### AuthProvider Interface

```typescript
interface AuthProvider {
  signUp(credentials: SignUpCredentials): Promise<AuthResult>;
  signIn(credentials: SignInCredentials): Promise<AuthResult>;
  signOut(): Promise<void>;
  getSession(): Promise<Session | null>;
  // ... additional methods
}
```

### SupabaseAuthProvider

```typescript
class SupabaseAuthProvider implements AuthProvider {
  constructor(client?: SupabaseClient);

  signUp(credentials: SignUpCredentials): Promise<AuthResult>;
  signIn(credentials: SignInCredentials): Promise<AuthResult>;
  signOut(): Promise<void>;
  getSession(): Promise<Session | null>;
  // ... implements full AuthProvider interface
}
```

### Client Infrastructure

```typescript
// Lazy-loaded client (saves bundle size)
const supabaseClient: SupabaseClient = await getSupabaseClient();

// Direct client access (for edge functions)
import { supabase } from '@/lib/services/supabase/supabase-client';
```

## Schema Handling

Supabase organizes data across multiple PostgreSQL schemas:

- **`public`** - User profiles, settings, basic app data
- **`worlds`** - World entities, access control, gameplay data
- **`feature_flags`** - Feature flags, entitlements, overrides

**Provider Usage:**
```typescript
// Schema specified as second parameter
const users = getDatabaseProvider().from('users', 'public');
const worlds = getDatabaseProvider().from('worlds', 'worlds');
const flags = getDatabaseProvider().from('feature_flags', 'feature_flags');
```

**Implementation Detail:**
- Default schema is `'public'` if not specified
- Supabase maps this to `.schema(schema).from(table)`
- Provider implementations handle schema routing internally

## Edge Function Escape Hatch

**Known Coupling:** Edge functions remain Supabase-specific and bypass the provider abstraction.

```typescript
// EDGE_FUNCTION: Direct Supabase client access required
// Cannot be abstracted due to Supabase-specific function signatures
import { supabase } from '@/lib/services/supabase/supabase-client';

const { data, error } = await supabase.functions.invoke('delete-account', {
  body: { userId }
});
```

**Why not abstracted:**
- Edge functions have Supabase-specific authentication and invocation patterns
- Function signatures are provider-specific
- Future abstraction possible but out-of-scope for current provider decoupling

## Adding a New Database Provider

**1. Implement DatabaseProvider Interface:**

```typescript
import { DatabaseProvider, QueryBuilder, QueryResult } from '@/lib/services';

export class PostgreSQLDatabaseProvider implements DatabaseProvider {
  constructor(private connectionString: string) {}

  from(table: string, schema?: string): QueryBuilder {
    // Return your QueryBuilder implementation
    return new PostgreSQLQueryBuilder(table, schema, this.connectionString);
  }

  rpc(name: string, params?: any, schema?: string): Promise<QueryResult> {
    // Implement stored procedure calls
    throw new Error('RPC not supported');
  }

  isConfigured(): boolean {
    return !!this.connectionString;
  }
}
```

**2. Implement QueryBuilder Interface:**

```typescript
export class PostgreSQLQueryBuilder implements QueryBuilder {
  constructor(
    private table: string,
    private schema: string,
    private connectionString: string
  ) {}

  select(columns?: string): this {
    // Build SELECT clause
    return this;
  }

  eq(column: string, value: any): this {
    // Add WHERE condition
    return this;
  }

  insert(data: any): this {
    // Build INSERT statement
    return this;
  }

  // ... implement all QueryBuilder methods

  async execute(): Promise<QueryResult> {
    // Execute query and return standardized result
    const result = await this.runQuery();
    return {
      data: result.rows,
      error: result.error ? new QueryError(result.error) : null
    };
  }
}
```

**3. Register Provider:**

```typescript
// In service initialization
import { registerDatabaseProvider } from '@/lib/services';

const pgProvider = new PostgreSQLDatabaseProvider(process.env.POSTGRES_URL);
registerDatabaseProvider(pgProvider);
```

**4. Handle Schema Mapping:**

```typescript
// PostgreSQL might use schema.table syntax instead of Supabase's .schema()
from(table: string, schema?: string): QueryBuilder {
  const fullTableName = schema ? `${schema}.${table}` : table;
  return new PostgreSQLQueryBuilder(fullTableName, this.connectionString);
}
```

## File Breakdown

| File | Purpose |
| ---- | ------- |
| `supabase-client.ts` | Lazy-loaded Supabase client with platform-specific session handling |
| `supabase-lazy.ts` | Lazy loading utilities and client caching |
| `supabase-database-provider.ts` | SupabaseDatabaseProvider implementation of DatabaseProvider interface |
| `supabase-auth-provider.ts` | SupabaseAuthProvider implementation of AuthProvider interface |
| `supabase-initializer.ts` | Service initialization and provider registration |

This module is designed to be **app-agnostic** — no dnd-toolkit specifics, enabling reuse in future projects with different Supabase configurations.