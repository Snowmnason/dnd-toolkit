# Adaptive Payload Sizing - What Hasn't Been Done

**Issue:** #205  
**Phase:** 3+ (Future Work & Deferred Implementation)  
**Status:** Tracking remaining work for full feature completion

---

## Summary

The **client-side foundation** for adaptive payload sizing is complete. Clients can automatically request appropriately-sized payloads based on network quality. However, the **server-side support** and several **advanced features** remain unimplemented.

**What's Done:**
- ✅ Network quality detection (real-time, cross-platform)
- ✅ Quality tier mapping (4g→HD, 3g→SD, 2g→Thumb, offline→Text)
- ✅ RequestManager auto-injection of quality params
- ✅ Param→querystring conversion with existing query string handling
- ✅ Quality-aware cache keys (separate variants by quality)
- ✅ useQuery cachePriority modes (balanced/cacheFirst/networkFirst/offlineFirst)
- ✅ Auto-invalidation on quality changes
- ✅ Comprehensive documentation and testing guides

**What's NOT Done:**
- ❌ Server-side image variant generation
- ❌ Payload size reduction at server
- ❌ Progressive loading (incremental quality improvement)
- ❌ Manual override UI for power users
- ❌ Advanced analytics tracking
- ❌ Adaptive compression strategies
- ❌ Upload endpoint optimization
- ❌ End-to-end integration tests

---

## Tier 1: Critical Path (Server-Side Foundation)

These items are prerequisites for adaptive payloads to provide meaningful benefit.

### 1. Server-Side Image Variant Generation

**Current State:**
- Clients send: `?imageQuality=sd&excludeMaps=true`
- Servers receive params but ignore them
- Always return full payload (no benefit)

**What Needs to Be Done:**

#### 1a. Image Resizing & Storage Pipeline

Create automated image processing when assets uploaded:

```typescript
// On image upload
→ Store original (full resolution)
→ Generate variants:
   ├─ HD: 1920px wide (full quality)
   ├─ SD: 1024px wide (medium quality)
   ├─ Thumb: 256px wide (low quality)
   └─ Webp versions of each (for modern browsers)
→ Store all variants in object storage (R2 / S3 / supabase storage)
```

**Implementation Location:**
- Edge function: `supabase/functions/process-image-upload/`
- Or: Scheduled job: `lib/jobs/image-processing/`

**Scope:**
- Support common formats: JPEG, PNG, WebP
- Optimize for web: quality 75, JPEG progressive
- Store metadata: original size, variant sizes, upload timestamp

### 1b. Query Parameter Handling in API Endpoints

Update API endpoints to accept quality params and return sized payloads:

```kotlin
// Pseudocode: Database query accepting quality params
GET /api/worlds?imageQuality=sd&excludeMaps=true&summaryOnly=false

// Server flow:
→ Parse imageQuality param ('hd' | 'sd' | 'thumb' | 'text')
→ Query worlds table
→ For each world:
   ├─ Include full description if imageQuality >= 'sd'
   ├─ Include map data if imageQuality >= 'hd' AND !excludeMaps
   ├─ Use Thumb variant of images if imageQuality == 'thumb'
   └─ Exclude all images if imageQuality == 'text'
→ Return optimized payload
```

**Scope Per Endpoint:**

| Endpoint | Media Included | Quality Customization |
|----------|----------------|----------------------|
| `/api/worlds` | World image, maps | Quality → image size |
| `/api/worlds/:id` | World image, maps, asset list | Quality → included fields + image size |
| `/api/worlds/:id/characters` | Character images, portraits | Quality → portrait size |
| `/api/campaigns` | Campaign images, thumbnails | Quality → thumbnail size |
| `/api/encounters` | Monster images, map | Quality → image size |

### 1c. Payload Size Verification & Metrics

Track that server is actually reducing payloads:

```typescript
// Pseudo-implementation
const hdPayload = await fetch(`/api/worlds?imageQuality=hd`);
const sdPayload = await fetch(`/api/worlds?imageQuality=sd`);
const thumbPayload = await fetch(`/api/worlds?imageQuality=thumb`);

console.assert(
  sdPayload.size < hdPayload.size * 0.66,  // At least 33% reduction
  `SD payload not sufficiently smaller than HD`
);
console.assert(
  thumbPayload.size < hdPayload.size * 0.2,  // At most 20% of HD size
  `Thumb payload not sufficiently small`
);
```

**Success Criteria:**
- HD → SD: ≥33% size reduction
- HD → Thumb: ≥80% size reduction
- HD → Text: ≥99% size reduction (text only)

---

## Tier 2: Feature Enhancement (Advanced Capabilities)

Significant enhancements that compound the benefits of adaptive payloads.

### 2. Progressive Loading & Incremental Quality Improvement

**Current State:**
- Client requests full HD payload on 4G
- If interrupted during download (<500KB received), no fallback
- Switching to 2G requires full refetch

**What Needs to Be Done:**

#### 2a. Streaming Response Support

Allow clients to receive payloads in quality tiers:

```typescript
// Streaming: Client receives multiple quality versions

GET /api/worlds?imageQuality=streaming&includeVariants=true

Response (chunked):
Chunk 1: { worlds: [{ id, name, description }] }         // Text layer
Chunk 2: { worlds: [{ ..., image: thumb_base64 }] }      // Thumb variant
Chunk 3: { worlds: [{ ..., image: sd_base64 }] }         // SD variant
Chunk 4: { worlds: [{ ..., image: hd_base64 }] }         // HD variant

// Client processes each chunk:
→ Chunk 1: Show text immediately
→ Chunk 2: Upgrade images to thumbs
→ Chunk 3: Upgrade images to SD
→ Chunk 4: Upgrade images to HD (if complete)
```

**Implementation:**
- Server: respond with `Transfer-Encoding: chunked`
- Client: parse newline-delimited JSON (NDJSON)
- RequestManager: handle streaming responses in progress callback
- UI: incrementally update as chunks arrive

**Scope:**
- Images only (streaming full descriptions for slow connections adds little value)
- Supported on HTTP/2+ (requires server-side streaming support)

#### 2b. Progressive JPEG Support

Use progressive JPEG format for better perceived performance:

```
Standard JPEG: Progressive display from top→bottom as data arrives
Progressive JPEG: Blurry→gradually sharper as data arrives (same time, better UX)
```

**Implementation:**
- When generating image variants, save as progressive JPEG
- No client change needed; automatic improvement

### 2b. Cache-First Prefetch Strategy

Proactively fetch HD variants in background on good connections:

```typescript
// New behavior on 4G with stable connection
→ Fetch current quality (SD variant requested)
→ In background, start fetching HD variant
→ Cache HD for future upgrade

// If user on stable 4G, they get HD in cache
// If they switch to 2G, SD is already cached (fast!)
// If they switch back to 4G, HD is already cached
```

**Implementation:**
- Add `prefetchHigherQuality` option to useQuery
- On stable good connection, fetch one tier higher
- Store results in cache with same tags

---

## Tier 3: User Experience Enhancements

Quality-of-life features for developers and end-users.

### 3. Manual Quality Override UI

Allow power users to force HD/SD/Thumb regardless of connection:

```typescript
// Settings screen or developer tools
Quality Override: ○ Auto (default)  ○ HD (Force)  ○ SD  ○ Thumb

// When forced:
→ Fetch with overridden quality
→ Cache separately from auto-detected quality
→ Show indicator that override is active
```

**Implementation Location:**
- Settings screen: `app/settings/network-settings.tsx`
- Developer tools: Browser extension or in-app debug panel

**Scope:**
- Client-side override only (no server change needed)
- Update NetworkDetection hook to check override
- Clear override on app restart or explicit reset

### 3b. Quality Downgrade Indicators

Show user when content is being served in degraded quality:

```typescript
// UI component showing quality status
<QualityIndicator
  currentQuality="sd"
  optimalQuality="hd"
  connection="3g"
/>

Visual:
SD ⚠️ (Show toast: "Serving standard quality due to network")
HD ✓
```

**Implementation:**
- Component: `components/ui/QualityIndicator.tsx`
- Hook: `useAdaptivePayload()` provides current quality
- Toast: Show only when degraded (not on optimal quality)

### 3c. Network Quality Simulator

Like DevTools throttling, but for testing adaptive payloads in code:

```typescript
// In development: Override network detection
const { setSimulatedQuality } = useNetworkQualitySimulator();

setSimulatedQuality('2g');  // Force 2G for testing
setSimulatedQuality(null);  // Reset to real network

// Useful for:
// - Testing quality downgrade without actual poor connection
// - E2E test automation
// - Demo scenarios
```

**Implementation:**
- Add to NetworkDetection: `setSimulatedQuality()` (dev-only)
- Checkbox in Settings: "Simulate Poor Network"
- Stored in debug config (not persisted)

---

## Tier 4: Performance & Optimization

Advanced optimizations for production deployments.

### 4. Adaptive Compression Strategies

Vary compression levels based on quality tier:

```
HD: { quality: 85, progressive: true, optimize: false }
SD: { quality: 70, progressive: true, optimize: true }
Thumb: { quality: 50, progressive: false, optimize: true }
Text: { no images }
```

**Implementation:**
- When generating variants, apply tier-specific settings
- Document in image processing pipeline

### 4b. Per-Quality TTL in Cache

Different quality tiers have different cache durations:

```typescript
// HD: Longer TTL (changes less frequently, higher quality)
HD:    { staleTime: 24h, cacheTime: 7d }

// SD: Medium TTL
SD:    { staleTime: 12h, cacheTime: 3d }

// Thumb: Shorter TTL (lower resolution, change more often)
Thumb: { staleTime: 6h,  cacheTime: 1d }
```

**Implementation:**
- In useQuery, adjust staleTime based on quality tier
- Use `useAdaptivePayload()` to detect tier
- Pass different timemgs to cache based on tier

**Rationale:**
- HD takes longer to generate/process → longer TTL
- Thumb changes frequently → shorter TTL
- Reduces refetch rate for expensive operations

### 4c. CDN Cache Headers

Set appropriate `Cache-Control` headers per quality tier:

```http
GET /api/worlds?imageQuality=hd
Response Header: Cache-Control: public, max-age=86400  // 24h

GET /api/worlds?imageQuality=thumb
Response Header: Cache-Control: public, max-age=3600   // 1h
```

**Implementation:**
- Server middleware sets headers based on quality param
- CDN (Cloudflare, etc.) respects per-URL cache duration
- No client change needed (automatic CDN benefit)

---

## Tier 5: Analytics & Monitoring

Understanding real-world usage and impact.

### 5. Quality Distribution Tracking

Track what quality tiers users actually use:

```typescript
// Log when quality params are accepted
→ Quality tier: 'hd' | 'sd' | 'thumb' | 'text'
→ Connection type: 'wifi' | 'cellular' | 'unknown'
→ Device type: 'mobile' | 'tablet' | 'desktop'
→ Timestamp

// Analytics query: What % of requests are HD vs SD vs Thumb?
// Answer: Insights into network conditions of user base
```

**Implementation:**
- In RequestManager, log quality params to analytics
- Dashboard: Quality distribution pie chart
- Segment by platform (web, iOS, Android)

### 5b. Payload Size Impact Measurement

Track actual size reduction achieved:

```typescript
// For each quality tier:
→ Requested size (params sent)
→ Response size (bytes received)
→ Reduction % (SD vs HD, Thumb vs HD)
→ Time to first byte (TTFB)
→ User-perceived latency
```

**Implementation:**
- Capture `response.headers['content-length']`
- Track in analytics with quality tier
- Report: "Average SD payload is 45% smaller than HD"

### 5c. Network Condition Correlation

Correlate network quality with user experience:

```typescript
// Analyze:
→ Users on 2G complete tasks: X minutes
→ Users on 3G complete tasks: Y minutes
→ Users on 4G complete tasks: Z minutes

→ Do 2G users with thumb images have worse experience?
→ Do 4G users with HD images have better experience?
```

**Implementation:**
- Collect completion time + quality tier + connection
- Correlation analysis in dashboard
- Identify if adaptive payloads help or hurt UX

---

## Tier 6: Edge Cases & Robustness

Handling unusual scenarios and error conditions.

### 6. Server Doesn't Support Quality Params

Handle gracefully when server ignores quality params:

```typescript
// Server returns full payload despite quality=thumb request
→ Payload size: 5MB (not 500KB expected)
→ Client detection: Payload larger than expected

2 Strategies:
A) Accept full payload (server implementation incomplete)
   → Download anyway (will be slow on 2G)
   → Cache full data
   
B) Reject and fallback (strict mode)
   → Discard response
   → Serve cached data instead
   → Log error for debugging
```

**Implementation:**
- Add optional param validation in RequestManager
- Check response size vs expected size
- Log warning if mismatch detected

### 6b. Partial Download Interruption

Handle interrupted downloads mid-transfer:

```typescript
// User on 2G, downloading 500KB Thumb image
→ 100KB received, connection drops
→ Error (Network timeout)

Recovery:
→ Don't cache partial data
→ Serve stale cache if available
→ Try again with downgraded quality on retry
```

**Implementation:**
- RequestManager already handles retries
- No additional change needed (current behavior is correct)

### 6c. Quality Mismatch Between Params & Response

Server responds with unexpected quality:

```typescript
// Client requests: imageQuality=thumb (256px images)
// Server responds: imageQuality=hd (1920px images)

Detection:
→ Compare response metadata with request params
→ If mismatch, log warning
→ May need manual investigation

Handling:
→ Accept response (graceful fallback)
→ Don't cache with quality params (cache may be wrong)
→ Try different endpoint if available
```

**Implementation:**
- Add response validation in RequestManager
- Warn if quality in response ≠ quality in request
- Optional strict mode (fail fast)

---

## Tier 7: Alternative Implementations & Explorations

Approaches not yet pursued; may be valuable in future.

### 7. Server-Driven Quality Selection (vs Client-Driven)

**Current Approach:** Client detects quality, tells server what to send

**Alternative:** Server detects client capability, decides quality automatically

```typescript
// Alternative flow:
GET /api/worlds
Accept-Encoding: gzip, deflate
Accept: application/json, image/webp, image/jpeg

// Server inspects headers:
→ Has webp support? Use webp variants
→ Has http2? Stream response
→ Infer client capability
→ Server selects quality automatically
→ Return payload at server-chosen quality

Pros:
  - Server has more context (load, database capacity, etc.)
  - One request logic instead of per-client logic
  
Cons:
  - Server can't know client's actual network (only from headers)
  - More complex server logic
  - Less client control
```

**Status:** Deferred (current client-driven approach is simpler and sufficient)

### 7b. Compression-Based Quality Reduction (vs Format Reduction)

**Current Approach:** Different image sizes (1920px, 1024px, 256px)

**Alternative:** Same image size, different compression levels

```
HD: { format: jpeg, quality: 90 }     // 500KB
SD: { format: jpeg, quality: 60 }     // 200KB
Thumb: { format: jpeg, quality: 30 }  // 80KB
```

**Pros:**
  - Simpler to implement (single image stored)
  - Still allows significant size reduction

**Cons:**
  - Quality degradation visible (blurrier)
  - Less predictable file sizes
  - Harder to estimate bandwidth

**Status:** Deferred (size-based approach better for mobile UX)

### 7c. Machine Learning Quality Selection

Predict highest quality user's connection can handle:

```typescript
// Historical data for user:
→ Typical connection quality: 3g
→ Success rate for HD: 30%
→ Success rate for SD: 95%
→ Predicted best quality: SD

// Use prediction instead of real-time detection
Benefits:
  - No need for real-time detection
  - Accounts for user's typical network (not current spike)
```

**Status:** Too speculative (would need ML infrastructure; real-time detection sufficient)

---

## Implementation Effort Estimate

| Work | Effort | Priority | Blocker? |
|------|--------|----------|----------|
| **Server-side image variants** | 5 days | HIGH | Yes (feature useless without) |
| **API endpoint param handling** | 3 days | HIGH | Yes (requires server) |
| **Progressive loading (streaming)** | 4 days | MEDIUM | No (enhancement) |
| **Manual quality override UI** | 2 days | MEDIUM | No (nice-to-have) |
| **Quality downgrade indicators** | 1 day | LOW | No (cosmetic) |
| **Network simulator tool** | 2 days | LOW | No (dev tool) |
| **Advanced compression** | 2 days | LOW | No (optimization) |
| **Per-quality TTL caching** | 1 day | MEDIUM | No (optimization) |
| **Analytics tracking** | 3 days | MEDIUM | No (monitoring) |
| **Quality distribution dashboard** | 2 days | LOW | No (insights) |
| **E2E integration tests** | 3 days | MEDIUM | No (validation) |

**Total: ~28 days** of work remaining (after client-side foundation complete)

---

## Recommended Next Steps

1. **Immediate (Next Sprint):**
   - Server-side image variant generation pipeline
   - API endpoint updates to handle quality params
   - Payload size verification & metrics

2. **Near-term (Sprint After):**
   - Manual quality override UI
   - Quality downgrade indicators
   - End-to-end integration tests

3. **Future (Backlog):**
   - Progressive loading / streaming
   - Advanced analytics
   - Performance optimizations

---

## Known Limitations & Workarounds

### Limitation 1: Offline Quality
**Issue:** Offline mode only has text-only payload (no images)  
**Workaround:** Pre-download full HD payload when online, before going offline  
**Fix:** Implement background pre-fetch strategy (Tier 2.b)

### Limitation 2: Manual Quality Override
**Issue:** No UI to force HD for user who wants highest quality  
**Workaround:** Developer can disable NetworkDetection and set constant params  
**Fix:** Implement manual override UI (Tier 3.a)

### Limitation 3: Server Doesn't Downgrade
**Issue:** Server ignores quality params, always sends full payload  
**Workaround:** Set strict cache by quality (client-side de-duping) and hope server implements next
**Fix:** Implement server-side image variants (Tier 1)

### Limitation 4: Progressive JPEG Not Used
**Issue:** Progressive JPEG slower than baseline JPEG (slightly)  
**Workaround:** Accept standard JPEG (current implementation)  
**Fix:** Update image generation to progressive format (Tier 4.b)

---

## Success Metrics

When complete, this feature should achieve:

- ✅ Adaptive payloads reduce 2G bandwidth usage by 75%+
- ✅ 4G users see <500ms TTFB (time to first byte)
- ✅ 2G users see <5s TTFB
- ✅ Offline users can load cached data instantly
- ✅ Quality changes trigger auto-refetch within 1 second
- ✅ No perceptible quality difference between adaptive and full payload on appropriate tiers
- ✅ Server-side variant generation completes in <100ms
- ✅ Analytics show 40%+ users on 2G benefit from adaptive payloads

---

## Conclusion

The adaptive payload sizing foundation is **production-ready for client-side deployment**. However, to realize the full benefit (significant bandwidth savings), **server-side support is mandatory**. The remaining work focuses on server implementation, advanced features, and production hardening.

**Priority Order:**
1. Server-side image variants (blocking feature)
2. API endpoint quality param handling (blocking feature)
3. Manual override & better UX (nice-to-have)
4. Advanced analytics (monitoring)

