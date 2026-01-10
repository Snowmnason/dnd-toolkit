# Image Optimization & Lazy Loading

## Overview

This document explains the image optimization system implemented in dnd-toolkit. The system provides cross-platform lazy loading, automatic image optimization, responsive images, and advanced caching for optimal performance and user experience.

## Features

### 1. Cross-Platform Lazy Loading

Images are loaded only when visible in the viewport, reducing initial load time and bandwidth usage.

**Web**: Uses Intersection Observer API
**Native (iOS/Android)**: Uses viewport tracking hook

```tsx
<LazyImage 
  src={imageUrl}
  width="100%"
  height={300}
/>
```

The image automatically detects visibility and loads when entering the viewport with configurable threshold:

```tsx
<LazyImage 
  src={imageUrl}
  threshold={0.1}           // Load when 10% visible
  rootMargin="50px"         // Start loading 50px before entering
/>
```

### 2. Automatic Supabase Image Optimization

Supabase URLs are automatically optimized with resize and quality parameters, reducing file size by 50-70%.

```tsx
<LazyImage 
  src={supabaseUrl}
  optimizeSupabase
  optimizeWidth={1200}      // Target width
  optimizeQuality={85}      // Quality 1-100
/>
```

Without optimization: `https://abc.supabase.co/storage/v1/object/public/maps/world.jpg` (5MB)
With optimization: `...world.jpg?width=1200&quality=85` (1-1.5MB)

### 3. Responsive Images for Web

On web, automatically generates responsive srcsets for different screen sizes:

```tsx
<LazyImage 
  src={supabaseUrl}
  responsive
  responsiveWidths={[400, 800, 1200]}
/>
```

Generated URLs:
```
url?width=400&quality=80 400w,
url?width=800&quality=80 800w,
url?width=1200&quality=80 1200w
```

### 4. WebP Format Detection

Automatically detects browser WebP support and uses WebP format when available (smaller files):

```tsx
<LazyImage 
  src={supabaseUrl}
  useWebP              // Auto-detect and use WebP
/>
```

Fallbacks to original format if WebP not supported.

### 5. Advanced Caching

In-memory image cache with automatic expiration (1 hour TTL) and size limits (50MB max).

```tsx
<LazyImage 
  src={imageUrl}
  cacheStrategy="memory-disk"  // Options: 'memory' | 'memory-disk' | 'disk' | 'none'
/>
```

### 6. Prefetch for Navigation

Prefetch images before user navigates, enabling instant image display:

```tsx
// On hover, prefetch the next world's map
const prefetch = usePrefetchImage()

const handleHover = () => {
  prefetch(nextWorld.map_image_url)
}

<LazyImage 
  src={world.map_image_url}
  prefetch              // Prefetch in background
/>
```

**Real-world usage in WorldRightPanel**:

```tsx
// When user hovers over a world in the list, prefetch its map
<LazyImage
  src={world.map_image_url}
  prefetch={hovered}    // Prefetch when this world is hovered
/>
```

### 7. Skeleton Loading

Animated skeleton loader shows while image loads, improving perceived performance:

```tsx
<LazyImage 
  src={imageUrl}
  showSkeleton          // Default: true
  width="100%"
  height={300}
/>
```

### 8. Error Handling

Graceful fallback if image fails to load:

```tsx
<LazyImage 
  src={imageUrl}
  fallbackSrc={defaultImage}
/>
```

## Usage Examples

### World Map (Full Screen Background)

```tsx
import { LazyImage } from '@/components/ui'

<LazyImage
  src={world.map_image_url}
  fallbackSrc={defaultMap}
  width="100%"
  height="100%"
  optimizeSupabase
  optimizeWidth={1600}        // Full screen width
  optimizeQuality={85}
  responsive                  // Responsive srcsets
  useWebP                      // Use WebP if available
  cacheStrategy="memory-disk"
  containerStyle={{
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
  }}
/>
```

### User Avatar

```tsx
<LazyImage
  src={user.avatar_url}
  fallbackSrc={defaultAvatar}
  width={80}
  height={80}
  borderRadius={40}
  optimizeSupabase
  optimizeWidth={200}         // Small image
  optimizeQuality={90}        // Higher quality for clarity
  cacheStrategy="memory-disk"
/>
```

### Card Thumbnail in List

```tsx
<LazyImage
  src={item.thumbnail_url}
  width={120}
  height={80}
  borderRadius={8}
  optimizeSupabase
  optimizeWidth={300}
  optimizeQuality={75}
  threshold={0.2}             // Load when 20% visible
  rootMargin="100px"          // Prefetch 100px before view
/>
```

### Hero Banner

```tsx
<LazyImage
  src={page.hero_image_url}
  width="100%"
  height={400}
  contentFit="cover"
  optimizeSupabase
  optimizeWidth={1600}
  optimizeQuality={90}        // High quality for hero
  responsive                  // Different sizes for devices
  showSkeleton
/>
```

## API Reference

### LazyImage Component

```tsx
<LazyImage
  // Required
  src: string

  // Size & Layout
  width: number | string        // Default: '100%'
  height: number | string       // Default: 200
  borderRadius: number          // Optional
  containerStyle: ViewStyle     // Additional styles

  // Loading behavior
  showSkeleton: boolean         // Default: true
  threshold: number             // Default: 0.1
  rootMargin: string            // Default: '50px'

  // Image optimization
  optimizeSupabase: boolean     // Default: true
  optimizeWidth: number         // Default: 800
  optimizeQuality: number       // Default: 80 (1-100)
  autoOptimizeWidth: boolean    // Default: false (measure container, DPR-aware)
  supabaseFit: 'cover' | 'contain' // Optional fit mode for server transform

  // Advanced features
  responsive: boolean           // Default: false
  responsiveWidths: number[]    // Default: [400, 800, 1200]
  useWebP: boolean              // Default: true
  cacheStrategy: string         // Default: 'memory-disk'
  prefetch: boolean             // Default: false
  rootRef: Element              // Web only: custom scroll container root
  accessibilityLabel: string    // Optional for screen readers
  allowRetry: boolean           // Default: true (show small retry button on error)

  // Standard Image props
  contentFit: 'cover' | 'contain'
  transition: number            // ms
  fallbackSrc: any
  
  // All other expo-image ImageProps
  ...imageProps
/>
```

### Hooks

#### useViewportTracking

Track if component is visible on screen:

```tsx
const { ref, isInView, hasLoaded } = useViewportTracking({
  threshold: 0.1,
  rootMargin: '50px',
  rootRef: scrollContainerRef   // Optional: observe within custom container on web
})

<View ref={ref}>
  {isInView && <Image source={...} />}
</View>
```

#### useImageCache

Access image cache directly:

```tsx
const { get, set, clear } = useImageCache()

// Cache an image
set('image-key', imageData, 5000)  // 5000 bytes

// Get from cache
const cached = get('image-key')

// Clear all cache
clear()
```

#### usePrefetchImage

Prefetch images for faster loading:

```tsx
const prefetch = usePrefetchImage()

const handleHover = () => {
  prefetch('https://example.com/image.jpg')
}

<div onMouseEnter={handleHover}>...</div>
```

### Utility Functions

#### optimizeSupabaseImage

Add transformation params to Supabase URL:

```tsx
import { optimizeSupabaseImage } from '@/lib/utils/image-optimization'

const optimized = optimizeSupabaseImage(supabaseUrl, {
  width: 800,
  quality: 80,
  format: 'webp'
})
```

#### generateResponsiveSrcset

Create responsive srcset string:

```tsx
import { generateResponsiveSrcset } from '@/lib/utils/image-optimization'

const srcset = generateResponsiveSrcset(supabaseUrl, [400, 800, 1200])
// Returns: "url?width=400... 400w, url?width=800... 800w, ..."
```

#### supportsWebP

Check WebP browser support:

```tsx
import { supportsWebP } from '@/lib/utils/image-optimization'

const isSupported = await supportsWebP()
```

## Best Practices

### Size Recommendations

| Type | Width | Quality | Notes |
|------|-------|---------|-------|
| Thumbnail | 150-300px | 70-80 | Small, fast |
| Card | 400-800px | 75-85 | Balanced |
| Hero | 1200-1600px | 80-90 | High quality |
| Avatar | 150-300px | 85-90 | Sharp details |
| Background | 1200-1600px | 80-85 | Balance quality/size |

### Do's ✅

- Use `LazyImage` for large images (> 200KB)
- Set `optimizeSupabase` for Supabase URLs
- Use responsive for above-the-fold images
- Provide `fallbackSrc` for important images
- Enable prefetch for predicted navigation
- Test on slow networks (throttle to Slow 3G)

### Don'ts ❌

- Don't use `LazyImage` for tiny UI icons (< 100px)
- Don't disable caching for frequently viewed images
- Don't use very low quality (< 70) for text/details
- Don't forget fallbacks for critical images
- Don't force responsive on every image

## Performance Impact

### Typical Results

**World Map Page Load (Before)**
- Initial load: 3-5s
- Data transfer: 4-8MB
- Image size: 5-10MB per world

**World Map Page Load (After)**
- Initial load: 0.8-1.5s (60-70% faster)
- Data transfer: 1-2MB (75% reduction)
- Image size: 800KB-1.5MB per world

**User Experience**
- Instant page display with skeleton loader
- Smooth fade-in of images
- Works on slow networks (3G)
- Seamless navigation with prefetch

## Troubleshooting

### Image not loading
- Check URL is valid
- Verify Supabase configuration
- Check network tab for failed requests
- Ensure fallback is provided

## When To Use LazyImage vs Image

- **Use `LazyImage`**: Large or remote images (maps, banners, card thumbnails), Supabase-hosted assets, anything that benefits from lazy loading, skeletons, caching, and responsive/webp.
- **Use `Image`**: Small local assets (icons, UI glyphs), tiny decorative images that must render instantly, or places where lazy logic adds overhead without benefit.

Practical rule of thumb:
- If the source is remote and bigger than ~200KB → prefer `LazyImage`.
- If it’s a local asset or small UI image → `Image` is fine.

## Optimizing A Regular Image

Even when using `Image` from expo-image, you can still optimize Supabase URLs before passing them as a source.

Example: resize + quality + optional WebP detection

```tsx
import { Image } from 'expo-image'
import { useEffect, useState } from 'react'
import { optimizeSupabaseImage, optimizeWithWebP } from '@/lib/utils/image-optimization'

export function OptimizedRegularImage({ url, width = 800, quality = 80, style }) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    // Fallback: basic resize/quality (works immediately)
    const base = optimizeSupabaseImage(url, { width, quality })
    setSrc(base)

    // Enhancement: detect WebP support and update source when ready
    optimizeWithWebP(url, { width, quality }).then((u) => {
      if (mounted) setSrc(u)
    })
    return () => { mounted = false }
  }, [url, width, quality])

  return (
    <Image
      source={src ? { uri: src } : undefined}
      style={style}
      cachePolicy="memory-disk"
      contentFit="cover"
    />
  )
}
```

Notes:
- Use `optimizeSupabaseImage()` for width/quality/fit; add `format: 'webp'` if you always want WebP.
- For dynamic WebP detection, `optimizeWithWebP()` returns a Promise; update the source once resolved.
- Keep caching on (`cachePolicy="memory-disk"`) for frequently seen images.


### Skeleton not showing
- Verify `showSkeleton={true}`
- Check image takes time to load
- Throttle network to test

### Supabase optimization not working
- Verify URL contains 'supabase'
- Check `optimizeSupabase={true}`
- Inspect final URL in network tab

### WebP not being used
- Check `useWebP={true}`
- Use Chrome DevTools to verify browser support
- Check final image format in network tab

## See Also

- [Image Optimization Quick Reference](../IMAGE_LOADING_QUICK_REF.md)
- Component: [`LazyImage.tsx`](../../components/ui/LazyImage.tsx)
- Hook: [`use-viewport-tracking.tsx`](../../hooks/use-viewport-tracking.tsx)
- Hook: [`use-image-cache.tsx`](../../hooks/use-image-cache.tsx)
- Utils: [`image-optimization.ts`](../../lib/utils/image-optimization.ts)
