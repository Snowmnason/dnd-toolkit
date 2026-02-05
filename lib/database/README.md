# lib/database

Supabase PostgreSQL database layer providing app-specific data operations for dnd-toolkit. Includes schema management guidance, RLS (Row-Level Security) policies, and type-safe database access patterns.

## When to Use This Module

**Use this module to:**

- Query and mutate dnd-toolkit game data (worlds, characters, sessions, invites, etc.)
- Maintain app-specific data models (User, World, WorldAccess, InviteLink, etc.) with type safety
- Enforce RLS (Row-Level Security) policies for multi-tenant security (users can only access their own worlds)
- Integrate with [lib/api](../api/README.md) (RequestManager for deduplication/retry) and [lib/cache](../cache/README.md) (QueryCache for persistence)
- Perform database operations with proper error handling and [lib/utils's Logger](../utils/README.md) category-based logging
- Sync offline mutations via [lib/offline](../offline/README.md) mutation queue

**Do NOT use this module for:**

- Authentication operations (use [lib/auth](../auth/README.md) instead)
- Raw Supabase queries without business logic wrapping (always encapsulate in domain-specific functions)
- Circumventing RLS policies (never bypass Supabase auth; policies protect data integrity)
- Synchronous/blocking database calls (all operations are async)
- User subscription/entitlements (use [lib/premium's SubscriptionManager](../premium/README.md) instead)

## Architecture & Data Flow

```
User Action (UI Component)
        ↓
Call Domain API (e.g., worldsDB.create(), usersDB.get())
        ↓
Validate User (getCurrentUserProfile / validateUserForWrite)
        ↓
RequestManager.fetch (dedupe, retry, integrate with QueryCache)
        ↓
Supabase Client Call (INSERT/UPDATE/SELECT/DELETE via RLS policies)
        ↓
Validate Response (handle errors, log outcomes)
        ↓
Update Cache (QueryCache invalidation for related entities)
        ↓
Return Result to UI
```

**Key Principles:**

- **RLS-Enforced Security**: All queries respect Supabase RLS policies; no data leaks between users/worlds
- **Type-Safe**: Interfaces for all data models (User, World, WorldAccess, etc.) ensure compile-time safety
- **Deduplication**: RequestManager prevents duplicate queries (same cache key = same result)
- **Cache Integration**: QueryCache stores results; invalidated on mutations (CRUD operations)
- **Validation**: User validation before write operations prevents orphaned data
- **Offline Support**: Cached data persists via SecureStorage/FastCache; fallback if network unavailable
- **Observable**: All operations logged (storage category) and tracked to analytics

## Database Schema Overview

### Core Tables

**users** – User profiles (created after auth signup)

```sql
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now(),
  isAdmin boolean DEFAULT false
);
```

**worlds** – D&D campaign worlds (owned by users)

```sql
CREATE TABLE worlds (
  world_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  system text NOT NULL, -- e.g., "dnd5e", "pathfinder2e"
  is_dm boolean NOT NULL,
  map_image_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**world_access** – User access to worlds (multi-tenant role assignment)

```sql
CREATE TABLE world_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id uuid NOT NULL REFERENCES worlds(world_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_role text NOT NULL, -- "dm" or "player"
  permissions jsonb, -- Future: granular permissions
  created_at timestamptz DEFAULT now(),
  UNIQUE(world_id, user_id)
);
```

**invite_links** – Shareable world invitations

```sql
CREATE TABLE invite_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id uuid NOT NULL REFERENCES worlds(world_id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

**feature_flags** – Server-side feature gates (global, env-specific)

```sql
CREATE TABLE feature_flags (
  flag_name text PRIMARY KEY,
  enabled boolean NOT NULL,
  kind text NOT NULL, -- "free", "premium", "beta"
  description text,
  env text NOT NULL, -- "production", "staging", "development"
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_feature_flags_env ON feature_flags(env);
```

**entitlements** – User subscription tier and feature access (with expiry)

```sql
CREATE TABLE entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  key text NOT NULL, -- e.g., "premium", "beta_access"
  env text NOT NULL, -- "production", "staging", "development"
  expires_at timestamptz NULL, -- NULL = never expires
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_entitlements_user_id ON entitlements(user_id);
CREATE INDEX idx_entitlements_key ON entitlements(key);
CREATE INDEX idx_entitlements_env ON entitlements(env);
CREATE INDEX idx_entitlements_user_key_env ON entitlements(user_id, key, env);
CREATE INDEX idx_entitlements_expires_at ON entitlements(expires_at);
```

## API Reference

### Core Module Exports

Each domain (users, worlds, invites) exports a database object with CRUD operations:

```ts
import { usersDB } from "@/lib/database/users";
import { worldsDB } from "@/lib/database/worlds";
import { invitesDB } from "@/lib/database/invites";
```

### User Operations

#### `usersDB.create(userData: CreateUserData): Promise<User>`

Creates a user profile after auth signup. Called automatically by signup flow.

```ts
const user = await usersDB.create({
  auth_id: "auth-uuid",
  username: "john_doe",
  isAdmin: false,
});
```

#### `usersDB.get(userId: string): Promise<User>`

Fetches user profile by ID with cache support.

```ts
const user = await usersDB.get("user-123");
```

#### `usersDB.update(userId: string, data: UpdateUserData): Promise<User>`

Updates user profile. Validates user before write. Returns updated profile.

```ts
const updated = await usersDB.update("user-123", { username: "new_name" });
```

---

### World Operations

#### `worldsDB.create(worldData: CreateWorldData): Promise<World>`

Creates a new world. Validates owner is authenticated. Sets owner_id automatically.

```ts
const world = await worldsDB.create({
  name: "Forgotten Realms Campaign",
  description: "Epic adventure in Faerun",
  system: "dnd5e",
  is_dm: true,
  map_image_url: "https://...",
});
```

#### `worldsDB.getById(worldId: string): Promise<WorldWithAccess>`

Fetches single world with user's access role. Respects RLS (only sees worlds user has access to).

```ts
const world = await worldsDB.getById("world-123");
console.log(world.user_role); // "owner", "dm", or "player"
```

#### `worldsDB.getUserWorlds(): Promise<WorldWithAccess[]>`

Fetches all worlds current user has access to (owned + invited).

```ts
const worlds = await worldsDB.getUserWorlds();
// Returns [owned worlds, worlds user is DM/player in]
```

#### `worldsDB.update(worldId: string, data: UpdateWorldData): Promise<World>`

Updates world details. Only owner can update. Validates before write.

```ts
const updated = await worldsDB.update("world-123", {
  name: "Updated Campaign Name",
});
```

#### `worldsDB.delete(worldId: string): Promise<void>`

Deletes world and all associated data (world_access, characters, sessions, etc. cascade via DB). Only owner can delete.

```ts
await worldsDB.delete("world-123");
```

#### `worldsDB.grantAccess(worldId: string, userId: string, role: AccessRole): Promise<WorldAccess>`

Grants user access to world with specified role ("dm" or "player").

```ts
await worldsDB.grantAccess("world-123", "user-456", "player");
```

#### `worldsDB.revokeAccess(worldId: string, userId: string): Promise<void>`

Revokes user access to world. User can no longer view/edit.

```ts
await worldsDB.revokeAccess("world-123", "user-456");
```

---

### Invite Link Operations

#### `createInviteLink(params: { worldId: string; hoursValid?: number }): Promise<{ success: boolean; inviteLink?: InviteLink; error?: string }>`

Creates a shareable invite link. Link expires after specified hours (default 24).

```ts
const result = await createInviteLink({
  worldId: "world-123",
  hoursValid: 48,
});
if (result.success) {
  console.log(result.inviteLink?.token); // Share this URL: /invite/TOKEN
}
```

#### `validateInviteToken(token: string): Promise<{ success: boolean; worldId?: string; error?: string }>`

Validates an invite link token and retrieves the associated world ID. Checks expiration.

```ts
const result = await validateInviteToken("invite-token-abc123");
if (result.success) {
  // User can now join world: result.worldId
}
```

#### `getWorldInviteLinks(worldId: string): Promise<{ success: boolean; invites?: InviteLink[]; error?: string }>`

Fetches all active invite links for a world. Only world owner can see.

```ts
const result = await getWorldInviteLinks("world-123");
if (result.success) {
  console.log(result.invites); // List of active invites
}
```

#### `deleteInviteLink(token: string): Promise<{ success: boolean; error?: string }>`

Deletes/revokes an invite link so it can't be redeemed. Existing players keep access.

```ts
const result = await deleteInviteLink("link-token-xyz");
if (result.success) {
  console.log("Invite link revoked");
}
```

---

### Common Utilities

#### `getCurrentUserProfile(forceRefresh?: boolean): Promise<User | null>`

Fetches current user profile with cache-first strategy. Cache is fresh for 4 hours.

```ts
// Use cache (recommended for most reads)
const user = await getCurrentUserProfile();

// Force fresh from database (admin panel, after logout, etc.)
const fresh = await getCurrentUserProfile(true);
```

**Cache Strategy:**

- First call: fetches from Supabase
- Subsequent calls within 4 hours: returns cached version
- After 4 hours: fetches fresh, updates cache
- `forceRefresh: true`: always hits Supabase, ignores cache

#### `validateUserForWrite(): Promise<User>`

Validates that user is authenticated and profile exists. Throws if not. Used before all write operations (CREATE/UPDATE/DELETE).

```ts
const user = await validateUserForWrite();
// If user not authenticated or profile missing: throws Error
// Otherwise: returns User profile
```

**Security:** Prevents orphaned data. If user account is suspended/deleted between auth check and DB write, this validation catches it.

#### `verifyWorldAccessWithDatabase(worldId: string, options?: { forceVerification?: boolean }): Promise<boolean>`

Verifies user has access to world. Cache-first: fresh < 2h = instant, stale 2-4h = Supabase check, >4h = refetch.

```ts
// Use cache if fresh
const hasAccess = await verifyWorldAccessWithDatabase("world-123");

// Always check Supabase (sensitive operations)
const verified = await verifyWorldAccessWithDatabase("world-123", {
  forceVerification: true,
});
```

#### `executeParallelQueries(queries: Array<Promise>): Promise<any[]>`

Executes multiple database queries in parallel. Optimizes performance for batch operations.

```ts
const [user, worlds, invites] = await executeParallelQueries([
  usersDB.get(userId),
  worldsDB.getUserWorlds(),
  getWorldInviteLinks(worldId),
]);
```

---

### Feature Flags & Entitlements (Phase 1)

**Note:** These helpers are used internally by `FeatureFlagsManager` and are not typically called directly from components. Use the manager or React hooks instead.

#### `fetchFeatureFlagsByEnv(supabase: SupabaseClient, env: string): Promise<FeatureFlagRow[]>`

Fetches all feature flags for a specific environment. Called by `FeatureFlagsManager.bootstrapFlags()` at app startup.

```ts
import { fetchFeatureFlagsByEnv } from "@/lib/database/feature-flags";

const flags = await fetchFeatureFlagsByEnv(supabaseClient, "production");
// Returns: [{ flag_name: "darkModeV2", enabled: true, kind: "free", env: "production", ... }]
```

**Parameters:**

- `env` – Environment: `"production"` | `"staging"` | `"development"`

**Returns:** Array of `FeatureFlagRow` objects (or empty array if none found)

#### `fetchEntitlementsByUserId(supabase: SupabaseClient, userId: string, env: string): Promise<EntitlementRow[]>`

Fetches all entitlements for a user. Called by `FeatureFlagsManager.getEntitlement()` for fresh checks.

```ts
import { fetchEntitlementsByUserId } from "@/lib/database/entitlements";

const entitlements = await fetchEntitlementsByUserId(
  supabaseClient,
  userId,
  "production",
);
// Returns: [{ id: "uuid", user_id: "uuid", key: "premium", expires_at: "2026-12-31T...", env: "production" }]
```

**Parameters:**

- `userId` – User ID (UUID)
- `env` – Environment: `"production"` | `"staging"` | `"development"`

**Returns:** Array of `EntitlementRow` objects (or empty array if none found)

#### `hasEntitlement(supabase: SupabaseClient, userId: string, key: string, env: string): Promise<boolean>`

Checks if a user has an active entitlement. Automatically handles expiry checking.

```ts
import { hasEntitlement } from "@/lib/database/entitlements";

const isPremium = await hasEntitlement(
  supabaseClient,
  userId,
  "premium",
  "production",
);
// Returns true if:
//   - Entitlement exists for user
//   - expires_at is null (never expires) OR expires_at > now()
// Returns false otherwise
```

**Parameters:**

- `userId` – User ID (UUID)
- `key` – Entitlement key (e.g., `"premium"`, `"beta_access"`)
- `env` – Environment: `"production"` | `"staging"` | `"development"`

**Returns:** Boolean (true if active, false if missing or expired)

**Security Note:** Expiry checking happens on the client side. For sensitive operations, verify entitlements on the backend as well.

---

## Dependencies

### External Packages

- **`@supabase/supabase-js`** – Supabase client SDK; optional, lazy-loaded
- **`expo-constants`** – Access to environment variables (Supabase URL/key)

### Environment Variables & Deployment

Supabase credentials are injected at build time via GitHub Actions (`pages.yml`):

```yaml
# .github/workflows/pages.yml
- name: Build web export
  env:
    EXPO_PUBLIC_SUPABASE_URL: ${{ secrets.EXPO_PUBLIC_SUPABASE_URL }}
    EXPO_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.EXPO_PUBLIC_SUPABASE_ANON_KEY }}
  run: npm run predeploy
```

**Development:** Set `EXPO_PUBLIC_ENVIRONMENT=development` + provide credentials in `.env.local` or `app.json` extra fields

**Production:** Secrets stored in GitHub repository secrets; injected during CI/CD build for deployment to GitHub Pages

### Internal Dependencies

- **`lib/api` (RequestManager)** – Deduplication, retry, rate limiting for all database queries
- **`lib/cache` (QueryCache)** – Caching and invalidation of query results
- **`lib/auth` (AuthStateManager)** – User profile persistence and auth state
- **`lib/storage` (SecureStorage)** – Encrypted storage for auth tokens and user data
- **`lib/utils/logger`** – Query logging (storage category) and error tracking

---

## Error Handling & Edge Cases

### Supabase Not Configured

If Supabase environment variables (URL, API key) are missing, database operations gracefully degrade:

```ts
const user = await getCurrentUserProfile();
// If Supabase not configured:
// - Returns null (no error thrown)
// - Logs warning: "Server connection unavailable"
// - App continues with cached/offline data
```

### User Not Authenticated

Any operation requiring auth validation throws:

```ts
await validateUserForWrite();
// If no active session: throws Error("Not authenticated")
// If session exists but profile missing: throws Error("User profile not found")
```

### RLS Policy Violations

If user attempts to access/modify data they don't own, Supabase RLS policy denies:

```ts
await worldsDB.delete("world-owned-by-other-user");
// Supabase RLS blocks: returns error "new row violates row-level security policy"
```

### Cache Stale Data During Mutation

If cache is stale and user mutates (UPDATE), invalidation clears related caches immediately:

```ts
// Old cached version might exist
const staleWorld = await worldsDB.getById("world-123"); // From cache

// User updates world
await worldsDB.update("world-123", { name: "New Name" });
// Invalidates: `world:123:details`, `worlds:user:*` tags

// Next read fetches fresh
const fresh = await worldsDB.getById("world-123"); // From Supabase
```

### Orphaned Data Prevention

`validateUserForWrite()` ensures data consistency:

```ts
// Case: User A starts creating world, account gets deleted mid-operation
const user = await validateUserForWrite(); // Succeeds initially
// [Account deleted here]
await supabase.from("worlds").insert({ owner_id: user.id }); // Insert still uses user.id

// Solution: validateUserForWrite() is called AGAIN right before insert in each operation
// If account deleted: throws Error, prevents orphaned world
```

---

## Performance Notes

### Query Caching

- `getCurrentUserProfile()`: Cached 4 hours; minimal latency on hit
- `worldsDB.getById()`: Cached via QueryCache with tags; invalidated on update
- `getUserWorlds()`: Cached per user; invalidated when worlds created/deleted

### RequestManager Integration

All queries deduplicated via RequestManager:

```ts
// Both calls return same promise:
const p1 = worldsDB.getById("world-123");
const p2 = worldsDB.getById("world-123"); // Coalesced: same promise as p1
```

### Parallel Query Optimization

Use `executeParallelQueries()` instead of sequential awaits:

```ts
// Sequential (slow): ~900ms
const user = await usersDB.get(userId); // 300ms
const worlds = await worldsDB.getUserWorlds(); // 300ms
const invites = await getInvitesByWorld(worldId); // 300ms

// Parallel (fast): ~300ms
const [user, worlds, invites] = await executeParallelQueries([
  usersDB.get(userId),
  worldsDB.getUserWorlds(),
  getInvitesByWorld(worldId),
]);
```

### RLS Policy Overhead

RLS policies add minimal latency (<10ms per query). Security benefit far outweighs cost.

---

## Adding New Database Operations

### Step 1: Add Table to Supabase

1. Go to Supabase Console → SQL Editor
2. Create table with columns, foreign keys, indexes
3. Enable RLS policies for multi-tenant security
4. Test via SQL editor before deploying

### Step 2: Create TypeScript Interfaces

```ts
// In lib/database/my-entity.ts

export interface MyEntity {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

export interface CreateMyEntityData {
  name: string;
}
```

### Step 3: Implement CRUD Operations

```ts
export const myEntityDB = {
  async create(data: CreateMyEntityData): Promise<MyEntity> {
    return RequestManager.fetch(
      `my-entity:create:${Date.now()}`,
      async () => {
        const user = await validateUserForWrite();

        const { data: result, error } = await supabase
          .from("my_entities")
          .insert({ ...data, owner_id: user.id })
          .select()
          .single();

        if (error) throw new Error(error.message);

        // Invalidate related cache tags
        await QueryCache.invalidateByTags(["my-entities"]);

        return result;
      },
      { dedupe: false, retries: 3, timeout: 15000 },
    );
  },

  async get(id: string): Promise<MyEntity> {
    return RequestManager.fetch(
      `my-entity:${id}`,
      async () => {
        const { data, error } = await supabase
          .from("my_entities")
          .select()
          .eq("id", id)
          .single();

        if (error) throw new Error(error.message);
        return data;
      },
      {
        dedupe: true,
        useQueryCache: true,
        tags: ["my-entities"],
        cacheTime: 30 * 60 * 1000,
      },
    );
  },
};
```

### Step 4: Export from Module

Add to barrel export (create index.ts if needed):

```ts
export { myEntityDB } from "./my-entity";
export type { MyEntity, CreateMyEntityData } from "./my-entity";
```

---

## RLS Policies Reference

All tables have RLS enabled. Common patterns:

### Owner-Only Access

```sql
-- Owner can do anything
CREATE POLICY "owner_access" ON worlds
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
```

### Multi-Role Access (Owner + Invited)

```sql
-- User can access world if owner or has world_access entry
CREATE POLICY "access_via_world_access" ON worlds
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM world_access
      WHERE world_access.world_id = worlds.world_id
      AND world_access.user_id = auth.uid()
    )
  );
```

### Granular Permissions (by Role)

```sql
-- DMs can edit; players can only view
CREATE POLICY "dm_can_edit" ON world_sessions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM world_access
      WHERE world_access.world_id = world_sessions.world_id
      AND world_access.user_id = auth.uid()
      AND world_access.user_role = 'dm'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM world_access
      WHERE world_access.world_id = world_sessions.world_id
      AND world_access.user_id = auth.uid()
      AND world_access.user_role = 'dm'
    )
  );
```

---

## Testing

Currently, no dedicated test guide exists. When adding tests, create a guide at `docs/A Testing Guide/database.md` following the repository's testing guide template.

**Manual testing tips:**

- **RLS Verification**: Sign in as User A, attempt to delete User B's world → should fail with RLS error
- **Cache Hit**: Call `getById()` twice → second call should return instantly
- **Stale Data**: Update world, verify cache invalidates and next read is fresh
- **Orphaned Data**: Delete user via auth → verify all their worlds/data cascades deleted
- **Offline Fallback**: Disable network, attempt query → should return cached/persisted data
- **Parallel Queries**: Call multiple getters in parallel → verify all return results in single request

---

## File Breakdown

| File               | Purpose                                                                                                                         | Exports                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `supabase.ts`      | Lazy-loaded Supabase client with auth persistence via SecureStorage. Checks if Supabase is configured; fails gracefully if not. | `getSupabaseClient()`, `isSupabaseConfigured()`, `supabase` proxy                                                  |
| `common.ts`        | Shared utilities: user validation, caching strategy, parallel query execution. Used by domain operations.                       | `getCurrentUserProfile()`, `validateUserForWrite()`, `verifyWorldAccessWithDatabase()`, `executeParallelQueries()` |
| `users.ts`         | User profile CRUD (create, get, update). Called after auth signup; integrated with AuthStateManager.                            | `usersDB`, `User`, `CreateUserData`, `UpdateUserData`                                                              |
| `worlds.ts`        | World CRUD (create, get, list, update, delete) and world access management (grant/revoke). Core gameplay entity.                | `worldsDB`, `World`, `WorldAccess`, `WorldWithAccess`, `UserRole`, `AccessRole`                                    |
| `invites.ts`       | Invite link operations (create, redeem, list, revoke). Enables world sharing and multi-player onboarding.                       | `createInviteLink()`, `redeemInviteLink()`, `getInvitesByWorld()`, `revokeInviteLink()`, `InviteLink`              |
| `supabase-lazy.ts` | Legacy/deprecated lazy-loading logic (if exists; may be merged into supabase.ts).                                               | TBD                                                                                                                |

---

## Future Enhancements

- **Pagination**: Add cursor-based pagination for large datasets (worlds list, session logs, etc.)
- **Batch Operations**: Optimize bulk inserts/updates (world setup, campaign initialization)
- **Audit Logging**: Track all user actions (who created/deleted/edited what, timestamps)
- **Full-Text Search**: Index campaign names, descriptions for searchability
- **Relationship Optimization**: Query planner tuning for complex joins (worlds + access + invites)
- **Migration Strategy**: Document how to migrate data between versions (schema changes, backups)
