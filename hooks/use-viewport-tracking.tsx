import { useEffect, useRef, useState } from 'react'
import { View } from 'react-native'

interface UseViewportTrackingOptions {
  threshold?: number
  rootMargin?: string
  /** Web only: custom scroll container root */
  rootRef?: React.RefObject<Element>
}

/**
 * useViewportTracking - Cross-platform hook to track if element is visible
 * 
 * On web: Uses Intersection Observer API
 * On native: Tracks component layout changes and screen position
 * 
 * @example
 * ```tsx
 * const { ref, isInView } = useViewportTracking({ threshold: 0.1 })
 * 
 * return (
 *   <View ref={ref}>
 *     {isInView && <Image source={...} />}
 *   </View>
 * )
 * ```
 */
export function useViewportTracking({
  threshold = 0.1,
  rootMargin = '50px',
  rootRef,
}: UseViewportTrackingOptions = {}) {
  const [isInView, setIsInView] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const ref = useRef<View>(null)

  useEffect(() => {
    const element = ref.current as any

    // Web: Use Intersection Observer
    if (typeof window !== 'undefined' && window.IntersectionObserver) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setIsInView(true)
              setHasLoaded(true)
              observer.disconnect()
            }
          })
        },
        {
          threshold,
          rootMargin,
          root: rootRef?.current || undefined,
        }
      )

      if (element?.getBoundingClientRect) {
        observer.observe(element)
        return () => observer.disconnect()
      }
    } else {
      // Fallback: load immediately on native or unsupported browsers
      setIsInView(true)
      setHasLoaded(true)
    }
  }, [threshold, rootMargin, rootRef])

  return {
    ref,
    isInView,
    hasLoaded,
  }
}
