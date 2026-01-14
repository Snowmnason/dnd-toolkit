/**
 * Cache Key Constants
 *
 * Centralized cache key patterns following hierarchical naming convention:
 * domain:entity:action:identifier
 *
 * This file makes cache keys predictable, prevents collisions, and enables
 * efficient pattern-based invalidation and debugging.
 */

/**
 * World-related cache keys
 */
export const CACHE_KEYS = {
  // World queries
  worlds: {
    all: 'worlds:list',
    owned: 'worlds:list:owned',
    forUser: (userId: string) => `worlds:user:${userId}`,
    forUserOwned: (userId: string) => `worlds:user:${userId}:owned`,
    details: (worldId: string) => `world:${worldId}:details`,
    members: (worldId: string) => `world:${worldId}:members`,
    invites: (worldId: string) => `world:${worldId}:invites`,
  },

  // Note queries
  notes: {
    all: (worldId: string) => `world:${worldId}:notes`,
    forWorldAndUser: (worldId: string, userId: string) =>
      `world:${worldId}:notes:user:${userId}`,
    details: (worldId: string, noteId: string) =>
      `world:${worldId}:note:${noteId}:details`,
    versions: (worldId: string, noteId: string) =>
      `world:${worldId}:note:${noteId}:versions`,
  },

  // Character queries
  characters: {
    all: (worldId: string) => `world:${worldId}:characters`,
    details: (worldId: string, characterId: string) =>
      `world:${worldId}:character:${characterId}:details`,
    sheet: (worldId: string, characterId: string) =>
      `world:${worldId}:character:${characterId}:sheet`,
  },

  // User queries
  users: {
    current: 'users:current',
    details: (userId: string) => `user:${userId}:details`,
    profile: (userId: string) => `user:${userId}:profile`,
    preferences: (userId: string) => `user:${userId}:preferences`,
  },

  // Invite queries
  invites: {
    forWorld: (worldId: string) => `world:${worldId}:invites:list`,
    validate: (token: string) => `invites:validate:${token}`,
  },

  // Session queries (transient)
  session: {
    activeWorld: 'session:active-world',
    activeCharacter: 'session:active-character',
    draftWorldCreate: 'session:draft:world-create',
    draftNoteCreate: (worldId: string) =>
      `session:draft:note-create:world:${worldId}`,
  },

  // System/reference data
  system: {
    definitions: 'system:definitions',
    spellList: 'system:spells',
    classesAndRaces: 'system:classes-races',
  },
} as const;

/**
 * Cache Tags
 *
 * Tags enable efficient bulk invalidation. Use these tags when caching
 * and mutating data.
 */
export const CACHE_TAGS = {
  // Domain tags
  worlds: 'worlds',
  notes: 'notes',
  characters: 'characters',
  users: 'users',
  invites: 'invites',
  system: 'system',

  // Entity-specific tags
  world: (worldId: string) => `world:${worldId}`,
  note: (worldId: string, noteId: string) =>
    `world:${worldId}:note:${noteId}`,
  character: (worldId: string, characterId: string) =>
    `world:${worldId}:character:${characterId}`,
  user: (userId: string) => `user:${userId}`,

  // Feature tags
  worldMembers: (worldId: string) => `world:${worldId}:members`,
  worldInvites: (worldId: string) => `world:${worldId}:invites`,

  // User-scoped tags
  userWorlds: (userId: string) => `user:${userId}:worlds`,
  userOwnedWorlds: (userId: string) => `user:${userId}:worlds:owned`,

  // Session tags
  session: 'session',
  realtime: 'realtime',
} as const;

/**
 * Invalidation Patterns
 *
 * Regex patterns for pattern-based invalidation when tag-based
 * invalidation isn't sufficient.
 *
 * Note: These functions construct RegExp from runtime identifiers,
 * which is necessary for pattern-based cache invalidation.
 */
export const INVALIDATION_PATTERNS = {
  // All world data
  allWorlds: /^world:.*/,

  // All data for a specific world
  // eslint-disable-next-line security/detect-non-literal-regexp
  worldData: (worldId: string) => new RegExp(`^world:${worldId}:`),

  // All data for a specific user
  // eslint-disable-next-line security/detect-non-literal-regexp
  userData: (userId: string) => new RegExp(`^user:${userId}:`),

  // All notes in a world
   
  worldNotes: (worldId: string) =>
    new RegExp(`^world:${worldId}:note(s)?:`),

  // All characters in a world
   
  worldCharacters: (worldId: string) =>
    new RegExp(`^world:${worldId}:character(s)?:`),

  // All session data
  sessionData: /^session:/,
} as const;

/**
 * Cache Configuration Presets
 *
 * Predefined staleness and cache times for different data types.
 * Use these to maintain consistency across queries.
 */
export const CACHE_CONFIG = {
  // Realtime data: presence, chat, active sessions
  realtime: {
    staleTime: 30 * 1000, // 30 seconds
    cacheTime: 5 * 60 * 1000, // 5 minutes
  },

  // Near-realtime: character positions, health, active state
  nearRealtime: {
    staleTime: 10 * 1000, // 10 seconds
    cacheTime: 1 * 60 * 1000, // 1 minute
  },

  // User-generated content: notes, character data, world settings
  userGenerated: {
    staleTime: 15 * 60 * 1000, // 15 minutes
    cacheTime: 1 * 60 * 60 * 1000, // 1 hour
  },

  // Metadata: world names, descriptions, ownership
  metadata: {
    staleTime: 2 * 60 * 60 * 1000, // 2 hours
    cacheTime: 4 * 60 * 60 * 1000, // 4 hours
  },

  // Reference data: maps, system definitions, static content
  reference: {
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    cacheTime: 7 * 24 * 60 * 60 * 1000, // 7 days
  },

  // Temporary/session data: drafts, ui state
  session: {
    staleTime: 30 * 60 * 1000, // 30 minutes
    cacheTime: 1 * 60 * 60 * 1000, // 1 hour
  },
} as const;

/**
 * Helper Functions
 */

/**
 * Get cache config for a data type
 *
 * @param dataType - The cache data type (realtime, userGenerated, metadata, reference, session)
 * @returns Cache configuration with staleTime and cacheTime
 */
export function getCacheConfig(
  dataType: keyof typeof CACHE_CONFIG
): {
  staleTime: number;
  cacheTime: number;
} {
  // eslint-disable-next-line security/detect-object-injection
  return CACHE_CONFIG[dataType];
}

/**
 * Create world-specific invalidation tags
 */
export function getWorldInvalidationTags(worldId: string): string[] {
  return ['worlds', CACHE_TAGS.world(worldId)];
}

/**
 * Create user-specific invalidation tags
 */
export function getUserInvalidationTags(userId: string): string[] {
  return ['users', CACHE_TAGS.user(userId)];
}

/**
 * Create tags for invalidating world members/invites
 */
export function getWorldAccessInvalidationTags(worldId: string): string[] {
  return [
    CACHE_TAGS.worldMembers(worldId),
    CACHE_TAGS.worldInvites(worldId),
  ];
}
