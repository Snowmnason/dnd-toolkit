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
 *
 * **Encode vs Decode Separation:**
 * Encode (write) and decode (read) stats are tracked independently so that
 * read-heavy workloads don't inflate write-side metrics. `getStats()` reports
 * encode-side totals by default since those reflect actual storage savings.
 * Decode stats are available via `getDecodeStats()`.
 *
 * **Periodic Reset:**
 * Call `startPeriodicReset(intervalMs)` to automatically snapshot and reset
 * stats on a schedule (e.g. every 24h) to prevent long-running averages
 * from masking recent trends. The last snapshot is available via
 * `getLastPeriodicSnapshot()`.
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
  /** Post-encoding size (includes base64 overhead for compressed entries, ~33% larger) */
  totalStoredBytes: number;
  totalTimeMs: number;
  averageRatio: number; // compressed / original
  bytesSaved: number; // totalOriginalBytes - totalStoredBytes (real savings after encoding)
}

/**
 * Decode-side statistics snapshot
 */
export interface DecodeStatsSnapshot {
  totalDecodes: number;
  totalDecodedOriginalBytes: number;
  totalDecodedCompressedBytes: number;
  totalDecodeTimeMs: number;
}

/**
 * Internal stats accumulator (mutable)
 */
interface StatsAccumulator {
  // Encode-side (writes)
  encodeOperations: number;
  compressedCount: number;
  uncompressedCount: number;
  totalOriginalBytes: number;
  totalCompressedBytes: number;
  /** Actual bytes stored (includes base64 overhead for compressed entries) */
  totalStoredBytes: number;
  encodeTimeMs: number;
  // Decode-side (reads)
  decodeOperations: number;
  decodedOriginalBytes: number;
  decodedCompressedBytes: number;
  decodeTimeMs: number;
}

let stats: StatsAccumulator = {
  encodeOperations: 0,
  compressedCount: 0,
  uncompressedCount: 0,
  totalOriginalBytes: 0,
  totalCompressedBytes: 0,
  totalStoredBytes: 0,
  encodeTimeMs: 0,
  decodeOperations: 0,
  decodedOriginalBytes: 0,
  decodedCompressedBytes: 0,
  decodeTimeMs: 0,
};

/** Last periodic snapshot (null until first periodic reset fires) */
let lastPeriodicSnapshot: CompressionStatsSnapshot | null = null;
let periodicTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Record a compression operation (encode)
 * @param originalBytes Size before compression
 * @param compressedBytes Size after compression (or same if not compressed)
 * @param storedBytes Actual bytes persisted (includes base64 overhead if compressed)
 * @param wasCompressed Whether compression was applied
 * @param timeMs Time spent compressing
 *
 * NOTE: Always increments totalCompressedBytes (for uncompressed entries, compressedBytes=originalBytes).
 * storedBytes tracks the real persistence cost including base64 encoding overhead (~33%).
 */
export function recordEncode(
  originalBytes: number,
  compressedBytes: number,
  storedBytes: number,
  wasCompressed: boolean,
  timeMs: number,
): void {
  stats.encodeOperations++;
  stats.totalOriginalBytes += originalBytes;
  stats.totalCompressedBytes += compressedBytes;
  stats.totalStoredBytes += storedBytes;
  stats.encodeTimeMs += timeMs;

  if (wasCompressed) {
    stats.compressedCount++;
  } else {
    stats.uncompressedCount++;
  }
}

/**
 * Record a decompression operation (decode)
 * Tracked separately from encode so read-heavy workloads don't inflate write metrics.
 * @param originalBytes Original uncompressed size
 * @param compressedBytes Compressed size
 * @param timeMs Time spent decompressing
 */
export function recordDecode(
  originalBytes: number,
  compressedBytes: number,
  timeMs: number,
): void {
  stats.decodeOperations++;
  stats.decodedOriginalBytes += originalBytes;
  stats.decodedCompressedBytes += compressedBytes;
  stats.decodeTimeMs += timeMs;
}

/**
 * Get current encode-side statistics snapshot (default view)
 * Reports encode-side totals since those reflect actual storage savings.
 * @returns Immutable snapshot of current stats
 */
export function getStats(): CompressionStatsSnapshot {
  const totalOps = stats.encodeOperations + stats.decodeOperations;
  return {
    totalOperations: totalOps,
    compressedCount: stats.compressedCount,
    uncompressedCount: stats.uncompressedCount,
    totalOriginalBytes: stats.totalOriginalBytes,
    totalCompressedBytes: stats.totalCompressedBytes,
    totalStoredBytes: stats.totalStoredBytes,
    totalTimeMs: stats.encodeTimeMs + stats.decodeTimeMs,
    averageRatio:
      stats.totalOriginalBytes > 0
        ? stats.totalStoredBytes / stats.totalOriginalBytes
        : 1.0,
    // Real savings: original minus what we actually stored (base64 included)
    bytesSaved: stats.totalOriginalBytes - stats.totalStoredBytes,
  };
}

/**
 * Get decode-side statistics (read operations only)
 */
export function getDecodeStats(): DecodeStatsSnapshot {
  return {
    totalDecodes: stats.decodeOperations,
    totalDecodedOriginalBytes: stats.decodedOriginalBytes,
    totalDecodedCompressedBytes: stats.decodedCompressedBytes,
    totalDecodeTimeMs: stats.decodeTimeMs,
  };
}

/**
 * Reset statistics (for testing or periodic reset)
 */
export function resetStats(): void {
  stats = {
    encodeOperations: 0,
    compressedCount: 0,
    uncompressedCount: 0,
    totalOriginalBytes: 0,
    totalCompressedBytes: 0,
    totalStoredBytes: 0,
    encodeTimeMs: 0,
    decodeOperations: 0,
    decodedOriginalBytes: 0,
    decodedCompressedBytes: 0,
    decodeTimeMs: 0,
  };
}

/**
 * Start periodic stats snapshot + reset.
 * Prevents long-running averages from masking recent trends.
 * @param intervalMs Reset interval (default: 24 hours)
 */
export function startPeriodicReset(intervalMs: number = 24 * 60 * 60 * 1000): void {
  stopPeriodicReset();
  periodicTimer = setInterval(() => {
    lastPeriodicSnapshot = getStats();
    resetStats();
  }, intervalMs);

  // Don't block Node process exit
  if (typeof periodicTimer === 'object' && 'unref' in periodicTimer) {
    (periodicTimer as any).unref();
  }
}

/**
 * Stop periodic stats reset
 */
export function stopPeriodicReset(): void {
  if (periodicTimer) {
    clearInterval(periodicTimer);
    periodicTimer = null;
  }
}

/**
 * Get the last periodic snapshot (null if periodic reset hasn't fired yet)
 */
export function getLastPeriodicSnapshot(): CompressionStatsSnapshot | null {
  return lastPeriodicSnapshot;
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
