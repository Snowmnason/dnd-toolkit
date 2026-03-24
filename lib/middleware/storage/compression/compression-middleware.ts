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
import {
  getDecodeStats as getDecodeStatsInternal,
  getLastPeriodicSnapshot as getLastPeriodicSnapshotInternal,
  getStats as getStatsInternal,
  recordDecode,
  recordEncode,
  resetStats as resetStatsInternal,
  startPeriodicReset as startPeriodicResetInternal,
  stopPeriodicReset as stopPeriodicResetInternal,
  type CompressionStatsSnapshot,
  type DecodeStatsSnapshot,
} from '@/lib/middleware/storage/compression/compression-stats';
import { logger } from '@/lib/utils/logger';

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
 * Re-export stats types from stats module
 */
export type { CompressionStatsSnapshot, DecodeStatsSnapshot };

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
    // Circular refs / non-serializable objects: use 1KB default so the entry
    // still counts toward cache limits rather than appearing as zero-size.
    logger
      .category('storage')
      .warn(
        `Failed to measure entry size (using 1KB default): ${error instanceof Error ? error.message : String(error)}`,
      );
    return 1024;
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
 * Convert Uint8Array to base64 string for JSON serialization
 * JSON cannot preserve Uint8Array, so we encode to base64 before persistence
 */
function uint8ArrayToBase64(data: Uint8Array): string {
  // Use Buffer if available (Node.js/Electron), otherwise fall back to byte-by-byte conversion
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(data).toString('base64');
  }
  
  // Browser fallback: convert Uint8Array to string safely using Array.from
  // This avoids dynamic property access (security/detect-object-injection)
  const chars = Array.from(data).map((byte) => String.fromCharCode(byte)).join('');
  return btoa(chars);
}

/**
 * Convert base64 string back to Uint8Array after JSON deserialization
 * Called in decode() to restore Uint8Array from persisted base64 representation
 */
function base64ToUint8Array(base64: string): Uint8Array {
  // Use Buffer if available (Node.js/Electron), otherwise fall back to byte-by-byte conversion
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  
  // Browser fallback: convert base64 → string → bytes safely
  // This avoids dynamic property access (security/detect-object-injection)
  const binary = atob(base64);
  return new Uint8Array(Array.from(binary).map((char) => char.charCodeAt(0)));
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

  try {
    const sizeBytes = measureSizeBytes(value);

    // 1. Check hard per-entry size limit (from compression config)
    // Future: throw based on importance (e.g. reject critical data, allow drafted notes)
    if (config.maxBytesPerEntry && sizeBytes > config.maxBytesPerEntry) {
      logger
        .category('storage')
        .warn(
          `Compression encode: Oversized entry (${sizeBytes}B > ${config.maxBytesPerEntry}B) at key=${options.key}, storing uncompressed`,
        );
      recordEncode(sizeBytes, sizeBytes, sizeBytes, false, 0);
      return value;
    }

    // 2. If compression disabled, return as-is
    if (!config.enabled) {
      recordEncode(sizeBytes, sizeBytes, sizeBytes, false, 0);
      return value;
    }

    // 3. Check compression threshold
    const threshold = config.threshold || 1024;
    if (sizeBytes < threshold) {
      recordEncode(sizeBytes, sizeBytes, sizeBytes, false, 0);
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
      // Calculate previous compressed byte length (data might be base64 string or Uint8Array)
      const previousCompressedBytes = typeof options.previousValue.data === 'string'
        ? base64ToUint8Array(options.previousValue.data).length
        : options.previousValue.data.length;
      
      const sizeDelta = Math.abs(sizeBytes - options.previousValue.originalSize);
      const sizeDeltaPct = (sizeDelta / options.previousValue.originalSize) * 100;
      if (sizeDeltaPct < 20) {
        // Less than 20% change, skip recompression
        logger
          .category('storage')
          .debug(
            `Compression encode: Recompression skipped (only ${sizeDeltaPct.toFixed(1)}% delta) at key=${options.key}`,
          );
        // storedBytes: estimate base64 overhead (~4/3 of raw compressed)
        const previousStoredBytes = Math.ceil(previousCompressedBytes * 4 / 3);
        recordEncode(sizeBytes, previousCompressedBytes, previousStoredBytes, true, 0);
        return options.previousValue;
      }
    }

    // Convert value to Uint8Array for compression
    const serialized = JSON.stringify(value);
    const dataBuffer = new TextEncoder().encode(serialized);

    try {
      const compressed = await provider.compress(dataBuffer);
      const compressedSize = compressed.length;
      const ratio = getCompressionRatio(sizeBytes, compressedSize);

      // Create compressed entry
      // NOTE: data is stored as base64 string for JSON serialization round-trip safety.
      // Uint8Array does not survive JSON.stringify/parse, so we encode to base64 here.
      const entry: CompressedEntry = {
        version: 1,
        algorithm,
        originalSize: sizeBytes,
        data: uint8ArrayToBase64(compressed) as any, // Stored as base64 string for JSON safety
        timestamp: Date.now(),
        wasPreviouslyCompressed: isCompressed(options.previousValue),
      };

      // Record compression stats (storedBytes = base64 size of compressed data, ~33% larger)
      const base64StoredBytes = Math.ceil(compressedSize * 4 / 3);
      recordEncode(sizeBytes, compressedSize, base64StoredBytes, true, performance.now() - startTime);

      // Log compression result using probabilistic sampling to reduce log volume.
      // 10% default balances visibility with noise; tune via config.stats.sampleRate.
      const shouldLogStats = (config.stats?.enabled ?? true) && (config.stats?.sampleRate ?? 0.1) > Math.random();
      if (shouldLogStats) {
        logger
          .category('storage')
          .debug(
            `Compression encode: Compressed ${sizeBytes}B → ${compressedSize}B (${(ratio * 100).toFixed(1)}%) at key=${options.key}`,
          );
      }

      return entry;
    } catch (compressionError) {
      // Compression failed: implement store-if-small, drop-if-large strategy
      // Small entries (<10KB): store uncompressed to preserve data
      // Large entries (>=10KB): drop to prevent bloat from failed compression
      const FALLBACK_THRESHOLD = 10 * 1024; // 10KB
      
      if (sizeBytes < FALLBACK_THRESHOLD) {
        // Small entry: store uncompressed as fallback
        logger
          .category('storage')
          .warn(
            `Compression encode failed at key=${options.key}, storing uncompressed (${sizeBytes}B): ${compressionError instanceof Error ? compressionError.message : String(compressionError)}`,
          );
        recordEncode(sizeBytes, sizeBytes, sizeBytes, false, performance.now() - startTime);
        return value; // Return uncompressed value
      } else {
        // Large entry: drop to prevent storage bloat
        logger
          .category('storage')
          .warn(
            `Compression encode failed at key=${options.key}, dropping large entry (${sizeBytes}B >= ${FALLBACK_THRESHOLD}B): ${compressionError instanceof Error ? compressionError.message : String(compressionError)}`,
          );
        recordEncode(sizeBytes, 0, 0, false, performance.now() - startTime);
        // Return null to signal the caller to skip storage (if applicable)
        // Otherwise return empty object to prevent null propagation errors
        return {};
      }
    }
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
    // NOTE: entry.data is stored as base64 string in JSON, so convert back to Uint8Array
    const compressedBytes = typeof entry.data === 'string' 
      ? base64ToUint8Array(entry.data)
      : entry.data; // Fallback for direct Uint8Array (shouldn't happen with JSON persistence)
    
    const decompressed = await provider.decompress(compressedBytes);

    // 5. Parse JSON
    const decoded = JSON.parse(new TextDecoder().decode(decompressed));

    // Record decompression stats
    const compressedByteLength = typeof entry.data === 'string'
      ? base64ToUint8Array(entry.data).length
      : entry.data.length;
    
    recordDecode(entry.originalSize, compressedByteLength, performance.now() - startTime);

    // Log decompression result (if stats sampling enabled)
    const shouldLogStats = (config.stats?.enabled ?? true) && (config.stats?.sampleRate ?? 0.1) > Math.random();
    if (shouldLogStats) {
      const ratio = getCompressionRatio(entry.originalSize, compressedByteLength);
      logger
        .category('storage')
        .debug(
          `Compression decode: Decompressed ${compressedByteLength}B → ${entry.originalSize}B (${(ratio * 100).toFixed(1)}%) in ${(performance.now() - startTime).toFixed(2)}ms`,
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
 * Get current compression statistics snapshot (encode-side)
 * Re-exported from compression-stats module
 * @returns Stats snapshot
 */
export function getStats(): CompressionStatsSnapshot {
  return getStatsInternal();
}

/**
 * Get decode-side statistics
 * Re-exported from compression-stats module
 */
export function getDecodeStats(): DecodeStatsSnapshot {
  return getDecodeStatsInternal();
}

/**
 * Reset statistics (for testing or manual reset)
 * Re-exported from compression-stats module
 */
export function resetStats(): void {
  resetStatsInternal();
}

/**
 * Start periodic stats snapshot + reset (default: 24 hours).
 * Prevents long-running averages from masking recent trends.
 * The previous snapshot is available via getLastPeriodicSnapshot().
 */
export function startPeriodicReset(intervalMs?: number): void {
  startPeriodicResetInternal(intervalMs);
}

/**
 * Stop periodic stats reset
 */
export function stopPeriodicReset(): void {
  stopPeriodicResetInternal();
}

/**
 * Get the last snapshot taken by periodic reset (null until first reset fires)
 */
export function getLastPeriodicSnapshot(): CompressionStatsSnapshot | null {
  return getLastPeriodicSnapshotInternal();
}
