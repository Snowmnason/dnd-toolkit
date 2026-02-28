/**
 * Adaptive Payload Sizing Based on Connection Quality
 *
 * Maps network connection quality to payload options (image quality, map inclusion, detail level, etc.)
 * and generates query params for server requests. Server support for these params is optional;
 * requests work with or without backend support via graceful fallback.
 *
 * TODO: (#205-backend) Create a follow-up issue to implement server-side support for quality params
 * and image resizing/media variants. Once the backend is ready, clients will automatically benefit
 * from quality-aware payloads without requiring client-side changes.
 */

import { logger } from "@/lib/utils";
import { deriveConnectionType } from "../helpers";
import { NetworkStatus } from "../network-detection";

/**
 * Quality tier for images and media
 */
export type PayloadQuality = "hd" | "sd" | "thumb" | "text-only";

/**
 * Options for adaptive payload sizing based on network quality
 */
export interface AdaptivePayloadOptions {
  /**
   * Whether to include images in the response
   */
  includeImages: boolean;

  /**
   * Quality tier for images (hd, sd, thumb, or text-only)
   */
  imageQuality: PayloadQuality;

  /**
   * Whether to include full descriptions and details, or summaries only
   */
  includeDetails: boolean;

  /**
   * Whether to include heavy GeoJSON maps and spatial data
   */
  includeMaps: boolean;

  /**
   * Maximum payload size in bytes (0 = unlimited)
   */
  maxPayloadSize: number;

  /**
   * Whether server-side compression is enabled
   */
  compressionEnabled: boolean;
}

/**
 * Map network connection quality to adaptive payload options
 *
 * Quality tier mapping (connection-aware):
 * - WIFI+4g: HD images, full details, maps included, 5MB limit (unmetered, can be aggressive)
 * - WIFI+3g: SD images, full details, no maps, 2MB limit
 * - CELLULAR+4g: SD images, full details, no maps, 2MB limit (metered, be conservative)
 * - CELLULAR+3g: Thumbnails, summaries, no maps, 1MB limit (metered + slower)
 * - 2g/slow-2g: Thumbnails only, summaries, no maps, 500KB limit
 * - offline: No images, text only, 0 limit (works with #206 offline queue)
 * - unknown: Safe default (SD, 2MB, summaries optional)
 *
 * @param status Network status from NetworkDetection.getStatus()
 * @returns Adaptive payload options for the current network quality
 */
export function getAdaptivePayloadOptions(
  status: NetworkStatus | null | undefined,
): AdaptivePayloadOptions {
  if (!status) {
    // Safe default: assume poor connection
    return {
      includeImages: true,
      imageQuality: "sd",
      includeDetails: true,
      includeMaps: false,
      maxPayloadSize: 2 * 1024 * 1024, // 2MB
      compressionEnabled: true,
    };
  }

  const effectiveType = status.effectiveType ?? "unknown";
  const connectionType = deriveConnectionType(status);
  const isCellular = connectionType === "CELLULAR";

  switch (effectiveType) {
    case "4g": {
      // On WIFI+4g: aggressive (HD, maps, 5MB)
      // On CELLULAR+4g: conservative (SD, no maps, 2MB) - avoid data charges
      if (isCellular) {
        return {
          includeImages: true,
          imageQuality: "sd",
          includeDetails: true,
          includeMaps: false,
          maxPayloadSize: 2 * 1024 * 1024, // 2MB (metered, be careful)
          compressionEnabled: true,
        };
      }
      return {
        includeImages: true,
        imageQuality: "hd",
        includeDetails: true,
        includeMaps: true,
        maxPayloadSize: 5 * 1024 * 1024, // 5MB (unmetered, can be generous)
        compressionEnabled: true,
      };
    }

    case "3g": {
      // On WIFI+3g: moderate (SD, no maps, 2MB)
      // On CELLULAR+3g: conservative (thumbnails, summaries, no maps, 1MB)
      if (isCellular) {
        return {
          includeImages: true,
          imageQuality: "thumb",
          includeDetails: false, // Summaries only
          includeMaps: false,
          maxPayloadSize: 1 * 1024 * 1024, // 1MB (metered + slower)
          compressionEnabled: true,
        };
      }
      return {
        includeImages: true,
        imageQuality: "sd",
        includeDetails: true,
        includeMaps: false,
        maxPayloadSize: 2 * 1024 * 1024, // 2MB
        compressionEnabled: true,
      };
    }

    case "2g":
    case "slow-2g": {
      return {
        includeImages: true,
        imageQuality: "thumb",
        includeDetails: false, // Summaries only
        includeMaps: false,
        maxPayloadSize: 500 * 1024, // 500KB
        compressionEnabled: true,
      };
    }

    case "offline": {
      return {
        includeImages: false,
        imageQuality: "text-only",
        includeDetails: false, // Summaries only
        includeMaps: false,
        maxPayloadSize: 0, // No limit for offline queue (separate handling)
        compressionEnabled: true,
      };
    }

    default: {
      // Unknown connection type - use safe default
      logger
        .category("network")
        .warn("Unknown effectiveType, using safe default", { effectiveType });
      return {
        includeImages: true,
        imageQuality: "sd",
        includeDetails: true,
        includeMaps: false,
        maxPayloadSize: 2 * 1024 * 1024, // 2MB
        compressionEnabled: true,
      };
    }
  }
}

/**
 * Build query parameters from adaptive payload options
 *
 * Converts AdaptivePayloadOptions into a query string object that can be sent to the server.
 * Server should gracefully ignore unknown/unsupported params.
 *
 * Example output: { imageQuality: 'sd', summaryOnly: true, excludeMaps: true, maxPayloadBytes: 2097152 }
 *
 * @param options Adaptive payload options from getAdaptivePayloadOptions()
 * @returns Query params object ready to be sent to server
 */
export function buildAdaptiveQueryParams(
  options: AdaptivePayloadOptions,
): Record<string, any> {
  const params: Record<string, any> = {};

  // Image quality param
  if (options.imageQuality !== "text-only") {
    params.imageQuality = options.imageQuality;
  }

  // Summary-only flag
  if (!options.includeDetails) {
    params.summaryOnly = true;
  }

  // Exclude maps flag
  if (!options.includeMaps) {
    params.excludeMaps = true;
  }

  // No images flag
  if (!options.includeImages) {
    params.noImages = true;
  }

  // Max payload size (only if limited)
  if (options.maxPayloadSize > 0) {
    params.maxPayloadBytes = options.maxPayloadSize;
  }

  // Compression flag
  if (options.compressionEnabled) {
    params.compress = true;
  }

  return params;
}

/**
 * Get quality-aware cache key component for query caching
 *
 * Use this to include network quality in cache keys so different quality variants
 * are cached separately (e.g., ['worlds', '4g'] vs ['worlds', '2g']).
 *
 * @param status Network status from NetworkDetection.getStatus()
 * @returns Effective type or 'unknown' for use in cache key
 */
export function getCacheKeyQualityComponent(
  status: NetworkStatus | null | undefined,
): string {
  return status?.effectiveType ?? "unknown";
}
