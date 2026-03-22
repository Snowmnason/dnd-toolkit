/**
 * Compression Statistics Tracking
 *
 * Tracks compression metrics for monitoring and performance analysis.
 * Collected during encode/decode operations and exposed via getStats().
 *
 * **Metrics Tracked:**
 * - Count of compressed vs uncompressed entries
 * - Total bytes saved (original vs compressed)
 * - Time spent in compression operations
 * - Compression ratio (bytes saved / original)
 */

/**
 * Statistics snapshot (immutable copy of current stats)
 */
export interface CompressionStatsSnapshot {
  totalOperations: number;
  compressedCount: number;
  uncompressedCount: number;
  totalOriginalBytes: number;
  totalCompressedBytes: number;
  totalTimeMs: number;
  averageRatio: number; // compressed / original
  bytesSaved: number; // totalOriginalBytes - totalCompressedBytes
}

/**
 * Internal stats accumulator (mutable)
 */
interface StatsAccumulator {
  totalOperations: number;
  compressedCount: number;
  uncompressedCount: number;
  totalOriginalBytes: number;
  totalCompressedBytes: number;
  totalTimeMs: number;
}

let stats: StatsAccumulator = {
  totalOperations: 0,
  compressedCount: 0,
  uncompressedCount: 0,
  totalOriginalBytes: 0,
  totalCompressedBytes: 0,
  totalTimeMs: 0,
};

/**
 * Record a compression operation (encode)
 * @param originalBytes Size before compression
 * @param compressedBytes Size after compression (or same if not compressed)
 * @param wasCompressed Whether compression was applied
 * @param timeMs Time spent compressing
 */
export function recordEncode(
  originalBytes: number,
  compressedBytes: number,
  wasCompressed: boolean,
  timeMs: number,
): void {
  stats.totalOperations++;
  if (wasCompressed) {
    stats.compressedCount++;
    stats.totalCompressedBytes += compressedBytes;
  } else {
    stats.uncompressedCount++;
  }
  stats.totalOriginalBytes += originalBytes;
  stats.totalTimeMs += timeMs;
}

/**
 * Record a decompression operation (decode)
 * @param originalBytes Original uncompressed size
 * @param compressedBytes Compressed size
 * @param timeMs Time spent decompressing
 */
export function recordDecode(
  originalBytes: number,
  compressedBytes: number,
  timeMs: number,
): void {
  stats.totalOperations++;
  stats.compressedCount++;
  stats.totalOriginalBytes += originalBytes;
  stats.totalCompressedBytes += compressedBytes;
  stats.totalTimeMs += timeMs;
}

/**
 * Get current statistics snapshot
 * @returns Immutable snapshot of current stats
 */
export function getStats(): CompressionStatsSnapshot {
  return {
    totalOperations: stats.totalOperations,
    compressedCount: stats.compressedCount,
    uncompressedCount: stats.uncompressedCount,
    totalOriginalBytes: stats.totalOriginalBytes,
    totalCompressedBytes: stats.totalCompressedBytes,
    totalTimeMs: stats.totalTimeMs,
    averageRatio:
      stats.totalOriginalBytes > 0
        ? stats.totalCompressedBytes / stats.totalOriginalBytes
        : 1.0,
    bytesSaved: stats.totalOriginalBytes - stats.totalCompressedBytes,
  };
}

/**
 * Reset statistics (for testing)
 */
export function resetStats(): void {
  stats = {
    totalOperations: 0,
    compressedCount: 0,
    uncompressedCount: 0,
    totalOriginalBytes: 0,
    totalCompressedBytes: 0,
    totalTimeMs: 0,
  };
}

/**
 * Get human-readable stats summary for logging/metrics
 */
export function getStatsSummary(): string {
  const s = getStats();
  if (s.totalOperations === 0) {
    return 'No compression stats yet';
  }
  return (
    `Compression Stats: ` +
    `${s.totalOperations} ops (${s.compressedCount} compressed, ${s.uncompressedCount} skipped) | ` +
    `Ratio: ${(s.averageRatio * 100).toFixed(1)}% | ` +
    `Saved: ${formatBytes(s.bytesSaved)} | ` +
    `Time: ${s.totalTimeMs.toFixed(0)}ms`
  );
}

/**
 * Format bytes for display
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0B';
  if (bytes < 1024) return bytes + 'B';
  if (bytes < 1024 * 1024) return Math.round((bytes / 1024) * 10) / 10 + 'KB';
  if (bytes < 1024 * 1024 * 1024) return Math.round((bytes / (1024 * 1024)) * 10) / 10 + 'MB';
  return Math.round((bytes / (1024 * 1024 * 1024)) * 10) / 10 + 'GB';
}
