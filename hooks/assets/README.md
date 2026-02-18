# Assets

Hooks for image and asset loading: in-memory image cache and viewport-based lazy loading helpers.

## When to Use This Module

**Use this module if you need to:**

- Prefetch or cache images for faster perceived performance
- Lazy-load images when they enter the viewport

**Do NOT use this module for:**

- Long-term persistent storage of large assets (use CDN or disk cache)

## Architecture & Data Flow

```
Component
        ↓
usePrefetchImage / useViewportTracking
        ↓
useImageCache -> memory TTL store
        ↓
render image from cache or network
```

**Key Principles:**

- **Memory-limited**: Image cache uses size and TTL limits to avoid OOM.
- **Non-blocking**: Prefetches and viewport observers run asynchronously.

## API Reference

### `useImageCache()`

In-memory image cache with TTL and size limits.

**Returns:**
- `{ get, set, clear, prefetch, getStats }`

### `usePrefetchImage(url)`

Begin background prefetch for a single image.

### `useViewportTracking()`

Track visibility of elements for lazy loading.

## Dependencies

### External Packages

- Uses platform APIs (IntersectionObserver on web) via polyfills when needed

### Internal Dependencies

- None heavy; integrates with image components in `components/ui`

## Error Handling & Edge Cases

### OOM / Memory Pressure

Cache has an LRU or TTL eviction; callers should handle cache misses by falling back to network requests.

## Performance Notes

Default cache limits (50MB, 1h TTL) are tuned for typical mobile/web usage; adjust for large galleries.

## Related Modules

- **`components/ui/LazyImage`** – UI component that uses these hooks

## File Breakdown

| File | Purpose |
| ---- | ------- |
| `index.ts` | Barrel export for asset hooks |
| `use-image-cache.tsx` | In-memory image cache with TTL and helpers |
| `use-viewport-tracking.tsx` | Viewport visibility tracking for lazy loading |
