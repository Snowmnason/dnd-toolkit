/**
 * Image Optimization Utilities
 *
 * Re-exported from @/pure-algo-immutables/image-optimization
 * so existing lib/ imports continue to work.
 *
 * Components should import directly from @/pure-algo-immutables/image-optimization
 * to avoid hook boundary violations.
 */
export {
    generateResponsiveSrcset, getOptimalImageWidth,
    getResponsiveImageSizes, isSupabaseUrl,
    optimizeSupabaseImage,
    optimizeWithWebP,
    supportsWebP,
    type ImageOptimizationOptions
} from "@/pure-algo-immutables/image-optimization";

