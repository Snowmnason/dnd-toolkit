# Phase 4+: Query Cache Optimization Roadmap

## Overview

This document outlines the Phase 4+ optimization roadmap for extending QueryCache to additional domains beyond worlds and users (Phase 1-3). Each phase targets a specific data domain with appropriate staleness configurations and cache invalidation strategies.

**Status**: Out of scope for current milestone. Use as reference for future implementation.

---

## Phase 4a: Notes Optimization

### Priority: HIGH
**Rationale**: Notes are user-generated content, frequently updated, core feature for campaign management

### Cache Configuration

```typescript
// Staleness: 15 minutes (user-generated, moderate change frequency)
CACHE_CONFIG.userGenerated = {
  staleTime: 15 * 60 * 1000,    // 15 minutes
  cacheTime: 1 * 60 * 60 * 1000 // 1 hour
}
```

### Cache Keys (Already Defined)

```typescript
CACHE_KEYS.notes = {
  all: (worldId: string) => `world:${worldId}:notes`,
  forWorldAndUser: (worldId: string, userId: string) => `world:${worldId}:notes:user:${userId}`,
  details: (worldId: string, noteId: string) => `world:${worldId}:note:${noteId}:details`,
  versions: (worldId: string, noteId: string) => `world:${worldId}:note:${noteId}:versions`,
}
```

### Tags for Invalidation

```typescript
CACHE_TAGS.notes                           // All notes everywhere
CACHE_TAGS.note(worldId, noteId)           // Specific note
INVALIDATION_PATTERNS.worldNotes(worldId)  // All notes in specific world
```

### Files to Create

1. **`lib/database/notes.ts`** (if not exists)
   - `getNotes(worldId: string)` - Get all notes
   - `getNote(worldId: string, noteId: string)` - Get single note
   - `createNote(worldId: string, data: CreateNoteData)` - Create with cache invalidation
   - `updateNote(worldId: string, noteId: string, updates: UpdateNoteData)` - Update with invalidation
   - `deleteNote(worldId: string, noteId: string)` - Delete with invalidation

2. **`hooks/use-notes-query.tsx`** (New)
   ```typescript
   export function useNotesQuery(worldId: string)
   export function useNoteQuery(worldId: string, noteId: string | null)
   ```

3. **`hooks/use-notes-mutation.tsx`** (New)
   ```typescript
   export function useCreateNoteMutation()
   export function useUpdateNoteMutation()
   export function useDeleteNoteMutation()
   ```

### Implementation Pattern

```typescript
// In lib/database/notes.ts
export const notesDB = {
  async createNote(worldId: string, data: CreateNoteData) {
    const user = await validateUserForWrite();
    
    const { data: note, error } = await supabase
      .from('notes')
      .insert({ ...data, world_id: worldId, created_by: user.id })
      .select()
      .single();
    
    if (error) throw new Error(error.message);
    
    // Invalidate cache
    await QueryCache.invalidateByTags([
      CACHE_TAGS.notes,
      CACHE_TAGS.note(worldId, note.id)
    ]);
    
    return note;
  }
}

// In hooks/use-notes-query.tsx
export function useNotesQuery(worldId: string) {
  const { data, error, isLoading, refetch } = useQuery(
    CACHE_KEYS.notes.all(worldId),
    () => notesDB.getNotes(worldId),
    {
      ...CACHE_CONFIG.userGenerated,
      tags: [CACHE_TAGS.notes, `world:${worldId}`],
    }
  );
  
  return { notes: data ?? [], isLoading, error, refetch };
}
```

---

## Phase 4b: Characters Optimization

### Priority: HIGH
**Rationale**: Character sheets frequently accessed, foundational data during play

### Cache Configuration

```typescript
// Staleness: 5-10 minutes (characters change during play)
CACHE_CONFIG.nearRealtime = {
  staleTime: 5 * 60 * 1000,     // 5 minutes
  cacheTime: 30 * 60 * 1000     // 30 minutes
}
```

### Cache Keys (Already Defined)

```typescript
CACHE_KEYS.characters = {
  all: (worldId: string) => `world:${worldId}:characters`,
  details: (worldId: string, characterId: string) => `world:${worldId}:character:${characterId}:details`,
  sheet: (worldId: string, characterId: string) => `world:${worldId}:character:${characterId}:sheet`,
}
```

### Tags for Invalidation

```typescript
CACHE_TAGS.characters                                // All characters
CACHE_TAGS.character(worldId, characterId)          // Specific character
INVALIDATION_PATTERNS.worldCharacters(worldId)      // All in world
```

### Files to Create

1. **`lib/database/characters.ts`** (if not exists)
   - `getCharacters(worldId: string)` - Get all characters in world
   - `getCharacter(worldId: string, characterId: string)` - Get single character
   - `getCharacterSheet(worldId: string, characterId: string)` - Full sheet with stats
   - `createCharacter(worldId: string, data: CreateCharacterData)` - Create with invalidation
   - `updateCharacter(worldId: string, characterId: string, updates: UpdateCharacterData)` - Update
   - `deleteCharacter(worldId: string, characterId: string)` - Delete with invalidation

2. **`hooks/use-characters-query.tsx`** (New)
   ```typescript
   export function useCharactersQuery(worldId: string)
   export function useCharacterQuery(worldId: string, characterId: string | null)
   export function useCharacterSheetQuery(worldId: string, characterId: string | null)
   ```

3. **`hooks/use-characters-mutation.tsx`** (New)
   ```typescript
   export function useCreateCharacterMutation()
   export function useUpdateCharacterMutation()
   export function useDeleteCharacterMutation()
   ```

---

## Phase 4c: Combat/Session Tracking

### Priority: MEDIUM
**Rationale**: Only needed during active play sessions, rapid updates

### Cache Configuration

```typescript
// Realtime: Initiative, turn order, positions, health
CACHE_CONFIG.realtime = {
  staleTime: 10 * 1000,      // 10 seconds only!
  cacheTime: 5 * 60 * 1000   // 5 minutes
}
```

### Cache Keys

```typescript
CACHE_KEYS.combat = {
  initiative: (worldId: string) => `world:${worldId}:combat:initiative`,
  encounter: (worldId: string, encounterId: string) => `world:${worldId}:encounter:${encounterId}`,
  round: (worldId: string) => `world:${worldId}:combat:round`,
}
```

### Tags for Invalidation

```typescript
CACHE_TAGS.combat = 'combat'              // All combat data
`world:${worldId}:combat`                 // Combat in specific world
```

### Files to Create

1. **`lib/database/combat.ts`**
   - `getInitiative(worldId: string, encounterId: string)`
   - `updateInitiative(...)`
   - `getRound(worldId: string, encounterId: string)`
   - `updateRound(...)`

2. **`hooks/use-combat-query.tsx`**
   ```typescript
   export function useCombatInitiativeQuery(worldId: string, encounterId: string | null)
   export function useCombatRoundQuery(worldId: string, encounterId: string | null)
   ```

3. **`hooks/use-combat-mutation.tsx`**
   ```typescript
   export function useUpdateInitiativeMutation()
   export function useUpdateRoundMutation()
   ```

---

## Phase 4d: Settings/Preferences

### Priority: LOW
**Rationale**: Settings change rarely, high staleness acceptable

### Cache Configuration

```typescript
// Reference data: static or very slow changing
CACHE_CONFIG.reference = {
  staleTime: 24 * 60 * 60 * 1000,        // 24 hours
  cacheTime: 7 * 24 * 60 * 60 * 1000     // 7 days
}
```

### Cache Keys

```typescript
CACHE_KEYS.settings = {
  world: (worldId: string) => `world:${worldId}:settings`,
  user: (userId: string) => `user:${userId}:settings`,
  app: 'app:settings',
}
```

### Files to Create

1. **`lib/database/settings.ts`**
   - `getWorldSettings(worldId: string)`
   - `updateWorldSettings(worldId: string, settings: any)`
   - `getUserSettings(userId: string)`
   - `updateUserSettings(userId: string, settings: any)`

2. **`hooks/use-settings-query.tsx`**
   ```typescript
   export function useWorldSettingsQuery(worldId: string)
   export function useUserSettingsQuery()
   ```

3. **`hooks/use-settings-mutation.tsx`**
   ```typescript
   export function useUpdateWorldSettingsMutation()
   export function useUpdateUserSettingsMutation()
   ```

---

## Implementation Checklist (Per Domain)

```typescript
// For each domain (Notes, Characters, Combat, Settings):

// 1. Define/Verify Cache Keys ✓ (mostly done)
☐ CACHE_KEYS.domain in lib/cache/keys.ts
☐ CACHE_TAGS.domain in lib/cache/keys.ts
☐ INVALIDATION_PATTERNS if needed

// 2. Create Database Layer
☐ lib/database/domain.ts
   ☐ CRUD operations
   ☐ QueryCache.invalidateByTags() in mutations
   ☐ Input validation
   ☐ Error handling

// 3. Create Query Hook
☐ hooks/use-domain-query.tsx
   ☐ useDomainsQuery() - list all
   ☐ useDomainQuery() - single item
   ☐ Proper disabled state handling

// 4. Create Mutation Hooks
☐ hooks/use-domain-mutation.tsx
   ☐ useCreateDomainMutation()
   ☐ useUpdateDomainMutation()
   ☐ useDeleteDomainMutation()
   ☐ Proper invalidation tags

// 5. Update Components
☐ Find all components using old fetch patterns
☐ Replace with useDomainsQuery()
☐ Replace mutations with useDomainMutation()
☐ Remove manual refetch calls

// 6. Testing
☐ npm run typecheck (no errors)
☐ npm run lint (no warnings)
☐ Manual testing: navigation and cache behavior
```

---

## Timeline & Effort Estimate

| Phase | Domain | Effort | Impact | Notes |
|-------|--------|--------|--------|-------|
| 4a | Notes | 3-4 hours | HIGH | Core campaign feature |
| 4b | Characters | 4-5 hours | HIGH | Frequent access pattern |
| 4c | Combat | 3-4 hours | MEDIUM | Play-time only |
| 4d | Settings | 1-2 hours | LOW | Rarely changes |
| **Total** | **All** | **~12-15 hours** | **Massive UX improvement** | Can be done in 2-3 days |

---

## Expected Performance Gains

After implementing Phase 4a-4d:

✅ **Instant navigation**: Notes load from cache immediately on return
✅ **Seamless character viewing**: Character sheets appear instantly with background refresh
✅ **Smooth combat**: Initiative tracker doesn't lag even with rapid updates
✅ **Efficient settings**: Cached for entire session (24-hour stale time)
✅ **Auto-refetch on mutation**: No manual "Refresh" buttons needed
✅ **95%+ cache hit rate**: For all core data after first access

---

## Architecture Pattern (Template)

Use this template for each new domain:

### Database Layer

```typescript
// lib/database/domain.ts
import { QueryCache } from '../cache';
import { CACHE_KEYS, CACHE_TAGS } from '../cache/keys';

export const domainDB = {
  async getAll(worldId: string) {
    // Fetch from DB
    // Return data
  },

  async create(worldId: string, data: CreateData) {
    // Validate user
    // Insert to DB
    // Invalidate cache
    await QueryCache.invalidateByTags([
      CACHE_TAGS.domains,
      `world:${worldId}`
    ]);
    return data;
  },

  async update(worldId: string, id: string, updates: any) {
    // Validate user
    // Update in DB
    // Invalidate cache
    await QueryCache.invalidateByTags([
      CACHE_TAGS.domain(worldId, id)
    ]);
    return updated;
  },

  async delete(worldId: string, id: string) {
    // Validate user
    // Delete from DB
    // Invalidate cache
    await QueryCache.invalidateByTags([
      CACHE_TAGS.domains,
      `world:${worldId}`
    ]);
  }
}
```

### Query Hook

```typescript
// hooks/use-domain-query.tsx
import { useQuery } from '@/lib/cache';
import { domainDB } from '@/lib/database/domain';
import { CACHE_KEYS, CACHE_TAGS, CACHE_CONFIG } from '@/lib/cache/keys';

export function useDomainsQuery(worldId: string) {
  const { data, error, isLoading, refetch } = useQuery(
    CACHE_KEYS.domain.all(worldId),
    () => domainDB.getAll(worldId),
    {
      ...CACHE_CONFIG.userGenerated, // Use appropriate config
      tags: [CACHE_TAGS.domains, `world:${worldId}`],
    }
  );

  return {
    domains: data ?? [],
    isLoading,
    error,
    refetch,
  };
}
```

### Mutation Hook

```typescript
// hooks/use-domain-mutation.tsx
import { useMutation } from '@/lib/cache';
import { domainDB } from '@/lib/database/domain';
import { CACHE_TAGS } from '@/lib/cache/keys';

export function useCreateDomainMutation() {
  return useMutation(
    (variables: any) => domainDB.create(variables.worldId, variables.data),
    {
      invalidateTags: [CACHE_TAGS.domains, `world:${variables.worldId}`],
    }
  );
}
```

---

## Notes

- All cache keys are already defined in `lib/cache/keys.ts` (see `CACHE_KEYS` and `CACHE_TAGS`)
- All cache configurations are in `lib/cache/keys.ts` under `CACHE_CONFIG`
- Follow the pattern established in Phase 1-3 (worlds, users, invites)
- Remember to add cache invalidation to all mutations
- Test with `npm run typecheck && npm run lint` before committing

---

## References

- [Phase 1-3 Implementation](./CACHE_STRATEGY.md) - Completed phases
- [QueryCache Documentation](./CACHE_STRATEGY.md) - Core cache system
- [RequestManager Integration](./REQUEST_MANAGER_INTEGRATION.md) - Optional RequestManager usage
- [Network Error Handling](./OFFLINE_NETWORK_HANDLING.md) - Graceful degradation

---

**Created**: January 14, 2026  
**Status**: Out of Scope - Future Enhancement  
**Priority**: Phase 4a (Notes) recommended as first continuation
