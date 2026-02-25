# Multi-Backend Support Guide

**Issue:** #261-Lite  
**Context:** Semantic Repository Pattern & True Database Abstraction

## Overview

This implementation enables true multi-database support by abstracting not just the database provider (swap Supabase for PostgreSQL), but the entire query paradigm (swap SQL for NoSQL, REST APIs, etc.). The same application code can work with different backends without changes.

## Architecture Overview

### Provider Abstraction vs Multi-Backend Support

| Aspect | Provider Abstraction (#255) | Multi-Backend Support (#261) |
|--------|----------------------------|------------------------------|
| **Scope** | Database client only | Query language + data model |
| **Example** | Supabase → PostgreSQL | PostgreSQL → MongoDB |
| **Code Changes** | None (same SQL) | Repository reimplementation |
| **Flexibility** | Limited to SQL databases | Any data storage paradigm |

### Registry-Based Backend Switching

```typescript
// Same application code works with any backend
const user = await getUserRepository().getByAuthId(authId);
const worlds = await getWorldRepository().getAccessibleWorlds(userId);

// Switch backends by changing registration
if (process.env.DATABASE_BACKEND === 'supabase') {
  registerRepository('user', new SupabaseUserRepository());
  registerRepository('world', new SupabaseWorldRepository());
} else if (process.env.DATABASE_BACKEND === 'firebase') {
  registerRepository('user', new FirebaseUserRepository());
  registerRepository('world', new FirebaseWorldRepository());
}
```

## Supported Backend Types

### 1. SQL Databases (PostgreSQL, MySQL, SQLite)

**Pattern:** Use query builders or ORMs
```typescript
class PostgreSQLUserRepository implements UserRepository {
  async getByAuthId(authId: string): Promise<User> {
    const result = await this.pool.query(
      'SELECT * FROM users WHERE auth_id = $1',
      [authId]
    );
    return result.rows[0];
  }
}
```

**Existing Implementation:** Supabase repositories use this pattern with PostgREST.

### 2. NoSQL Databases (MongoDB, DynamoDB, Firestore)

**Pattern:** Document-based queries
```typescript
class MongoUserRepository implements UserRepository {
  async getByAuthId(authId: string): Promise<User> {
    return await this.collection.findOne({ authId });
  }
}

class FirestoreUserRepository implements UserRepository {
  async getByAuthId(authId: string): Promise<User> {
    const doc = await this.collection.doc(authId).get();
    return doc.data();
  }
}
```

### 3. REST APIs

**Pattern:** HTTP requests with caching
```typescript
class RestUserRepository implements UserRepository {
  async getByAuthId(authId: string): Promise<User> {
    const response = await fetch(`${this.baseUrl}/users/auth/${authId}`);
    return response.json();
  }
}
```

### 4. GraphQL APIs

**Pattern:** Query construction
```typescript
class GraphQLUserRepository implements UserRepository {
  async getByAuthId(authId: string): Promise<User> {
    const query = `
      query GetUser($authId: String!) {
        user(authId: $authId) {
          id username email
        }
      }
    `;
    const result = await this.client.request(query, { authId });
    return result.user;
  }
}
```

### 5. In-Memory (Testing/Mock)

**Pattern:** Simple data structures
```typescript
class InMemoryUserRepository implements UserRepository {
  private users = new Map<string, User>();

  async getByAuthId(authId: string): Promise<User> {
    for (const user of this.users.values()) {
      if (user.authId === authId) return user;
    }
    throw new NotFoundError('User', authId);
  }
}
```

## Implementation Examples

### Firebase Firestore Backend

```typescript
// lib/database/repositories/FirebaseUserRepository.ts
import { Firestore } from 'firebase/firestore';

export class FirebaseUserRepository implements UserRepository {
  constructor(private firestore: Firestore) {}

  async getByAuthId(authId: string): Promise<User> {
    const usersRef = collection(this.firestore, 'users');
    const q = query(usersRef, where('authId', '==', authId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      throw new NotFoundError('User', authId);
    }

    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data(),
    } as User;
  }

  async create(data: CreateUserData): Promise<User> {
    const usersRef = collection(this.firestore, 'users');
    const docRef = await addDoc(usersRef, {
      ...data,
      createdAt: new Date(),
    });

    return {
      id: docRef.id,
      ...data,
      createdAt: new Date(),
    };
  }
}
```

### REST API Backend

```typescript
// lib/database/repositories/RestUserRepository.ts
export class RestUserRepository implements UserRepository {
  constructor(private baseUrl: string, private apiKey: string) {}

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    return response.json();
  }

  async getByAuthId(authId: string): Promise<User> {
    return this.request<User>(`/users/auth/${authId}`);
  }

  async create(data: CreateUserData): Promise<User> {
    return this.request<User>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}
```

### MongoDB Backend

```typescript
// lib/database/repositories/MongoUserRepository.ts
import { MongoClient, Collection } from 'mongodb';

export class MongoUserRepository implements UserRepository {
  constructor(private collection: Collection<User>) {}

  async getByAuthId(authId: string): Promise<User> {
    const user = await this.collection.findOne({ authId });
    if (!user) {
      throw new NotFoundError('User', authId);
    }
    return user;
  }

  async create(data: CreateUserData): Promise<User> {
    const user: User = {
      ...data,
      id: new ObjectId().toString(),
      createdAt: new Date(),
    };

    await this.collection.insertOne(user);
    return user;
  }
}
```

## Backend Registration Patterns

### Environment-Based Switching

```typescript
// lib/database/repositories/index.ts
export function initializeRepositories() {
  const backend = process.env.DATABASE_BACKEND || 'supabase';

  switch (backend) {
    case 'supabase':
      registerSupabaseRepositories();
      break;
    case 'firebase':
      registerFirebaseRepositories();
      break;
    case 'mongodb':
      registerMongoRepositories();
      break;
    case 'rest':
      registerRestRepositories();
      break;
    default:
      throw new Error(`Unknown database backend: ${backend}`);
  }
}

function registerSupabaseRepositories() {
  registerRepository('user', new SupabaseUserRepository());
  registerRepository('world', new SupabaseWorldRepository());
  // ... register all repositories
}
```

### Runtime Switching (Advanced)

```typescript
// For A/B testing or gradual migration
export async function switchBackend(newBackend: string) {
  // Unregister current repositories
  clearRepositoryRegistry();

  // Register new backend
  switch (newBackend) {
    case 'supabase':
      await registerSupabaseRepositories();
      break;
    case 'firebase':
      await registerFirebaseRepositories();
      break;
  }

  // Notify application of backend switch
  emitBackendSwitchedEvent(newBackend);
}
```

## Data Model Translation

### Schema Differences Handling

Different backends may have different data models:

```typescript
// Supabase (SQL) - flat tables
interface SupabaseUser {
  id: string;
  auth_id: string;
  username: string;
  created_at: string;
}

// MongoDB - nested documents
interface MongoUser {
  _id: ObjectId;
  authId: string;
  username: string;
  profile: {
    createdAt: Date;
    settings: UserSettings;
  };
}

// Repository handles translation
class MongoUserRepository implements UserRepository {
  async getByAuthId(authId: string): Promise<User> {
    const mongoUser = await this.collection.findOne({ authId });

    // Translate to canonical User interface
    return {
      id: mongoUser._id.toString(),
      authId: mongoUser.authId,
      username: mongoUser.username,
      createdAt: mongoUser.profile.createdAt,
    };
  }
}
```

## Migration Strategies

### Gradual Migration

```typescript
// Start with feature flags
const useNewBackend = await getFeatureFlagsRepository().isEnabled('new_database_backend');

if (useNewBackend) {
  registerRepository('user', new FirebaseUserRepository());
} else {
  registerRepository('user', new SupabaseUserRepository());
}
```

### Dual Writes

```typescript
class DualWriteUserRepository implements UserRepository {
  constructor(
    private primary: UserRepository,
    private secondary: UserRepository
  ) {}

  async create(data: CreateUserData): Promise<User> {
    // Write to new backend
    const user = await this.primary.create(data);

    try {
      // Also write to old backend (async, don't wait)
      this.secondary.create(data).catch(error => {
        logger.category('storage').warn('Dual write to secondary failed', { error });
      });
    } catch (error) {
      // Ignore secondary write failures
    }

    return user;
  }
}
```

## Testing Multi-Backend Support

### Backend Compatibility Tests

```typescript
// __tests__/integration/multi-backend.test.ts
describe('Multi-Backend Compatibility', () => {
  const backends = ['supabase', 'firebase', 'mongodb', 'rest'];

  backends.forEach(backend => {
    describe(`${backend} backend`, () => {
      beforeEach(() => {
        setupTestBackend(backend);
      });

      it('should create and retrieve user', async () => {
        const user = await getUserRepository().create({
          authId: 'test-auth-id',
          username: 'testuser',
        });

        const retrieved = await getUserRepository().getById(user.id);
        expect(retrieved.username).toBe('testuser');
      });

      it('should handle world access control', async () => {
        // Test world creation, access granting, etc.
      });
    });
  });
});
```

### Performance Benchmarks

```typescript
// __tests__/performance/backend-performance.test.ts
describe('Backend Performance', () => {
  it('should compare query performance across backends', async () => {
    const results = await runPerformanceTest({
      backends: ['supabase', 'firebase', 'mongodb'],
      operations: [
        { name: 'getUser', fn: () => getUserRepository().getById('test-id') },
        { name: 'createWorld', fn: () => getWorldRepository().create(testWorldData) },
      ],
      iterations: 100,
    });

    // Log performance comparison
    console.table(results);
  });
});
```

## Configuration Patterns

### Backend Configuration

```typescript
// config/database.ts
export interface DatabaseConfig {
  backend: 'supabase' | 'firebase' | 'mongodb' | 'rest';
  supabase?: {
    url: string;
    key: string;
  };
  firebase?: {
    config: FirebaseConfig;
  };
  mongodb?: {
    uri: string;
    database: string;
  };
  rest?: {
    baseUrl: string;
    apiKey: string;
  };
}

export function createRepositories(config: DatabaseConfig) {
  switch (config.backend) {
    case 'supabase':
      return createSupabaseRepositories(config.supabase);
    case 'firebase':
      return createFirebaseRepositories(config.firebase);
    case 'mongodb':
      return createMongoRepositories(config.mongodb);
    case 'rest':
      return createRestRepositories(config.rest);
  }
}
```

### Environment Variables

```bash
# Backend selection
DATABASE_BACKEND=supabase

# Supabase config
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx

# Firebase config
FIREBASE_API_KEY=xxx
FIREBASE_PROJECT_ID=xxx

# MongoDB config
MONGODB_URI=mongodb://localhost:27017
MONGODB_DATABASE=dndtoolkit

# REST API config
API_BASE_URL=https://api.dndtoolkit.com
API_KEY=xxx
```

## Error Handling Across Backends

### Normalized Error Types

```typescript
// lib/database/errors.ts
export class DatabaseError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class ConnectionError extends DatabaseError {
  constructor(backend: string) {
    super(`Failed to connect to ${backend}`);
  }
}

export class NotFoundError extends DatabaseError {
  constructor(resource: string, id: string) {
    super(`${resource} ${id} not found`);
  }
}
```

### Backend-Specific Error Mapping

```typescript
function mapFirebaseError(error: any): DatabaseError {
  if (error.code === 'permission-denied') {
    return new PermissionError('access', 'resource');
  }
  if (error.code === 'not-found') {
    return new NotFoundError('Document', 'unknown');
  }
  return new DatabaseError(error.message, error);
}

function mapMongoError(error: any): DatabaseError {
  if (error.code === 11000) {
    return new ValidationError('field', 'value', 'already exists');
  }
  return new DatabaseError(error.message, error);
}
```

## Future Backend Additions

### Adding a New Backend

1. **Implement Repository Interfaces**
   ```typescript
   // lib/database/repositories/NewBackendUserRepository.ts
   export class NewBackendUserRepository implements UserRepository {
     // Implement all UserRepository methods
   }
   ```

2. **Create Registration Function**
   ```typescript
   // lib/database/repositories/index.ts
   function registerNewBackendRepositories() {
     registerRepository('user', new NewBackendUserRepository());
     // ... register all repositories
   }
   ```

3. **Add Configuration Support**
   ```typescript
   // config/database.ts
   export interface DatabaseConfig {
     backend: 'supabase' | 'firebase' | 'newbackend';
     newbackend?: {
       host: string;
       port: number;
     };
   }
   ```

4. **Update Initialization**
   ```typescript
   // lib/database/repositories/index.ts
   export function initializeRepositories(config: DatabaseConfig) {
     switch (config.backend) {
       case 'newbackend':
         registerNewBackendRepositories(config.newbackend);
         break;
       // ... other cases
     }
   }
   ```

This multi-backend architecture provides maximum flexibility for future database migrations, testing, and deployment scenarios.</content>
<parameter name="filePath">p:\CodingProjects\dnd-toolkit\docs\issues\MileStone 2\261 - Semantic Repository Pattern & True Database Abstraction\MULTI_BACKEND_SUPPORT.md