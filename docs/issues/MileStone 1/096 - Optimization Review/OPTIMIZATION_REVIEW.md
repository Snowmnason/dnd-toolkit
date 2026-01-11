# Optimization Review - Issue #96

## Summary

After a comprehensive review of the codebase, existing Milestone 1 completed work, and open issues, here is my analysis of potential **major** optimization opportunities for future development.

## Already Completed (Milestone 1) ✅

The following optimizations are already implemented and working well:

| Feature | Location | Status |
|---------|----------|--------|
| API Request Layer & Auth Caching | `lib/api/request-manager.ts` | ✅ Complete |
| Central Secure Storage | `lib/storage/SecureStorage.ts` | ✅ Complete |
| Navigation System | `lib/navigation/navigation-config.ts` | ✅ Complete |
| Image Loading Optimization | `components/ui/LazyImage.tsx` | ✅ Complete |
| Performance Monitoring | `lib/analytics/` | ✅ Complete |
| Global Error Boundary | `lib/error/ErrorBoundary.tsx` | ✅ Complete |
| Premium Feature Flags | `lib/feature-flags.ts` | ✅ Complete |
| Dev/Prod Separation | `config/appsettings.*.json` | ✅ Complete |

## Already in Open Issues (Avoid Duplication) 🚫

These items are already tracked in open issues:
- **#26**: Offline Mode Foundation (Caching & Sync Queue)
- **#27**: Local Data Cache
- **#29**: useWorlds Pagination/SWR/Optimistic Updates
- **#48**: Force Refresh Option
- **#59**: Remote Config for Feature Flags
- **#32**: Real-time Collaboration & Presence
- **#70**: Local Analytics Buffer for Offline

## Potential Major Optimization Opportunities 🎯

### 1. Bundle Size Optimization & Code Splitting ⭐⭐⭐

**Impact**: HIGH | **Complexity**: MEDIUM | **Many File Changes**: YES

**Problem**: The current codebase imports many features eagerly at startup, increasing initial bundle size and load time.

**Current State**:
- `app/_layout.tsx` imports Sentry statically
- `index.tsx` loads Skia synchronously before React
- Theme families are all loaded at startup
- All route screens are bundled together

**Proposed Solution**:
- Implement route-based code splitting with Expo Router's lazy loading
- Dynamic import heavy libraries (Sentry, Skia, theme families)
- Add bundle analyzer to CI for monitoring
- Create a `lib/lazy-imports.ts` utility for consistent dynamic imports

**Files Affected**: ~15-20 files (layouts, index, heavy component imports)

**Example Pattern**:
```typescript
// lib/lazy-imports.ts
// Lazy load heavy libraries to reduce initial bundle size
// These are imported on-demand rather than at startup
export const loadSentry = () => import('@sentry/react-native');
export const loadSkia = () => import('@shopify/react-native-skia');

// Usage in _layout.tsx
useEffect(() => {
  if (isSentryEnabled) {
    loadSentry().then(Sentry => Sentry.init({...}));
  }
}, []);
```

---

### 2. Context Optimization & State Colocation ⭐⭐⭐

**Impact**: MEDIUM-HIGH | **Complexity**: MEDIUM | **Many File Changes**: YES

**Problem**: Multiple nested contexts in `_layout.tsx` can cause unnecessary re-renders across the entire app when any context changes.

**Current State**:
```tsx
<ThemeProvider>
  <ScaleProvider>
    <PlatformProvider>
      <SubscriptionProvider>
        <AppParamsProvider>
```

**Proposed Solution**:
- Split contexts into "stable" (rarely changing) vs "volatile" (frequently changing)
- Use context selector patterns to prevent unnecessary re-renders
- Memoize context values properly with `useMemo`
- Consider lightweight state library (zustand/jotai) for frequently-updated state

**Files Affected**: ~20-30 files (contexts, providers, hooks using contexts)

**Example Pattern**:
```typescript
// Split AppParamsContext
// contexts/AppParamsReadContext.tsx - stable, rarely changes
// contexts/AppParamsWriteContext.tsx - methods that don't trigger re-renders

// Or use selector pattern (conceptual - requires external store implementation)
// subscribe, getSnapshot, getServerSnapshot would be provided by the store
export function useAppParamsSelector<T>(selector: (params: AppParams) => T): T {
  // useSyncExternalStoreWithSelector from 'use-sync-external-store/shim/with-selector'
  return useSyncExternalStoreWithSelector(
    store.subscribe, store.getSnapshot, store.getServerSnapshot, selector
  );
}
```

---

### 3. Query Cache with Invalidation Patterns ⭐⭐⭐

**Impact**: HIGH | **Complexity**: MEDIUM | **Many File Changes**: YES

**Problem**: The `RequestManager` provides request-level deduplication but lacks smart query invalidation when mutations occur.

**Current State**:
- `useWorlds` has basic deduplication but no invalidation after `worldsDB.create()`
- Each hook manages its own cache logic independently
- No stale-while-revalidate (SWR) pattern for data freshness
  - SWR: Return cached data immediately, then fetch fresh data in background and update

**Proposed Solution**:
- Create a `QueryCache` layer with invalidation patterns
- Implement SWR (stale-while-revalidate) at the query level
- Add mutation hooks that auto-invalidate related queries
- Lightweight pattern similar to TanStack Query

**Files Affected**: ~15-25 files (database hooks, new query cache module)

**Example Pattern**:
```typescript
// lib/cache/query-cache.ts
export const QueryCache = {
  get(key: string): CachedData | null,
  set(key: string, data: any, options: CacheOptions): void,
  invalidate(pattern: string | RegExp): void,
  invalidateByTags(tags: string[]): void,
};

// lib/database/worlds.ts
async create(data: CreateWorldData): Promise<World> {
  const result = await supabase.from('worlds').insert(data);
  QueryCache.invalidateByTags(['worlds', `user:${currentUserId}`]);
  return result;
}
```

---

### 4. Hermes Engine Verification & Optimization ⭐⭐

**Impact**: HIGH (native only) | **Complexity**: LOW | **Many File Changes**: NO

**Problem**: Hermes engine provides significant performance benefits but needs verification that it's properly enabled and optimized.

**Benefits**:
- Faster app startup (bytecode pre-compilation)
- Reduced memory usage (up to 50%)
- Better garbage collection

**Proposed Solution**:
- Verify Hermes is enabled in `app.json` / EAS config
- Enable Hermes bytecode compilation in production builds
- Add startup time metrics to measure improvement

**Files Affected**: 2-3 files (app.json, eas.json, metrics)

---

### 5. Service Worker for Web PWA ⭐

**Impact**: MEDIUM | **Complexity**: HIGH | **Many File Changes**: YES

**Problem**: Web builds lack offline capabilities and PWA features.

**Proposed Solution**:
- Implement service worker with Workbox
- Pre-cache critical assets (fonts, images, JS bundles)
- Runtime caching for API responses
- Background sync for offline mutations

**Note**: This is complex and web-only. Consider deferring until offline mode (#26) is complete.

---

## Recommendations

### Top 3 Priorities for Future Major Optimizations:

1. **Bundle Size Optimization** - Most impactful for initial load time, affects all platforms
2. **Query Cache with Invalidation** - Better data consistency and reduces bugs
3. **Context Optimization** - Reduces unnecessary re-renders, improves perceived performance

### Defer (Lower Priority):

- **Service Worker** - Complex, web-only, wait for offline mode foundation
- **Memory Management** - Existing safeguards adequate for MVP

### Quick Win:

- **Hermes Verification** - Low effort, high native performance impact

## Conclusion

The Milestone 1 optimizations have created a solid foundation. The suggested improvements would further enhance the app's performance and developer experience, particularly:

- **Bundle optimization** would improve first load time significantly
- **Query caching** would make data handling more predictable and efficient
- **Context optimization** would reduce React re-renders across the app

These are "major" optimizations in that they touch many files and create reusable patterns/hooks that would be used throughout the codebase.
