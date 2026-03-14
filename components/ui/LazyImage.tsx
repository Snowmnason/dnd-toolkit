import { useImageCache } from "@/hooks/assets/use-image-cache";
import { useViewportTracking } from "@/hooks/assets/use-viewport-tracking";
import {
    isSupabaseUrl,
    optimizeSupabaseImage,
    supportsWebP,
} from "@/pure-algo-immutables/image-optimization";
import { $ } from "@/theme";
import { Image, ImageProps } from "expo-image";
import type { RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View, ViewStyle } from "react-native";
import { ImageSkeleton } from "./ImageSkeleton";

interface LazyImageProps extends Omit<ImageProps, "source"> {
  /** Image source URI */
  src: string | any;
  /** Fallback source for errors */
  fallbackSrc?: any;
  /** Width of the image container */
  width?: number | string;
  /** Height of the image container */
  height?: number | string;
  /** Border radius for both skeleton and image */
  borderRadius?: number;
  /** Container style */
  containerStyle?: ViewStyle;
  /** Whether to show skeleton while loading */
  showSkeleton?: boolean;
  /** Intersection observer threshold (web only) */
  threshold?: number;
  /** Root margin for intersection observer (web only) */
  rootMargin?: string;
  /** Optimize Supabase images (add width/quality params) */
  optimizeSupabase?: boolean;
  /** Target width for Supabase optimization */
  optimizeWidth?: number;
  /** Quality for Supabase optimization (1-100) */
  optimizeQuality?: number;
  /** Automatically determine optimizeWidth from container (DPR aware) */
  autoOptimizeWidth?: boolean;
  /** Supabase fit mode for server transform */
  supabaseFit?: "cover" | "contain";
  /** Enable responsive srcsets for web */
  responsive?: boolean;
  /** Widths for responsive images (only used if responsive=true) */
  responsiveWidths?: number[];
  /** Try to use WebP format if supported */
  useWebP?: boolean;
  /** Cache strategy: 'memory' | 'memory-disk' | 'disk' | 'none' */
  cacheStrategy?: "memory" | "memory-disk" | "disk" | "none";
  /** Prefetch for better performance */
  prefetch?: boolean;
  /** Web only: root scroll container for IntersectionObserver */
  rootRef?: RefObject<Element>;
  /** Accessibility label for screen readers */
  accessibilityLabel?: string;
  /** Allow showing a small retry control on error */
  allowRetry?: boolean;
}

/**
 * LazyImage - Optimized image component with lazy loading
 *
 * Features:
 * - Cross-platform lazy loading (Intersection Observer on web, viewport tracking on native)
 * - Automatic Supabase image optimization (resize/quality params)
 * - Responsive srcsets for web
 * - WebP format detection and fallback
 * - Advanced image caching with TTL
 * - Prefetch support for predicted navigation
 * - Skeleton loading state
 * - Error handling with fallback
 * - Smooth fade-in animation
 *
 * @example
 * ```tsx
 * // Basic usage
 * <LazyImage
 *   src="https://example.com/image.jpg"
 *   width="100%"
 *   height={300}
 * />
 *
 * // With all optimizations
 * <LazyImage
 *   src={world.map_image_url}
 *   width="100%"
 *   height={500}
 *   optimizeSupabase
 *   optimizeWidth={1200}
 *   optimizeQuality={85}
 *   responsive
 *   useWebP
 *   cacheStrategy="memory-disk"
 *   prefetch
 * />
 * ```
 */
export function LazyImage({
  src,
  fallbackSrc,
  width = "100%",
  height = 200,
  borderRadius,
  containerStyle,
  showSkeleton = true,
  threshold = 0.1,
  rootMargin = "50px",
  optimizeSupabase = true,
  optimizeWidth = 800,
  optimizeQuality = 80,
  autoOptimizeWidth = false,
  supabaseFit,
  responsive = false,
  responsiveWidths = [400, 800, 1200],
  useWebP = true,
  cacheStrategy = "memory-disk",
  prefetch = false,
  rootRef,
  contentFit = "cover",
  transition = 300,
  accessibilityLabel,
  allowRetry = true,
  ...imageProps
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [webpSupported, setWebpSupported] = useState(false);
  const { ref, isInView, hasLoaded } = useViewportTracking({
    threshold,
    rootMargin,
    rootRef,
  });
  const { set: setCache } = useImageCache();
  const imageRef = useRef<any>(null);
  const [containerPixelWidth, setContainerPixelWidth] = useState<number | null>(
    null,
  );
  const [containerPixelHeight, setContainerPixelHeight] = useState<
    number | null
  >(null);
  const [reloadKey, setReloadKey] = useState<number>(0);

  // Check WebP support on mount
  useEffect(() => {
    if (useWebP && typeof window !== "undefined") {
      supportsWebP().then(setWebpSupported);
    }
  }, [useWebP]);

  // Reset load state when src changes so skeletons display for new images
  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
    setReloadKey((k) => k + 1);
  }, [src]);

  // Measure container width (DPR aware) for auto optimization
  const handleLayout = useCallback((e: any) => {
    try {
      const w = e?.nativeEvent?.layout?.width;
      const h = e?.nativeEvent?.layout?.height;
      const dpr =
        typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      if (typeof w === "number" && w > 0) {
        setContainerPixelWidth(Math.round(w * dpr));
      }
      if (typeof h === "number" && h > 0) {
        setContainerPixelHeight(Math.round(h * dpr));
      }
    } catch {}
  }, []);

  // Try to get Content-Length via HEAD; fallback to estimate
  const getRemoteContentLength = useCallback(
    async (url: string): Promise<number | null> => {
      try {
        if (typeof fetch === "function") {
          const res = await fetch(url, { method: "HEAD" });
          const len = res.headers.get("content-length");
          if (len) return parseInt(len, 10);
        }
      } catch {}
      return null;
    },
    [],
  );

  const estimateImageSize = useCallback(
    (
      w?: number | null,
      h?: number | null,
      format?: "webp" | "jpeg" | "png",
      quality?: number,
    ): number => {
      if (!w || !h) return 0;
      const pixels = w * h;
      let bpp = 0.5; // default ~JPEG
      switch (format) {
        case "webp":
          bpp = 0.35;
          break;
        case "png":
          bpp = 0.8;
          break;
        case "jpeg":
        default:
          bpp = 0.5;
          break;
      }
      const qScale = quality ? Math.max(0.3, Math.min(1, quality / 85)) : 1;
      return Math.round(pixels * bpp * qScale);
    },
    [],
  );

  // Prefetch image if requested
  useEffect(() => {
    if (prefetch && typeof src === "string" && isSupabaseUrl(src)) {
      if (typeof window !== "undefined") {
        const img = new (window as any).Image();
        img.src = src;
        img.onload = async () => {
          const headSize = await getRemoteContentLength(src);
          const est = estimateImageSize(
            img.naturalWidth,
            img.naturalHeight,
            useWebP && webpSupported ? "webp" : "jpeg",
            optimizeQuality,
          );
          setCache(src, img, headSize ?? est ?? 0);
        };
      }
    }
  }, [
    prefetch,
    src,
    setCache,
    getRemoteContentLength,
    estimateImageSize,
    useWebP,
    webpSupported,
    optimizeQuality,
  ]);

  // Optimize Supabase URLs with responsive support and WebP detection
  const optimizedSrc = useMemo(() => {
    if (!src) return src;

    // If src is not a string (e.g., local asset), return as-is
    if (typeof src !== "string") return src;

    if (optimizeSupabase && isSupabaseUrl(src)) {
      // Single image optimization
      return optimizeSupabaseImage(src, {
        width:
          autoOptimizeWidth && containerPixelWidth
            ? containerPixelWidth
            : optimizeWidth,
        quality: optimizeQuality,
        // @ts-ignore include custom fit param when provided
        fit: supabaseFit,
        format: useWebP && webpSupported ? "webp" : undefined,
      });
    }

    return src;
  }, [
    src,
    optimizeSupabase,
    optimizeWidth,
    optimizeQuality,
    useWebP,
    webpSupported,
    supabaseFit,
    autoOptimizeWidth,
    containerPixelWidth,
  ]);

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
    setHasError(false);

    // Cache the loaded image with realistic size
    if (cacheStrategy !== "none" && imageRef.current) {
      const urlStr =
        typeof optimizedSrc === "string"
          ? optimizedSrc
          : typeof src === "string"
            ? src
            : undefined;
      if (urlStr) {
        getRemoteContentLength(urlStr).then((headSize) => {
          const est = estimateImageSize(
            containerPixelWidth ?? undefined,
            containerPixelHeight ?? undefined,
            useWebP && webpSupported ? "webp" : "jpeg",
            optimizeQuality,
          );
          setCache(src, imageRef.current, headSize ?? est ?? 0);
        });
      } else {
        const est = estimateImageSize(
          containerPixelWidth ?? undefined,
          containerPixelHeight ?? undefined,
          undefined,
          optimizeQuality,
        );
        setCache(src, imageRef.current, est);
      }
    }
  }, [
    src,
    cacheStrategy,
    setCache,
    optimizedSrc,
    getRemoteContentLength,
    estimateImageSize,
    containerPixelWidth,
    containerPixelHeight,
    useWebP,
    webpSupported,
    optimizeQuality,
  ]);

  const handleError = useCallback(() => {
    setHasError(true);
    setIsLoaded(true);
  }, []);

  return (
    <View
      ref={ref}
      style={[
        {
          width: width as any,
          height: height as any,
          position: "relative",
          overflow: "hidden",
          borderRadius,
        },
        containerStyle,
      ]}
      onLayout={autoOptimizeWidth ? handleLayout : undefined}
    >
      {/* Show skeleton while loading */}
      {showSkeleton && !isLoaded && isInView && (
        <ImageSkeleton
          width={width}
          height={height}
          borderRadius={borderRadius}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
      )}

      {/* Load image only when in view */}
      {isInView && hasLoaded && (
        <Image
          ref={imageRef}
          source={
            (hasError && fallbackSrc
              ? fallbackSrc
              : typeof optimizedSrc === "string"
                ? { uri: optimizedSrc }
                : optimizedSrc) as any
          }
          contentFit={contentFit}
          transition={transition}
          onLoad={handleLoad}
          onError={handleError}
          accessibilityLabel={accessibilityLabel}
          cachePolicy={
            cacheStrategy === "none"
              ? "none"
              : cacheStrategy === "disk"
                ? "disk"
                : "memory-disk"
          }
          recyclingKey={String(reloadKey)}
          style={[
            {
              width: "100%",
              height: "100%",
              opacity: isLoaded ? 1 : 0,
            },
            imageProps.style,
          ]}
          {...imageProps}
        />
      )}

      {/* Simple retry control on error */}
      {allowRetry && hasError && (
        <View
          style={{
            position: "absolute",
            bottom: 12,
            right: 12,
            backgroundColor: $("surface" as any),
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 8,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry loading image"
            onPress={() => setReloadKey((k) => k + 1)}
            style={{
              minWidth: 40,
              alignItems: "center",
            }}
          >
            <Text style={{ color: $("textPrimary" as any) }}>Retry</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
