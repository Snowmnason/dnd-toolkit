/**
 * Compression Middleware
 *
 * Owns compression/decompression logic between storage-service and persistence.
 * Called by storage-service.ts on `persistValue()` (encode) and `retrieveValue()` (decode).
 *
 * **Responsibilities:**
 * 1. **Encode (on Write)**:
 *    - Measure entry size (UTF-8 byte length)
 *    - Check hard size limits (reject or warn)
 *    - Apply compression if > threshold
 *    - Add version + metadata
 *    - Collect stats
 *
 * 2. **Decode (on Read)**:
 *    - Detect version + algorithm
 *    - Decompress if needed (async, non-blocking)
 *    - Verify integrity (optional)
 *    - Collect stats
 *
 * **Integration Pattern:**
 * - Called by lib/middleware/storage/storage-service.ts
 * - Uses compression provider from lib/middleware/storage/compression/compression-provider.ts
 * - Not called directly by hooks/lib code; only through storage-service
 *
 * **Usage:**
 * ```typescript
 * // In storage-service.persist()
 * const encoded = await compressionMiddleware.encode(value, key);
 * await backend.setJSON(key, encoded);
 *
 * // In storage-service.retrieve()
 * const encoded = await backend.getJSON(key);
 * const decoded = await compressionMiddleware.decode(encoded);
 * ```
 */

import { getAppConfig } from '@/config';
import { getCompressionProvider } from '@/lib/middleware/storage/compression/compression-provider';
import { logger } from '@/lib/utils/logger';
import {
  recordEncode,
  recordDecode,
  getStats as getStatsInternal,
  resetStats as resetStatsInternal,
  type CompressionStatsSnapshot,
} from '@/lib/middleware/storage/compression/compression-stats';

/**
 * Compressed entry wrapper with version and metadata
 */
export interface CompressedEntry {
  /** Version for handling format migrations */
  version: 1;

  /** Compression algorithm used: 'gzip' | 'deflate' | 'zstd' */
  algorithm: string;

  /** Original (uncompressed) size in bytes */
  originalSize: number;

  /** Compressed data (Uint8Array) */
  data: Uint8Array;

  /** Timestamp when entry was compressed (ms since epoch) */
  timestamp: number;

  /** Hint: was entry previously compressed? (for recompression strategy) */
  wasPreviouslyCompressed?: boolean;
}

/**
 * Compression encoding options
 */
export interface CompressionEncodeOptions {
  /** Key being cached (used for logging) */
  key?: string;

  /** Previous value (optional, for recompression strategy) */
  previousValue?: any;
}

/**
 * Re-export CompressionStatsSnapshot from stats module
 */
export type { CompressionStatsSnapshot };

/**
 * Measure entry size in UTF-8 bytes (platform-consistent)
 * Uses JSON serialization to get byte length
 */
function measureSizeBytes(data: any): number {
  try {
    const serialized = JSON.stringify(data);
    // Use Buffer.byteLength for UTF-8 byte count (works on web and native)
    if (typeof Buffer !== 'undefined') {
      return Buffer.byteLength(serialized, 'utf8');
    }
    // Fallback for environments without Buffer (rare)
    return new TextEncoder().encode(serialized).length;
  } catch (error) {
    logger
      .category('storage')
      .warn(
        `Failed to measure entry size: ${error instanceof Error ? error.message : String(error)}`,
      );
    return 0;
  }
}

/**
 * Check if entry is already compressed (has CompressedEntry structure with version)
 */
function isCompressed(data: any): data is CompressedEntry {
  return (
    data &&
    typeof data === 'object' &&
    'version' in data &&
    'algorithm' in data &&
    'originalSize' in data &&
    'data' in data &&
    'timestamp' in data
  );
}

/**
 * Calculate compression ratio
 */
function getCompressionRatio(original: number, compressed: number): number {
  if (original === 0) return 1.0;
  return compressed / original;
}

/**
 * Encode (compress) a value for storage
 *
 * Steps:
 * 1. Measure size in UTF-8 bytes (platform-consistent)
 * 2. Check hard size limit (reject or warn per config)
 * 3. Check compression threshold
 * 4. If enabled and > threshold: compress via provider
 * 5. Add version + metadata
 * 6. Collect stats
 *
 * @param value Data to encode
 * @param options Encoding options (key for logging, previous value for recompression)
 * @returns Encoded entry (compressed or as-is if below threshold)
 */
export async function encode(value: any, options: CompressionEncodeOptions = {}): Promise<any> {
  const startTime = performance.now();
  const appConfig = getAppConfig();
  const config = appConfig.compression || { enabled: true, algorithm: 'gzip', threshold: 1024 };
  const limits = appConfig.cacheSecurityLimits || {
    hardMaxBytes: 500 * 1024 * 1024,
    hardMaxEntries: 5000,
    rejectOversizedEntries: true,
  };

  try {
    const sizeBytes = measureSizeBytes(value);

    // 1. Check hard per-entry size limit (from compression config)
    if (config.maxBytesPerEntry && sizeBytes > config.maxBytesPerEntry) {
      if (limits.rejectOversizedEntries) {
        const err = new Error(
          `Entry exceeds max size: ${sizeBytes} > ${config.maxBytesPerEntry}`,
        );
        logger
          .category('storage')
          .error(
            `Compression encode: Entry rejected (oversized: ${sizeBytes}B) at key=${options.key}`,
          );
        throw err;
      } else {
        logger
          .category('storage')
          .warn(
            `Compression encode: Oversized entry allowed (${sizeBytes}B) at key=${options.key}, may skew cache stats`,
          );
      }
    }

    // 2. If compression disabled, return as-is
    if (!config.enabled) {
      recordEncode(sizeBytes, sizeBytes, false, 0);
      return value;
    }

    // 3. Check compression threshold
    const threshold = config.threshold || 1024;
    if (sizeBytes < threshold) {
      recordEncode(sizeBytes, sizeBytes, false, 0);
      logger
        .category('storage')
        .debug(
          `Compression encode: Skipped (below threshold ${threshold}B) at key=${options.key}, size=${sizeBytes}B`,
        );
      return value;
    }

    // 4. Apply compression
    const provider = getCompressionProvider();
    const algorithm = config.algorithm || 'gzip';

    // Check if recompression should be skipped (if previous value was already compressed with same data size)
    if (
      options.previousValue &&
      isCompressed(options.previousValue) &&
      options.previousValue.algorithm === algorithm
    ) {
      const sizeDelta = Math.abs(sizeBytes - options.previousValue.originalSize);
      const sizeDeltaPct = (sizeDelta / options.previousValue.originalSize) * 100;
      if (sizeDeltaPct < 20) {
        // Less than 20% change, skip recompression
        logger
          .category('storage')
          .debug(
            `Compression encode: Recompression skipped (only ${sizeDeltaPct.toFixed(1)}% delta) at key=${options.key}`,
          );
        recordEncode(sizeBytes, options.previousValue.data.length, true, 0);
        return options.previousValue;
      }
    }

    // Convert value to Uint8Array for compression
    const serialized = JSON.stringify(value);
    const dataBuffer = new TextEncoder().encode(serialized);

    const compressed = await provider.compress(dataBuffer);
    const compressedSize = compressed.length;
    const ratio = getCompressionRatio(sizeBytes, compressedSize);

    // Create compressed entry
    const entry: CompressedEntry = {
      version: 1,
      algorithm,
      originalSize: sizeBytes,
      data: compressed,
      timestamp: Date.now(),
      wasPreviouslyCompressed: isCompressed(options.previousValue),
    };

    // Record compression stats
    recordEncode(sizeBytes, compressedSize, true, performance.now() - startTime);

    // Log compression result (if stats sampling enabled and within sample rate)
    const shouldLogStats = (config.stats?.enabled ?? true) && (config.stats?.sampleRate ?? 0.1) > Math.random();
    if (shouldLogStats) {
      logger
        .category('storage')
        .debug(
          `Compression encode: Compressed ${sizeBytes}B → ${compressedSize}B (${(ratio * 100).toFixed(1)}%) at key=${options.key}`,
        );
    }

    return entry;
  } catch (error) {
    logger
      .category('storage')
      .error(
        `Compression encode failed at key=${options.key}: ${error instanceof Error ? error.message : String(error)}`,
      );
    throw error;
  }
}

/**
 * Decode (decompress) a value from storage
 *
 * Steps:
 * 1. Check if value is compressed (has version tag)
 * 2. If not compressed, return as-is
 * 3. If compressed: detect algorithm
 * 4. Decompress via provider (async, non-blocking)
 * 5. Parse decompressed JSON
 * 6. Collect stats
 * 7. Optional: verify integrity via hash
 *
 * @param value Stored value (possibly compressed)
 * @returns Decompressed value
 */
export async function decode(value: any): Promise<any> {
  const startTime = performance.now();

  try {
    // 1. Check if compressed
    if (!isCompressed(value)) {
      return value; // Not compressed, return as-is
    }

    // 2. Already compressed, must decompress
    const entry = value as CompressedEntry;
    const appConfig = getAppConfig();
    const config = appConfig.compression || { enabled: true };

    // Verify version (for future migrations)
    if (entry.version !== 1) {
      throw new Error(`Unsupported compression version: ${entry.version}`);
    }

    // 3. Detect algorithm and get provider
    const provider = getCompressionProvider();
    if (!provider.supports(entry.algorithm)) {
      logger
        .category('storage')
        .warn(
          `Compression decode: Algorithm ${entry.algorithm} not supported, may fail`,
        );
    }

    // 4. Decompress
    const decompressed = await provider.decompress(entry.data);

    // 5. Parse JSON
    const decoded = JSON.parse(new TextDecoder().decode(decompressed));

    // Record decompression stats
    recordDecode(entry.originalSize, entry.data.length, performance.now() - startTime);

    // Log decompression result (if stats sampling enabled)
    const shouldLogStats = (config.stats?.enabled ?? true) && (config.stats?.sampleRate ?? 0.1) > Math.random();
    if (shouldLogStats) {
      const ratio = getCompressionRatio(entry.originalSize, entry.data.length);
      logger
        .category('storage')
        .debug(
          `Compression decode: Decompressed ${entry.data.length}B → ${entry.originalSize}B (${(ratio * 100).toFixed(1)}%) in ${(performance.now() - startTime).toFixed(2)}ms`,
        );
    }

    return decoded;
  } catch (error) {
    logger
      .category('storage')
      .error(
        `Compression decode failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    throw error;
  }
}

/**
 * Get current compression statistics snapshot
 * Re-exported from compression-stats module
 * @returns Stats snapshot
 */
export function getStats(): CompressionStatsSnapshot {
  return getStatsInternal();
}

/**
 * Reset statistics (for testing)
 * Re-exported from compression-stats module
 */
export function resetStats(): void {
  resetStatsInternal();
}
