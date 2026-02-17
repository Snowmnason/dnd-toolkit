# Adaptive Payload Sizing - Usage Guide

**Issue:** #205  
**Phase:** 3 (Usage Guide & Integration)  
**Status:** Implementation guidance for integrating adaptive payloads into real query hooks

---

## When to Use

Use adaptive payload sizing for:
- **Heavy media endpoints:** Maps, images, profiles with embedded media
- **Large list payloads:** User lists, character lists with metadata
- **Detailed resource endpoints:** Worlds, campaigns, notes with full descriptions and attachments
- **Any query that includes optional fields:** Details can be excluded on poor connections

Do NOT use for:
- **Small metadata:** User IDs, names, timestamps
- **Boolean/status queries:** Data that can't be meaningfully reduced
- **Authentication endpoints:** Always fetch full results
- **Server-critical operations:** Where degraded data could cause consistency issues

---

## Integration Checklist

### 1. Setup Phase (Already Done)
- ✅ NetworkDetection system (connection quality detection)
- ✅ `lib/network/adaptive-payload.ts` (quality → options mapping)
- ✅ `hooks/network/use-adaptive-payload.ts` (UI awareness hook)
- ✅ `hooks/network/useAdaptivePayloadCacheInvalidation.ts` (auto-invalidate on quality change)

### 2. Add Adaptive Params to RequestManager Calls

When using `RequestManager.fetch()` with HTTP-like URLs or explicit params:

**Option A: Auto-inject (default for HTTP URLs)**
```typescript
// Adaptive params injected automatically for HTTP URLs
const data = await RequestManager.fetch(
  'https://api.example.com/worlds',
  () => fetch(url).then(r => r.json()),
  {
    useAdaptiveParams: true, // Explicit enable (default for HTTP)
    useQueryCache: true,
  }
);
```

**Option B: Manual params**
```typescript
// Pass explicit params (merged with auto-injected adaptive params)
const data = await RequestManager.fetch(
  '/api/worlds',
  () => worldsAPI.getWorlds(),
  {
    params: { page: 1, limit: 20 },
    useAdaptiveParams: true,
    useQueryCache: true,
  }
);
```

**Option C: Disable auto-injection (for internal cache keys)**
```typescript
// For internal cache keys like 'worlds:list', don't auto-inject
const data = await RequestManager.fetch(
  'worlds:list',
  () => worldsDB.getAll(),
  {
    useAdaptiveParams: false, // Explicitly disable
    useQueryCache: true,
  }
);
```

### 3. Update Query Hooks

Update existing hooks to pass adaptive params (or rely on RequestManager auto-injection):

**Before:**
```typescript
export function useWorldsQuery() {
  return useQuery(
    'worlds:list',
    () => worldsDB.getMyWorlds(),
    { tags: ['worlds'] }
  );
}
```

**After Option A (No changes if using RequestManager):**
RequestManager automatically injects params for HTTP URLs. If database directly called, no changes needed yet.

**After Option B (Explicit quality awareness):**
```typescript
import { useAdaptivePayload } from '@/hooks/network/use-adaptive-payload';
import { getQualityAwareCacheKey } from '@/lib/network/adaptive-payload-integration';

export function useWorldsQuery() {
  // Use quality-aware cache key (separate cache per quality tier)
  const queryKey = getQualityAwareCacheKey({
    baseCacheKey: 'worlds:list',
    cacheTagsToInvalidate: ['worlds'],
  });

  return useQuery(
    queryKey,
    () => RequestManager.fetch(
      `worlds:list`,
      () => worldsDB.getMyWorlds(),
      {
        useQueryCache: true,
        useAdaptiveParams: true, // RequestManager injects adaptive params if HTTP
      }
    ),
    { tags: ['worlds'] }
  );
}
```

**After Option C (Advanced - with explicit adaptive params):**
```typescript
import { useAdaptivePayload } from '@/hooks/network/use-adaptive-payload';
import { buildAdaptiveQueryParams } from '@/lib/network/adaptive-payload';

export function useWorldsQuery() {
  const { payloadOptions } = useAdaptivePayload();
  const adaptiveParams = buildAdaptiveQueryParams(payloadOptions);

  const queryKey = getQualityAwareCacheKey({
    baseCacheKey: `worlds:list`,
    cacheTagsToInvalidate: ['worlds'],
  });

  return useQuery(
    queryKey,
    () => RequestManager.fetch(
      `/api/worlds`,
      () => worldsAPI.getWorlds(),
      {
        params: adaptiveParams,
        useQueryCache: true,
        useAdaptiveParams: true,
      }
    ),
    { tags: ['worlds'] }
  );
}
```

### 4. Subscribe to NetworkDetection for Cache Invalidation

Add cache invalidation hook to any screen that displays adaptive-aware data:

```typescript
import { useAdaptivePayloadCacheInvalidation } from '@/hooks/network/useAdaptivePayloadCacheInvalidation';

export function WorldsList() {
  // Invalidate cache when network quality changes
  useAdaptivePayloadCacheInvalidation({
    tagsToInvalidate: ['worlds', 'characters', 'campaigns'],
  });

  const { worlds, isLoading } = useWorldsQuery();

  return (
    <>
      {worlds.map(w => <WorldCard key={w.id} world={w} />)}
    </>
  );
}
```

### 5. Test with Network Throttling

**Web (Chrome DevTools):**
1. Open DevTools → Network tab
2. Throttling dropdown → Select "Slow 3G" or "Offline"
3. Reload page
4. Check Network tab → Query params should include `imageQuality=thumb`, `excludeMaps=true`, etc.

**iOS:**
- Xcode Network Link Conditioner tool
- Or test on cellular network

**Android:**
- Developer Options → Simulate networks
- Or test on actual mobile network

---

## Debugging

### Check Current Network Quality

```typescript
import { useAdaptivePayload } from '@/hooks/network/use-adaptive-payload';

function DebugNetworkStatus() {
  const { networkStatus, payloadOptions } = useAdaptivePayload();

  return (
    <div>
      <p>Connection: {networkStatus?.effectiveType}</p>
      <p>Quality: {payloadOptions.imageQuality}</p>
      <p>Include Maps: {payloadOptions.includeMaps}</p>
      <p>Detail Level: {payloadOptions.includeDetails ? 'Full' : 'Summaries'}</p>
    </div>
  );
}
```

### Inspect Network Params

Open browser DevTools → Network tab:
- Query on 4G should have: `imageQuality=hd` (or no param if default)
- Query on 2G should have: `imageQuality=thumb&summaryOnly=true&excludeMaps=true`

### Monitor Cache Keys

Check that different qualities are cached separately:

```typescript
// After fetching on 4G then 2G, both should exist in cache
RequestManager.fetch(...) → cached as key with imageQuality=hd
RequestManager.fetch(...) → cached as key with imageQuality=thumb
// Different URLs = different cache entries = no serving wrong quality
```

### Verify Offline Behavior

1. Offline (DevTools → Offline or Developer Options)
2. Try to load worlds
3. Should get text-only payload (no images, no maps)
4. RequestManager queues request to offline queue
5. On reconnect, resyncs with full adaptive params

---

## Troubleshooting

### Issue: Requests Still Timeout on 2G

**Cause:** Server doesn't support quality params (ignores them)  
**Solution:** Implement server-side image resizing/variant support (see Issue #XXX - Server-Side Image Variants)

**Cause:** Client not sending quality params  
**Solution:** 
- Check: `useAdaptiveParams: true` is set in RequestManager call
- Check: URL is HTTP-like (starts with `http` or `/`) for auto-inject
- Check: Network quality detected correctly (use DebugNetworkStatus)

### Issue: Wrong Quality Served from Cache

**Cause:** Cache key doesn't include quality tier  
**Solution:** Use `getQualityAwareCacheKey()` helper to include quality in key

### Issue: Maps Still Show on 2G

**Cause:** API endpoint doesn't support `excludeMaps` param  
**Solution:** 
- Check server implementation for param support
- Implement server support if missing
- Can manually check `payloadOptions.includeMaps` in UI as fallback

### Issue: Cache Not Invalidating on Quality Change

**Cause:** `useAdaptivePayloadCacheInvalidation` hook not called  
**Solution:** Add hook to screen/component that displays adaptive data

**Cause:** Incorrect tags in invalidation  
**Solution:** Ensure `tagsToInvalidate` matches cache key tags (e.g., 'worlds', 'characters')

---

## Performance Tips

### 1. Quality-Specific Caching
Use quality-aware cache keys so HD and SD versions don't conflict:
```typescript
const key = getQualityAwareCacheKey({
  baseCacheKey: 'worlds:list',
  cacheTagsToInvalidate: ['worlds'],
});
// Results in keys like: worlds:list:4g, worlds:list:2g, worlds:list:offline
```

### 2. Graceful Server Fallback
RequestManager automatically appends quality params. Server gracefully ignores unknown params:
```
GET /api/worlds?imageQuality=sd&excludeMaps=true
↓
Server doesn't support params?
↓
Returns full quality (same as before)
```

### 3. Avoid Redundant Layers
Don't pass adaptive params twice:
```typescript
// ❌ WRONG: Both RequestManager and manual params
RequestManager.fetch(url, fetcher, {
  params: buildAdaptiveQueryParams(...),
  useAdaptiveParams: true, // Already inject!
});

// ✅ CORRECT: Let RequestManager inject
RequestManager.fetch(url, fetcher, {
  useAdaptiveParams: true, // Automatic injection
});

// ✅ ALSO CORRECT: Explicit if you added other params
RequestManager.fetch(url, fetcher, {
  params: { limit: 20, ...adaptiveParams },
  useAdaptiveParams: false, // Don't double-inject
});
```

---

## Related Issues

- **#206 - Network Offline Queue:** Offline mutations use reduced payloads
- **#208 - Network Telemetry:** Track quality-tier distribution and timeout rates
- **#XXX - Server-Side Image Variants:** Implement server-side resizing for quality params
- **#191 - Cache Revalidation Strategies:** Background refresh patterns

---

## Future Enhancements

- Manual quality override (dev/debug)
- Progressive image loading (fine-grained resolution increases)
- Adaptive compression (reduce image quality beyond just resolution)
- Edge function image resizing (server-side variant generation)
- Metrics dashboard (timeout rates by quality tier)

