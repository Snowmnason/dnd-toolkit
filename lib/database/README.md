# Database Module

Type-safe database layer providing app-specific data operations for worlds, users, invites, and entitlements. Uses pluggable DatabaseProvider abstraction for backend flexibility, enforces Row-Level Security (RLS) for multi-tenant isolation, integrates with `lib/api` (RequestManager) for deduplication and retry, and `lib/cache` (QueryCache) for result persistence.

## When to Use This Module

**Use this module to:**

- Query and mutate dnd-toolkit game data (worlds, characters, invites, users)
- Maintain type-safe data models (User, World, WorldAccess) with compile-time safety
- Enforce RLS policies for multi-tenant security (users see only their data)
- Perform async database operations with proper error handling
- Integrate with cache invalidation on mutations

**Do NOT use this module for:**

- Authentication operations (use `lib/auth` instead)
- Direct database provider calls (always wrap in domain-specific functions)
- Circumventing RLS policies (never bypass auth; policies protect data integrity)
- Synchronous/blocking database calls (all operations are async)

## Architecture & Data Flow

```
Action (UI Component)
        ↓
Call Domain API (e.g., worldsDB.getById, usersDB.create)
        ↓
Validate User (getCurrentUserProfile, validateUserForWrite)
        ↓
RequestManager.fetch (dedupe, retry, integrate with QueryCache)
        ↓
DatabaseProvider.from() → QueryBuilder chain → execute()
        ↓
Provider Implementation (Supabase/PostgreSQL/Firebase)
        ↓
Database Call (RLS policies enforce access control)
        ↓
Handle Response & Update Cache (QueryCache invalidation on mutations)
        ↓
Return Result to UI
```

**Key Principles:**

- **Provider-Abstraction**: Database operations go through DatabaseProvider interface (backend-swappable)
- **RLS-Enforced**: All queries respect database RLS policies; no cross-user data leaks
- **Type-Safe**: All data models (User, World, WorldAccess) have TypeScript interfaces
- **Deduplified**: RequestManager prevents duplicate queries (same key = same result)
- **Cached**: QueryCache stores results; invalidated on CREATE/UPDATE/DELETE
- **Validated**: User validation before writes prevents orphaned data
- **Observable**: All operations logged (storage category) for debugging

## Database Schema

Organized into 4 schemas:

| Schema | Purpose |
| --- | --- |
| `public` | User accounts, profiles, settings |
| `worlds` | Campaign worlds, access control, invite links |
| `feature_flags` | Feature gates, entitlements, overrides, rollouts |
| `audit` | Audit trail (all database changes auto-logged via triggers) |

**Core Tables:**

| Table | Purpose |
| --- | --- |
| `public.users` | User profiles (created after auth signup) |
| `worlds.worlds` | D&D campaign worlds (owned by users) |
| `worlds.world_access` | User access to worlds (dm, gm, player, spectator, observer roles) |
| `worlds.invite_links` | Shareable world invitations (with expiry) |
| `feature_flags.feature_flags` | Global feature gates (enabled/disabled) |
| `feature_flags.entitlements` | User subscription tier and feature access |
| `feature_flags.entitlements_overrides` | Admin tool (grant/revoke entitlements) |

For complete schema documentation, see [docs/Important Notes/Database/SCHEMA.md](../../docs/Important Notes/Database/SCHEMA.md).

## API Reference

### User Operations

#### `usersDB.create(userData: CreateUserData): Promise<User>`

Create user profile after auth signup.

```typescript
const user = await usersDB.create({ auth_id: "auth-uuid", username: "john_doe" });
```

#### `usersDB.get(userId: string): Promise<User>`

Fetch user profile (cached 4h).

```typescript
const user = await usersDB.get("user-123");
```

#### `usersDB.update(userId: string, data: UpdateUserData): Promise<User>`

Update user profile. Validates user before write.

```typescript
const updated = await usersDB.update("user-123", { username: "new_name" });
```

### World Operations

#### `worldsDB.create(worldData: CreateWorldData): Promise<World>`

Create a new world. Validates owner is authenticated; sets owner_id automatically.

```typescript
const world = await worldsDB.create({
  name: "Forgotten Realms",
  system: "dnd5e",
  is_dm: true,
});
```

#### `worldsDB.getById(worldId: string): Promise<WorldWithAccess>`

Fetch single world with user's access role. Respects RLS (only sees worlds user has access to).

```typescript
const world = await worldsDB.getById("world-123");
console.log(world.user_role); // "dm" | "gm" | "player" | "spectator" | "observer"
```

#### `worldsDB.getUserWorlds(): Promise<WorldWithAccess[]>`

Fetch all worlds current user has access to (owned + invited).

```typescript
const worlds = await worldsDB.getUserWorlds();
```

#### `worldsDB.update(worldId: string, data: UpdateWorldData): Promise<World>`

Update world details. Only owner can update.

```typescript
const updated = await worldsDB.update("world-123", { name: "Updated Name" });
```

#### `worldsDB.delete(worldId: string): Promise<void>`

Delete world and all associated data. Only owner can delete.

```typescript
await worldsDB.delete("world-123");
```

#### `worldsDB.grantAccess(worldId: string, userId: string, role: AccessRole): Promise<WorldAccess>`

Grant user access to world with specified role.

**Roles:** `"dm"` (owner), `"gm"` (co-owner), `"player"` (limited), `"spectator"` (read-only), `"observer"` (read-only)

```typescript
await worldsDB.grantAccess("world-123", "user-456", "player");
```

#### `worldsDB.revokeAccess(worldId: string, userId: string): Promise<void>`

Revoke user access to world.

```typescript
await worldsDB.revokeAccess("world-123", "user-456");
```

### Invite Operations

#### `createInviteLink(params: { worldId: string; hoursValid?: number }): Promise<{ success: boolean; inviteLink?: InviteLink; error?: string }>`

Create shareable invite link (expires after specified hours, default 24).

```typescript
const result = await createInviteLink({ worldId: "world-123", hoursValid: 48 });
if (result.success) {
  console.log(result.inviteLink?.token); // Share this token
}
```

#### `validateInviteToken(token: string): Promise<{ success: boolean; worldId?: string; error?: string }>`

Validate invite link token and retrieve world ID. Checks expiration.

```typescript
const result = await validateInviteToken("token-abc");
if (result.success) {
  // User can join world: result.worldId
}
```

#### `getWorldInviteLinks(worldId: string): Promise<{ success: boolean; invites?: InviteLink[]; error?: string }>`

Fetch all active invite links for a world. Only world owner can see.

```typescript
const result = await getWorldInviteLinks("world-123");
```

#### `deleteInviteLink(token: string): Promise<{ success: boolean; error?: string }>`

Revoke invite link. Existing players keep access.

```typescript
await deleteInviteLink("link-token-xyz");
```

### Common Utilities

#### `getCurrentUserProfile(forceRefresh?: boolean): Promise<User | null>`

Fetch current user profile. Cache-first: fresh for 4h; `forceRefresh=true` bypasses cache.

```typescript
const user = await getCurrentUserProfile();
const fresh = await getCurrentUserProfile(true); // Force Supabase check
```

#### `validateUserForWrite(): Promise<User>`

Validate user is authenticated and profile exists. Throws if not. Used before all writes.

```typescript
const user = await validateUserForWrite();
// Throws if user not authenticated or profile missing
```

#### `verifyWorldAccessWithDatabase(worldId: string, options?: { forceVerification?: boolean }): Promise<boolean>`

Verify user has access to world. Cache-first strategy (fresh <2h instant, stale 2-4h check Supabase, >4h refetch).

```typescript
const hasAccess = await verifyWorldAccessWithDatabase("world-123");
const verified = await verifyWorldAccessWithDatabase("world-123", { forceVerification: true });
```

#### `executeParallelQueries(queries: Promise[]): Promise<any[]>`

Execute multiple database queries in parallel. Optimizes batch operations.

```typescript
const [user, worlds, invites] = await executeParallelQueries([
  usersDB.get(userId),
  worldsDB.getUserWorlds(),
  getWorldInviteLinks(worldId),
]);
```

### Feature Flags & Entitlements

**Note:** Feature flag fetching has been migrated to edge functions. Direct database queries are deprecated.

#### `fetchEntitlementsByUserId(userId: string): Promise<EntitlementRow[]>`

Fetch all entitlements for a user. Uses DatabaseProvider internally.

```typescript
const entitlements = await fetchEntitlementsByUserId(userId);
```

#### `hasEntitlement(userId: string, entitlementKey: string): Promise<boolean>`

Check if user has active entitlement. Uses DatabaseProvider internally.

```typescript
const isPremium = await hasEntitlement(userId, "premium");
```

#### `fetchEntitlementOverridesByUserId(userId: string): Promise<EntitlementOverrideRow[]>`

Fetch per-user entitlement overrides. Uses DatabaseProvider internally.

```typescript
const overrides = await fetchEntitlementOverridesByUserId(userId);
```

**Deprecated Functions:**
- `fetchFeatureFlags()` - Migrated to edge function `get_feature_flags`
- `fetchOverridesByUserId()` - Migrated to edge function `get_feature_flags`

## Dependencies

### External Packages

- **None** - Database operations abstracted through DatabaseProvider

### Environment Variables

- **Provider-specific** - Handled by DatabaseProvider implementation

### Internal Dependencies

- **`lib/services` (DatabaseProvider)** – Pluggable database backend abstraction
- **`lib/api` (RequestManager)** – Deduplication, retry, rate limiting
- **`lib/cache` (QueryCache)** – Result caching and invalidation
- **`lib/auth` (AuthStateManager)** – User profile and auth state
- **`lib/storage` (SecureStorage)** – Encrypted token and user data persistence
- **`lib/utils/logger`** – Query logging (storage category)

## Error Handling & Edge Cases

### Supabase Not Configured

If environment variables missing, database operations gracefully degrade:

```typescript
const user = await getCurrentUserProfile();
// If Supabase not configured: returns null, logs warning, continues with cached data
```

### User Not Authenticated

Any operation requiring auth throws:

```typescript
await validateUserForWrite();
// Throws: "Not authenticated" or "User profile not found"
```

### RLS Policy Violations

If user attempts unauthorized access, Supabase RLS blocks:

```typescript
await worldsDB.delete("world-owned-by-other-user");
// Supabase RLS denies: "new row violates row-level security policy"
```

### Cache Stale During Mutation

If cache is stale when user mutates, invalidation clears related caches immediately:

```typescript
const staleWorld = await worldsDB.getById("world-123"); // From cache
await worldsDB.update("world-123", { name: "New" }); // Invalidates cache
const fresh = await worldsDB.getById("world-123"); // From Supabase
```

### Orphaned Data Prevention

`validateUserForWrite()` ensures data consistency. Called right before insert to catch deleted accounts:

```typescript
const user = await validateUserForWrite(); // Succeeds initially
// [Account deleted here by admin/user]
await worldsDB.create(...); // validateUserForWrite called again → throws, prevents orphan
```

## Performance Notes

### Query Caching

- `getCurrentUserProfile()`: Cached 4h; minimal latency on cache hit
- `worldsDB.getById()`: Cached via QueryCache with tags; invalidated on update
- `getUserWorlds()`: Cached per user; invalidated on world create/delete

### RequestManager Deduplication

All queries deduplicated via RequestManager:

```typescript
const p1 = worldsDB.getById("world-123");
const p2 = worldsDB.getById("world-123"); // Coalesced: same promise as p1
```

### Parallel Execution

Use `executeParallelQueries()` instead of sequential awaits:

```typescript
// Sequential (slow): ~900ms
const user = await usersDB.get(userId); // 300ms
const worlds = await worldsDB.getUserWorlds(); // 300ms
const invites = await getInvitesByWorld(worldId); // 300ms

// Parallel (fast): ~300ms
const [user, worlds, invites] = await executeParallelQueries([...]);
```

### RLS Overhead

RLS policies add <10ms per query. Security benefit far outweighs cost.

## Related Modules

- **`lib/api`** – Works with RequestManager for deduplication and retry
- **`lib/cache`** – Works with QueryCache for result caching and invalidation
- **`lib/auth`** – Works with AuthStateManager for user profile and session
- **`lib/storage`** – Works with SecureStorage for encrypted token persistence
- **`lib/premium`** – Uses entitlements queries for subscription tier checks
- **`lib/feature-flags`** – Works with feature flags and overrides queries
- **`lib/utils/logger`** – Logs all database operations (storage category)

## File Breakdown

| File | Purpose |
| --- | --- |
| `common.ts` | Shared utilities: user validation, caching strategy, parallel query execution |
| `users.ts` | User profile CRUD (create, get, update); integrates with AuthStateManager |
| `worlds.ts` | World CRUD (create, get, list, update, delete) and access management (grant/revoke); core gameplay entity |
| `invites.ts` | Invite link operations (create, redeem, list, revoke); enables world sharing |
| `entitlements.ts` | Entitlement queries (fetch by user, check active, fetch overrides) |
| `feature-flags.ts` | Feature flag queries (fetch global flags) |
| `feature-flag-overrides.ts` | Per-user feature flag override queries (admin tool) |
| `index.ts` | Barrel export of public API |

**Note:** All entity files use `getDatabaseProvider()` from `lib/services` for database operations. Direct database client imports have been abstracted away for backend flexibility.
