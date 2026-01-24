# Data Caching & Persistence Policy

## Overview

This document defines the standardized caching and persistence rules for the app foundation. It ensures consistent behavior across all data types and prevents each feature from inventing its own caching semantics. This policy applies to all apps built on this foundation.

## Persistence Hierarchy

Data flows through three layers in order of speed and persistence:

1. **Memory Cache** (`QueryCache`) - Fast, volatile, app-session only
2. **Disk Cache** (`FastCache`) - Persistent across app restarts, unencrypted
3. **Secure Storage** (`SecureStorage`) - Encrypted, persistent, cross-platform

## Default TTLs (Time To Live)

### Memory Cache (QueryCache)

- **Default staleTime:** 2 hours (data is considered fresh)
- **Default cacheTime:** 4 hours (data is kept in memory)
- **Max entries:** 1000 (prevents unbounded growth)

### Disk Cache (FastCache)

- **User data:** 24 hours
- **App configuration:** 7 days
- **Static assets:** 30 days
- **API responses:** 1 hour

### Secure Storage (Encrypted)

- **Auth tokens:** Until logout or expiration
- **User preferences:** Indefinite (survives app updates)
- **Sensitive data:** Until explicitly cleared

## Invalidation Rules

### Automatic Invalidation

- **Network status change:** Clear stale API responses
- **App version update:** Clear incompatible cached data (via cache versioning)
- **Memory pressure:** LRU eviction in QueryCache

### Manual Invalidation

- **Logout:** Clear all user-related data from all layers
- **Account deletion:** Clear all user data and reset to defaults
- **Feature flag change:** Clear affected cached data

### Tag-Based Invalidation

Use tags for related data invalidation:

- `user:*` - All user data
- `world:*` - World-specific data
- `api:*` - API responses

## Stale-While-Revalidate (SWR) Pattern

For API data:

1. Return stale data immediately if available
2. Fetch fresh data in background
3. Update cache when fresh data arrives
4. Notify subscribers of updates

## Cache Versioning & Migration

- **Current version:** 1
- **Breaking changes:** Increment `CURRENT_CACHE_VERSION` in `lib/storage/cache-versioning.ts`
- **Migration strategy:** Attempt migration first, reset on failure
- **Validation:** All cached data validated on app startup

## Data Classification

### Memory-Only (Never Persisted)

- UI state, form inputs, temporary selections

### Disk Cache (Unencrypted)

- Non-sensitive API responses, app config, static assets

### Secure Storage (Encrypted)

- User credentials, personal data, auth tokens, preferences

## Implementation Guidelines

### For New Features

1. Choose appropriate layer based on sensitivity and lifetime
2. Use consistent TTLs from this policy
3. Add proper tags for invalidation
4. Handle cache misses gracefully
5. Log cache hits/misses for monitoring

### For API Calls

```typescript
// Example: Cache user profile with SWR
const userData = await queryCache.getOrFetch(
  "user:profile",
  () => api.getUserProfile(),
  {
    staleTime: 30 * 60 * 1000, // 30 minutes
    cacheTime: 2 * 60 * 60 * 1000, // 2 hours
    tags: ["user:profile"],
  },
);
```

### For Sensitive Data

```typescript
// Always use SecureStorage for sensitive data
await secureStorage.setItem("user:authToken", token);
```

## Monitoring & Debugging

- Cache hit/miss ratios logged via `logger.category('cache')`
- Cache size and entry counts available via diagnostics
- Invalid entries automatically cleaned on startup

## Future Considerations

- Add compression for large cached data
- Implement cache warming for critical data
- Add offline queue for failed writes
- Consider CDN integration for static assets
