/**
 * Image Optimization Utilities
 *
 * Helper functions for optimizing image loading and display,
 * particularly for Supabase storage URLs.
 */

export interface ImageOptimizationOptions {
  /** Target width for image resize */
  width?: number;
  /** Target height for image resize */
  height?: number;
  /** Image quality (1-100) */
  quality?: number;
  /** Image format (e.g., 'webp', 'jpeg') */
  format?: "webp" | "jpeg" | "png";
  /** Fit mode for resizing on server */
  fit?: "cover" | "contain" | "fill" | "inside" | "outside";
}

/**
 * Optimizes a Supabase storage URL with transformation parameters
 *
 * @param url - The original Supabase storage URL
 * @param options - Optimization parameters (width, height, quality, format)
 * @returns Optimized URL with query parameters
 *
 * @example
 * ```ts
 * const optimized = optimizeSupabaseImage(
 *   'https://abc.supabase.co/storage/v1/object/public/maps/world.jpg',
 *   { width: 800, quality: 80, format: 'webp' }
 * )
 * // Returns: ...world.jpg?width=800&quality=80&format=webp
 * ```
 */
export function optimizeSupabaseImage(
  url: string,
  options: ImageOptimizationOptions = {}
): string {
  if (!url || !url.includes("supabase")) {
    return url;
  }

  const params = new URLSearchParams();

  if (options.width) params.append("width", options.width.toString());
  if (options.height) params.append("height", options.height.toString());
  if (options.quality) params.append("quality", options.quality.toString());
  if (options.format) params.append("format", options.format);
  if (options.fit) params.append("fit", options.fit);

  const queryString = params.toString();
  if (!queryString) return url;

  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${queryString}`;
}

/**
 * Gets responsive image sizes based on device/viewport
 *
 * @returns Recommended image widths for different screen sizes
 */
export function getResponsiveImageSizes() {
  return {
    thumbnail: 150,
    small: 400,
    medium: 800,
    large: 1200,
    xlarge: 1600,
  };
}

/**
 * Determines optimal image width based on container width
 *
 * @param containerWidth - Width of the container in pixels
 * @returns Recommended image width (accounts for DPR)
 */
export function getOptimalImageWidth(containerWidth: number): number {
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const targetWidth = containerWidth * dpr;

  const sizes = getResponsiveImageSizes();

  if (targetWidth <= sizes.thumbnail) return sizes.thumbnail;
  if (targetWidth <= sizes.small) return sizes.small;
  if (targetWidth <= sizes.medium) return sizes.medium;
  if (targetWidth <= sizes.large) return sizes.large;

  return sizes.xlarge;
}

/**
 * Checks if a URL is a Supabase storage URL
 */
export function isSupabaseUrl(url: string): boolean {
  return url?.includes("supabase") && url.includes("storage");
}

/**
 * Generates responsive image srcset for web
 *
 * Creates URLs with different widths for responsive images
 *
 * @example
 * ```ts
 * const srcset = generateResponsiveSrcset(supabaseUrl, [400, 800, 1200])
 * // Returns: "url?width=400 400w, url?width=800 800w, url?width=1200 1200w"
 * ```
 */
export function generateResponsiveSrcset(
  url: string,
  widths: number[] = [400, 800, 1200]
): string {
  if (!url || !isSupabaseUrl(url)) {
    return url;
  }

  return widths
    .map((width) => {
      const optimized = optimizeSupabaseImage(url, { width, quality: 80 });
      return `${optimized} ${width}w`;
    })
    .join(", ");
}

/**
 * Checks browser support for WebP format
 */
export function supportsWebP(): Promise<boolean> {
  return new Promise((resolve) => {
    // On native platforms (mobile), skip WebP detection - use standard formats
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }

    // On web, check if Image constructor exists (it should)
    if (typeof Image === "undefined") {
      resolve(false);
      return;
    }

    try {
      const webp = new Image();
      webp.onload = webp.onerror = () => {
        resolve(webp.height === 2);
      };
      webp.src =
        "data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAAB8AQCdASoBAAEAAQAcJaACdLoBmAAP/gAA";
    } catch {
      // If Image constructor fails, WebP is not supported
      resolve(false);
    }
  });
}

/**
 * Optimizes image URL with WebP support if available
 */
export async function optimizeWithWebP(
  url: string,
  options: ImageOptimizationOptions = {}
): Promise<string> {
  if (!isSupabaseUrl(url)) {
    return url;
  }

  const webpSupported = await supportsWebP();
  return optimizeSupabaseImage(url, {
    ...options,
    format: webpSupported ? "webp" : undefined,
  });
}
