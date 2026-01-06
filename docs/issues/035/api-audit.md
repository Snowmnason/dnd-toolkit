# API/Supabase Call Audit

## Current State Analysis

### Database Access Patterns

#### lib/database/worlds.ts
**Functions:**
- `create()` - Creates new world
  - Calls: `supabase.auth.getUser()` → `users.select()` → `worlds.insert()`
  - **Issue**: Repetitive auth + user lookup pattern
  
- `getMyWorlds(userId?)` - Gets all user's worlds (owned + member)
  - Calls: Optional `auth.getUser()` + `users.select()` → Parallel `world_access.select()` + `worlds.select()` → `worlds.select().in()`
  - **Good**: Uses parallel queries, dedupe logic
  - **Issue**: Optional userId param exists but auth lookup still happens sometimes
  
- `updateName()` - Updates world name
  - Calls: `worlds.update()`
  - **Good**: Direct update, no unnecessary lookups
  
- `update()` - Updates world
  - Calls: `worlds.update()`
  - **Good**: Clean update
  
- `delete()` - Deletes world
  - Calls: `worlds.delete()`
  - **Good**: Clean delete
  
- `removeUserFromWorld()` - Removes user from world
  - Calls: `world_access.delete()`
  - **Good**: Clean delete
  
- `isUserInWorld()` - Checks if user in world
  - Calls: `worlds.select()` → `world_access.select()`
  - **Issue**: Sequential checks, could be combined
  
- `addUserToWorld()` - Adds user to world
  - Calls: `world_access.insert()`
  - **Good**: Clean insert
  
- `getWorldMembers()` - Gets all members
  - Calls: `world_access.select()` with join
  - **Good**: Single query with join
  
- `getById()` - Gets single world
  - Calls: `worlds.select().single()`
  - **Good**: Direct lookup
  
- `getOwnedWorlds()` - Gets only owned worlds
  - Calls: `auth.getUser()` → `users.select()` → `worlds.select()`
  - **Issue**: Repetitive auth + user lookup, duplicates part of getMyWorlds
  
- `getMemberWorlds()` - Gets only member worlds
  - Calls: `auth.getUser()` → `users.select()` → `world_access.select()` → `worlds.select().in()`
  - **Issue**: Repetitive auth + user lookup, duplicates part of getMyWorlds

#### lib/database/users.ts
**Functions:**
- `create()` - Creates user profile
  - Calls: `users.insert()`
  - **Good**: Direct insert with validation
  
- `createWithDefaults()` - Creates user with defaults
  - Calls: `create()`
  - **Good**: Wrapper for default values
  
- `getCurrentUser()` - Gets current user profile
  - Calls: Storage check → `auth.getUser()` → `users.select()`
  - **Good**: Uses cache, falls back to DB
  - **Issue**: Should be used everywhere instead of manual auth→users lookups
  
- `getByAuthId()` - Gets user by auth ID
  - Calls: `users.select()`
  - **Good**: Direct lookup
  
- `update()` - Updates user profile
  - Calls: `auth.getUser()` → `users.select()` → `users.update()`
  - **Issue**: Repetitive auth + user lookup
  
- `deleteAccount()` - Deletes account
  - Calls: `auth.getUser()` → `functions.invoke('delete-account')`
  - **Good**: Uses edge function for complex operation

#### lib/database/invites.ts
**Functions:**
- `generateInviteLink()` - Generates invite
  - Calls: `auth.getUser()` → `users.select()` → `invite_links.insert()`
  - **Issue**: Repetitive auth + user lookup
  
- `getInviteLinkDetails()` - Gets invite details
  - Calls: `invite_links.select()`
  - **Good**: Direct lookup
  
- `acceptInvite()` - Accepts invite
  - Calls: `invite_links.select()` → `invite_links.update()`
  - **Good**: Sequential but necessary for validation
  
- `getMyInviteLinks()` - Gets user's invites
  - Calls: `invite_links.select()`
  - **Good**: Direct query

### Common Anti-Patterns Identified

1. **Repetitive Auth→User Lookup**
   - Pattern appears in: `worlds.create()`, `worlds.getOwnedWorlds()`, `worlds.getMemberWorlds()`, `users.update()`, `invites.generateInviteLink()`
   - Solution: Create shared `getCurrentUserProfile()` helper that uses cache

2. **Duplicate Functions**
   - `getOwnedWorlds()` + `getMemberWorlds()` duplicate logic from `getMyWorlds()`
   - Solution: Remove these functions, use `getMyWorlds()` with filtering

3. **Sequential Queries That Could Be Parallel**
   - `isUserInWorld()` does two sequential lookups
   - Solution: Use Promise.all or combine into single query

4. **No Retry/Dedupe Logic**
   - All queries are direct with no retry on transient failures
   - All queries can be duplicated if called multiple times
   - Solution: Implement request manager

### Files to Refactor

**Priority 1 - High Impact:**
1. `lib/database/worlds.ts` - Remove duplicate functions, consolidate auth lookups
2. `lib/database/users.ts` - Enhance getCurrentUser() to be the single source
3. Create `lib/database/common.ts` - Shared helpers (getCurrentUserProfile, etc.)

**Priority 2 - Medium Impact:**
4. `lib/database/invites.ts` - Use shared auth helper
5. `lib/settings/signOut.ts` - Clean wrapper
6. `lib/settings/deleteAccount.ts` - Use shared auth helper

**Priority 3 - Auth Related:**
7. `lib/auth/authService.ts` - Already clean, just needs request manager integration
8. `lib/auth/sessionService.ts` - Already clean
9. `lib/auth-state.ts` - Central auth management, needs request manager

### Proposed Refactor Plan

#### Phase 1: Create Shared Helpers
1. Create `lib/database/common.ts`:
   - `getCurrentUserProfile()` - Cache-first user profile lookup
   - `executeQuery()` - Wrapper for all queries (prep for request manager)
   - `executeParallelQueries()` - Helper for Promise.all patterns

#### Phase 2: Refactor worlds.ts
1. Remove `getOwnedWorlds()` and `getMemberWorlds()` (use getMyWorlds + filter)
2. Replace all auth→user lookups with `getCurrentUserProfile()`
3. Optimize `isUserInWorld()` to use single query

#### Phase 3: Refactor users.ts
1. Enhance `getCurrentUser()` to be authoritative
2. Replace auth→user lookups with centralized function

#### Phase 4: Refactor invites.ts
1. Use shared `getCurrentUserProfile()`
2. Consider combining related queries

#### Phase 5: Integration Points
1. Update all imports to use new shared helpers
2. Prepare query wrappers for request manager integration
