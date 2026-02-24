# Repository Patterns Guide

**Issue:** #261-Lite  
**Context:** Semantic Repository Pattern & True Database Abstraction

## Overview

The repository pattern abstracts data access behind semantic interfaces, allowing the same application code to work with different database backends (SQL, NoSQL, REST APIs, etc.). This guide explains the patterns used in this implementation.

## Core Principles

### 1. Semantic Interfaces, Not SQL
```typescript
// ❌ Bad: Leaks SQL semantics
const users = await db.from('users').select('*').eq('role', 'admin');

// ✅ Good: Business intent
const admins = await getUserRepository().findByRole('admin');
```

### 2. Backend Agnosticism
```typescript
// Same interface works with any backend
interface UserRepository {
  getById(id: string): Promise<User>;
  create(data: CreateUserData): Promise<User>;
  update(id: string, data: UpdateUserData): Promise<User>;
}

// Supabase implementation
class SupabaseUserRepository implements UserRepository {
  async getById(id: string) {
    return await getDatabaseProvider().from('users').select('*').eq('id', id).single();
  }
  // ...
}

// Firebase implementation (future)
class FirebaseUserRepository implements UserRepository {
  async getById(id: string) {
    return await firestore.collection('users').doc(id).get();
  }
  // ...
}
```

### 3. Registry-Based Discovery
```typescript
// Register implementations at startup
registerRepository('user', new SupabaseUserRepository());

// Discover at runtime
const userRepo = getUserRepository(); // Returns registered implementation
```

## Repository Interface Patterns

### CRUD Operations
```typescript
interface BaseRepository<T, CreateData, UpdateData> {
  // Create
  create(data: CreateData): Promise<T>;

  // Read
  getById(id: string): Promise<T>;
  findAll(): Promise<T[]>;
  exists(id: string): Promise<boolean>;

  // Update
  update(id: string, data: UpdateData): Promise<T>;

  // Delete
  delete(id: string): Promise<void>;
}
```

### Query Operations
```typescript
interface UserRepository extends BaseRepository<User, CreateUserData, UpdateUserData> {
  // Business-specific queries
  getByAuthId(authId: string): Promise<User>;
  getByEmail(email: string): Promise<User>;
  findByRole(role: UserRole): Promise<User[]>;
  search(query: string): Promise<User[]>;
}
```

### Relationship Operations
```typescript
interface WorldRepository extends BaseRepository<World, CreateWorldData, UpdateWorldData> {
  // Access control
  getAccessibleWorlds(userId: string): Promise<WorldWithAccess[]>;
  getOwnedWorlds(userId: string): Promise<World[]>;

  // Membership
  addMember(worldId: string, userId: string, role: AccessRole): Promise<WorldAccess>;
  removeMember(worldId: string, userId: string): Promise<void>;
  updateMemberRole(worldId: string, userId: string, role: AccessRole): Promise<WorldAccess>;
}
```

## Implementation Patterns

### Supabase Repository Pattern
```typescript
class SupabaseUserRepository implements UserRepository {
  async getByAuthId(authId: string): Promise<User> {
    const result = await getDatabaseProvider()
      .from('users')
      .select('*')
      .eq('auth_id', authId)
      .single();

    if (result.error) throw new DatabaseError(result.error);
    return result.data;
  }

  async create(data: CreateUserData): Promise<User> {
    // Validate user exists first
    await validateUserForWrite();

    const result = await getDatabaseProvider()
      .from('users')
      .insert({
        auth_id: data.authId,
        username: data.username,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (result.error) throw new DatabaseError(result.error);
    return result.data;
  }
}
```

### Error Handling Pattern
```typescript
class SupabaseUserRepository implements UserRepository {
  async getById(id: string): Promise<User> {
    try {
      const result = await getDatabaseProvider()
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

      if (result.error) {
        if (result.error.code === 'PGRST116') {
          throw new NotFoundError(`User ${id} not found`);
        }
        throw new DatabaseError(result.error);
      }

      return result.data;
    } catch (error) {
      logger.error('UserRepository.getById failed', { id, error });
      throw error;
    }
  }
}
```

### Caching Pattern
```typescript
class SupabaseUserRepository implements UserRepository {
  async getById(id: string): Promise<User> {
    // Check cache first
    const cached = await QueryCache.get(`user:${id}`);
    if (cached) return cached;

    // Fetch from database
    const user = await this.fetchById(id);

    // Cache result
    await QueryCache.set(`user:${id}`, user, { ttl: 4 * 60 * 60 * 1000 }); // 4 hours

    return user;
  }

  async update(id: string, data: UpdateUserData): Promise<User> {
    const user = await this.updateInDatabase(id, data);

    // Invalidate related caches
    await QueryCache.invalidateTags(['user', `user:${id}`]);

    return user;
  }
}
```

## Registry Pattern

### Repository Registry
```typescript
// lib/database/repositories/types.ts
export interface RepositoryRegistry {
  user: UserRepository;
  world: WorldRepository;
  worldAccess: WorldAccessRepository;
  invite: InviteRepository;
  userSettings: UserSettingsRepository;
  featureFlags: FeatureFlagsRepository;
  entitlements: EntitlementsRepository;
}

// lib/database/repositories/index.ts
let repositories: Partial<RepositoryRegistry> = {};

export function registerRepository<K extends keyof RepositoryRegistry>(
  name: K,
  repository: RepositoryRegistry[K]
): void {
  repositories[name] = repository;
  logger.info('Repository registered', { name });
}

export function getUserRepository(): UserRepository {
  const repo = repositories.user;
  if (!repo) throw new Error('UserRepository not registered');
  return repo;
}
// ... similar for other repositories
```

### Usage in Application Code
```typescript
// In service initialization
registerRepository('user', new SupabaseUserRepository());
registerRepository('world', new SupabaseWorldRepository());

// In application code
const user = await getUserRepository().getById(userId);
const worlds = await getWorldRepository().getAccessibleWorlds(userId);
```

## Testing Patterns

### Mock Repository Pattern
```typescript
// lib/database/repositories/__mocks__/MockUserRepository.ts
export class MockUserRepository implements UserRepository {
  private users: Map<string, User> = new Map();

  async getById(id: string): Promise<User> {
    const user = this.users.get(id);
    if (!user) throw new NotFoundError(`User ${id} not found`);
    return user;
  }

  async create(data: CreateUserData): Promise<User> {
    const user: User = {
      id: 'mock-id',
      authId: data.authId,
      username: data.username,
      createdAt: new Date(),
    };
    this.users.set(user.id, user);
    return user;
  }
  // ... implement all methods
}
```

### Test Setup Pattern
```typescript
// In test setup
beforeEach(() => {
  clearRepositoryRegistry();
  registerRepository('user', new MockUserRepository());
  registerRepository('world', new MockWorldRepository());
});

afterEach(() => {
  clearRepositoryRegistry();
});

// In tests
it('should create user profile', async () => {
  const user = await getUserRepository().create({
    authId: 'auth-123',
    username: 'testuser'
  });

  expect(user.username).toBe('testuser');
});
```

## Migration Patterns

### From Direct Provider Calls
```typescript
// Before: Direct database calls
export async function getUserByAuthId(authId: string) {
  const result = await getDatabaseProvider()
    .from('users')
    .select('*')
    .eq('auth_id', authId)
    .single();

  return result.data;
}

// After: Repository pattern
export async function getUserByAuthId(authId: string) {
  return await getUserRepository().getByAuthId(authId);
}
```

### From RPC Calls
```typescript
// Before: Direct RPC calls
export async function createInvite(worldId: string) {
  const result = await supabase.rpc('create_invite_link', {
    world_id: worldId
  });
  return result.data;
}

// After: Edge function abstraction
export async function createInvite(worldId: string) {
  return await executeEdgeFunction('createInviteLink', { worldId });
}
```

## Performance Patterns

### Parallel Queries
```typescript
// Execute independent queries in parallel
export async function getUserDashboard(userId: string) {
  const [user, worlds, invites] = await executeParallelQueries([
    getUserRepository().getById(userId),
    getWorldRepository().getAccessibleWorlds(userId),
    getInviteRepository().getPendingInvites(userId),
  ]);

  return { user, worlds, invites };
}
```

### Batch Operations
```typescript
// Batch create multiple entities
export async function createWorldWithMembers(
  worldData: CreateWorldData,
  memberIds: string[]
): Promise<World> {
  const world = await getWorldRepository().create(worldData);

  // Batch add members
  await Promise.all(
    memberIds.map(memberId =>
      getWorldRepository().addMember(world.id, memberId, 'player')
    )
  );

  return world;
}
```

## Error Patterns

### Custom Error Types
```typescript
export class NotFoundError extends Error {
  constructor(resource: string, id: string) {
    super(`${resource} ${id} not found`);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends Error {
  constructor(field: string, value: any, reason: string) {
    super(`Invalid ${field}: ${value} - ${reason}`);
    this.name = 'ValidationError';
  }
}

export class PermissionError extends Error {
  constructor(action: string, resource: string) {
    super(`Permission denied: ${action} on ${resource}`);
    this.name = 'PermissionError';
  }
}
```

### Error Mapping
```typescript
function mapSupabaseError(error: any): Error {
  switch (error.code) {
    case 'PGRST116': // Not found
      return new NotFoundError('Resource', 'unknown');
    case '23505': // Unique violation
      return new ValidationError('field', 'value', 'already exists');
    case '42501': // RLS violation
      return new PermissionError('access', 'resource');
    default:
      return new DatabaseError(error);
  }
}
```

## Advanced Patterns

### Repository Composition
```typescript
class WorldService {
  constructor(
    private worldRepo: WorldRepository,
    private accessRepo: WorldAccessRepository,
    private inviteRepo: InviteRepository
  ) {}

  async createWorldWithInvite(
    worldData: CreateWorldData,
    inviteData: CreateInviteData
  ): Promise<{ world: World; invite: Invite }> {
    const world = await this.worldRepo.create(worldData);
    const invite = await this.inviteRepo.create({
      ...inviteData,
      worldId: world.id
    });

    return { world, invite };
  }
}
```

### Lazy Loading
```typescript
class WorldWithLazyMembers {
  constructor(private world: World, private accessRepo: WorldAccessRepository) {}

  private _members?: WorldMember[];

  async getMembers(): Promise<WorldMember[]> {
    if (!this._members) {
      this._members = await this.accessRepo.getMembers(this.world.id);
    }
    return this._members;
  }
}
```

### Event-Driven Updates
```typescript
class UserRepositoryWithEvents implements UserRepository {
  private listeners: Set<(user: User) => void> = new Set();

  onUserUpdated(listener: (user: User) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async update(id: string, data: UpdateUserData): Promise<User> {
    const user = await this.updateInDatabase(id, data);

    // Notify listeners
    this.listeners.forEach(listener => listener(user));

    return user;
  }
}
```

This repository pattern provides a solid foundation for multi-database support while maintaining clean, testable, and maintainable code.</content>
<parameter name="filePath">p:\CodingProjects\dnd-toolkit\docs\issues\MileStone 2\261 - Semantic Repository Pattern & True Database Abstraction\REPOSITORY_PATTERNS.md