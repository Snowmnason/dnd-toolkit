# Image Optimization - Architecture & Implementation

## System Architecture

```
LazyImage Component
├── useViewportTracking Hook
│   ├── Web: Intersection Observer API
│   └── Native: Immediate load (can extend with viewport tracking)
├── useImageCache Hook
│   ├── In-memory cache (50MB max, 1hr TTL)
│   └── Auto-cleanup on expired entries
├── Image Optimization Utils
│   ├── Supabase URL transformation
│   ├── Responsive srcset generation
│   ├── WebP detection
│   └── Image size calculations
└── ImageSkeleton Component
    └── Reanimated v4 pulsing animation
```

## Component Implementations

### LazyImage.tsx

Enhanced `expo-image` component with lazy loading and optimization features.

**Key Props:**
- Lazy loading: `threshold`, `rootMargin`
- Optimization: `optimizeSupabase`, `optimizeWidth`, `optimizeQuality`
- Advanced: `responsive`, `useWebP`, `cacheStrategy`, `prefetch`

**Internal Flow:**
1. Component mounts
2. Hook mounts - check WebP support
3. useViewportTracking triggers image load when in view
4. Image optimization applied (Supabase params, WebP, responsive)
5. Image loads with cache strategy
6. Skeleton hidden, image fades in
7. Image cached if strategy allows

### useViewportTracking Hook

Detects when component enters viewport:

```tsx
// Web: Uses Intersection Observer
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      setIsInView(true)
      observer.disconnect()
    }
  })
})

// Native/Fallback: Loads immediately
if (!window.IntersectionObserver) {
  setIsInView(true)
}
```

Returns:
- `ref` - Attach to container
- `isInView` - Currently visible
- `hasLoaded` - Visibility detected once

### useImageCache Hook

In-memory cache with automatic expiration:

```tsx
class ImageCache {
  private cache: Map<string, ImageCacheEntry>
  private maxSize: 50MB
  private ttl: 1 hour
  
  set(key, data, sizeBytes)
  get(key)
  cleanExpired()
}
```

Features:
- LRU eviction when max size exceeded
- Auto-cleanup of expired entries
- Per-entry size tracking
- Global singleton instance

### ImageSkeleton Component

Animated placeholder using react-native-reanimated v4:

```tsx
const opacity = useSharedValue(0.3)

useEffect(() => {
  opacity.value = withRepeat(
    withSequence(
      withTiming(0.7, { duration: 1000 }),
      withTiming(0.3, { duration: 1000 })
    ),
    -1
  )
})
```

## Utility Functions

### image-optimization.ts

#### optimizeSupabaseImage(url, options)

Adds Supabase transformation parameters:

```tsx
const url = 'https://abc.supabase.co/storage/v1/object/public/maps/world.jpg'
const optimized = optimizeSupabaseImage(url, {
  width: 1200,
  quality: 85,
  format: 'webp'
})
// Returns: ...world.jpg?width=1200&quality=85&format=webp
```

#### generateResponsiveSrcset(url, widths)

Creates srcset for responsive images:

```tsx
const srcset = generateResponsiveSrcset(url, [400, 800, 1200])
// Generates separate optimized URL for each width
// Returns: "url?width=400... 400w, url?width=800... 800w, ..."
```

#### supportsWebP()

Async detection of WebP browser support:

```tsx
const supported = await supportsWebP()
if (supported) {
  // Use WebP format
}
```

Uses image loading test:
```tsx
const img = new Image()
img.src = 'data:image/webp;base64,...'
img.onload = () => resolve(img.height === 2)
```

## Performance Optimizations

### 1. Lazy Loading

**Benefit**: Reduces initial load time
- Only visible images loaded
- ~60% faster initial page load
- Configurable visibility threshold

### 2. Image Resizing

**Benefit**: Reduces file size by 50-70%
- Supabase handles resize server-side
- Quality adjustable per use case
- Responsive widths for different devices

### 3. WebP Format

**Benefit**: 25-35% smaller than JPEG
- Automatic detection
- Graceful fallback to original
- Transparent fallback option

### 4. Caching

**Benefit**: Instant reload on repeated views
- In-memory cache with TTL
- Disk cache via expo-image
- LRU eviction for memory management

### 5. Prefetch

**Benefit**: Instant display on navigation
- Background loading before view change
- Cache warm on predicted navigation
- No blocking of main thread

### 6. Skeleton Loading

**Benefit**: Improves perceived performance
- Smooth pulsing animation
- Matches final image dimensions
- Theme-aware colors

## Code Examples

### Adding LazyImage to a Component

```tsx
import { LazyImage } from '@/components/ui'

export function WorldCard({ world }: { world: World }) {
  return (
    <LazyImage
      src={world.map_image_url}
      fallbackSrc={require('@/assets/default-map.png')}
      width="100%"
      height={300}
      borderRadius={12}
      optimizeSupabase
      optimizeWidth={600}
      optimizeQuality={85}
      responsive
      useWebP
      cacheStrategy="memory-disk"
    />
  )
}
```

### Using Prefetch for Navigation

```tsx
import { usePrefetchImage } from '@/hooks/use-image-cache'

export function WorldList({ worlds }: { worlds: World[] }) {
  const prefetch = usePrefetchImage()

  return (
    <FlatList
      data={worlds}
      renderItem={({ item, index }) => (
        <TouchableOpacity
          onMouseEnter={() => {
            // Prefetch next world
            if (index + 1 < worlds.length) {
              prefetch(worlds[index + 1].map_image_url)
            }
          }}
        >
          <LazyImage 
            src={item.map_image_url}
            prefetch={true}
          />
        </TouchableOpacity>
      )}
    />
  )
}
```

### Custom Cache Management

```tsx
import { useImageCache } from '@/hooks/use-image-cache'

export function ImageCacheManager() {
  const cache = useImageCache()

  const handleClearCache = () => {
    cache.clear()
    console.log('Image cache cleared')
  }

  const handlePrefetch = (url: string) => {
    const img = new (window as any).Image()
    img.onload = () => {
      cache.set(url, img, 10000)
    }
    img.src = url
  }

  return (
    <Button 
      text="Clear Cache" 
      onPress={handleClearCache}
    />
  )
}
```

## Integration Points

### WorldRightPanel

```tsx
<LazyImage
  src={mapImage || ''}
  fallbackSrc={noImageSelected}
  width="100%"
  height="100%"
  contentFit={isDesktop ? 'cover' : 'contain'}
  optimizeSupabase
  optimizeWidth={1200}
  optimizeQuality={85}
  responsive              // Different sizes for devices
  useWebP                 // Use WebP if available
  cacheStrategy="memory-disk"
  prefetch                // Prefetch if possible
  showSkeleton
  containerStyle={{
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
  }}
/>
```

### Avatar Components

```tsx
<LazyImage
  src={user.avatar_url}
  fallbackSrc={defaultAvatar}
  width={64}
  height={64}
  borderRadius={32}
  optimizeSupabase
  optimizeWidth={150}
  optimizeQuality={90}
/>
```

### List/Grid Items

```tsx
<FlatList
  data={items}
  renderItem={({ item }) => (
    <LazyImage
      src={item.image_url}
      width={150}
      height={150}
      optimizeSupabase
      optimizeWidth={300}
      optimizeQuality={80}
      threshold={0.5}       // Load when 50% visible
      rootMargin="100px"    // Prefetch 100px before
    />
  )}
/>
```

## Extension Points

### Add Native Viewport Tracking

Current implementation loads immediately on native. Can be extended:

```tsx
// Native viewport tracking example
import { useFocusEffect } from '@react-navigation/native'

useEffect(() => {
  const subscription = imageRef.current.measure((x, y, width, height) => {
    const windowHeight = Dimensions.get('window').height
    if (y + height > 0 && y < windowHeight) {
      setIsInView(true)
    }
  })
  return () => subscription?.remove()
}, [])
```

### Add Progressive Image Loading (Blur-up)

```tsx
// Load low-quality version first
const blurUrl = optimizeSupabaseImage(src, { 
  width: 50, 
  quality: 20 
})

// Then replace with high-quality
useEffect(() => {
  // Show blurred version
  setImageSrc(blurUrl)
  // Load high-quality
  // Swap when loaded
})
```

### Add Image Compression at Upload

```tsx
// In upload handler
const compressed = await compressImage(imageFile)
const url = await uploadToSupabase(compressed)
```

## Testing

### Test Lazy Loading

```tsx
// Web: Open DevTools Network tab
1. Load page
2. Scroll to trigger image loads
3. Verify images load only when visible
```

### Test Supabase Optimization

```tsx
// DevTools Network tab
1. Check image URLs contain ?width=X&quality=Y
2. Compare file sizes before/after
3. Typical: 5MB → 800KB-1.5MB
```

### Test WebP Detection

```tsx
// Chrome: Images use .webp format
// Firefox: Images use original format
// Safari: May vary by version
```

### Test Cache

```tsx
// Monitor memory usage
// Navigate away and back
// Verify instant image load
// Check browser DevTools Performance tab
```

## Troubleshooting Guide

### Image not lazy loading on native

Native platforms load immediately. Can extend with viewport tracking (see Extension Points).

### Supabase URLs not optimizing

Verify:
- URL contains 'supabase'
- `optimizeSupabase={true}`
- Check final URL in network tab

### WebP not being used

- Check browser support: `await supportsWebP()`
- Verify `useWebP={true}`
- Check network tab image format

### Cache not working

- Verify `cacheStrategy !== 'none'`
- Check browser storage limits
- Monitor cache size in memory profiler

### Performance still slow

- Lower image quality further
- Reduce optimize width
- Use smaller responsive breakpoints
- Check network throttling

## References

- [Expo Image Docs](https://docs.expo.dev/versions/latest/sdk/image/)
- [Supabase Image Transformations](https://supabase.com/docs/guides/storage/image-transformations)
- [Intersection Observer API](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API)
- [React Native Reanimated](https://docs.swmansion.com/react-native-reanimated/)
