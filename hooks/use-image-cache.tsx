import { useEffect, useRef } from 'react'

interface ImageCacheEntry {
  data: any
  timestamp: number
  size: number
}

/**
 * Simple in-memory image cache with expiration
 */
class ImageCache {
  private cache: Map<string, ImageCacheEntry> = new Map()
  private maxSize: number = 50 * 1024 * 1024 // 50MB
  private ttl: number = 1000 * 60 * 60 // 1 hour
  private currentSize: number = 0

  set(key: string, data: any, sizeBytes: number = 0): void {
    // Clean expired entries
    this.cleanExpired()

    // Remove old entry if exists
    const existing = this.cache.get(key)
    if (existing) {
      this.currentSize -= existing.size
    }

    // Check if we need to make space
    while (this.currentSize + sizeBytes > this.maxSize && this.cache.size > 0) {
      const firstKey = this.cache.keys().next().value as string | undefined
      if (firstKey) {
        const entry = this.cache.get(firstKey)!
        this.currentSize -= entry.size
        this.cache.delete(firstKey)
      } else {
        break
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      size: sizeBytes,
    })
    this.currentSize += sizeBytes
  }

  get(key: string): any | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    if (Date.now() - entry.timestamp > this.ttl) {
      this.currentSize -= entry.size
      this.cache.delete(key)
      return null
    }

    return entry.data
  }

  private cleanExpired(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.currentSize -= entry.size
        this.cache.delete(key)
      }
    }
  }

  clear(): void {
    this.cache.clear()
    this.currentSize = 0
  }

  setTTL(ms: number): void {
    if (ms > 0) this.ttl = ms
  }

  setMaxSize(bytes: number): void {
    if (bytes > 0) this.maxSize = bytes
  }
}

// Global cache instance
const globalImageCache = new ImageCache()

/**
 * useImageCache - Hook for managing image cache
 * 
 * Provides cache get/set operations for image optimization
 */
export function useImageCache() {
  return {
    get: (key: string) => globalImageCache.get(key),
    set: (key: string, data: any, size?: number) => {
      globalImageCache.set(key, data, size)
    },
    clear: () => globalImageCache.clear(),
    setTTL: (ms: number) => globalImageCache.setTTL(ms),
    setMaxSize: (bytes: number) => globalImageCache.setMaxSize(bytes),
  }
}

/**
 * usePrefetchImage - Prefetch images for better performance
 * 
 * Useful for predicted navigation - prefetch images before user navigates
 * 
 * @example
 * ```tsx
 * const prefetch = usePrefetchImage()
 * 
 * const handleHover = () => {
 *   prefetch('https://supabase.../image.jpg')
 * }
 * ```
 */
export function usePrefetchImage() {
  const abortControllerRef = useRef<AbortController | null>(null)

  const prefetch = (imageUrl: string) => {
    // Cancel previous prefetch
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    abortControllerRef.current = new AbortController()

    // Only prefetch on web
    if (typeof window === 'undefined') {
      return
    }

    const img = new Image()
    img.src = imageUrl

    // Cache the image data
    img.onload = () => {
      globalImageCache.set(imageUrl, img, 1000)
    }
  }

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return prefetch
}

export { globalImageCache }
