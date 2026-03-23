/**
 * Compression Provider Abstraction
 *
 * Abstracts platform-specific compression implementations (Web, Native, NoOp).
 * Loads configuration from appsettings and returns the appropriate provider
 * for the current platform and configured algorithm.
 *
 * **Design Pattern:**
 * - Provider interface is platform-agnostic
 * - Implementations handle platform differences internally
 * - All operations are async and non-blocking
 * - Config loaded once at startup and cached
 *
 * **Usage:**
 * ```typescript
 * // Get provider for configured algorithm
 * const provider = getCompressionProvider();
 *
 * // Compress data
 * const compressed = await provider.compress(dataBuffer);
 *
 * // Check if algorithm is supported
 * if (provider.supports('gzip')) {
 *   // Use gzip
 * }
 * ```
 */

import { getAppConfig } from '@/config';
import { logger } from '@/lib/utils/logger';
import { Platform } from 'react-native';

/**
 * Platform-agnostic compression provider interface
 */
export interface CompressionProvider {
  /** Compress data asynchronously (non-blocking) */
  compress(data: Uint8Array): Promise<Uint8Array>;

  /** Decompress data asynchronously (non-blocking) */
  decompress(data: Uint8Array): Promise<Uint8Array>;

  /** Check if this provider supports the given algorithm */
  supports(algorithm: string): boolean;
}

/**
 * Check if CompressionStream/DecompressionStream are available
 * Returns true only if BOTH APIs are available (not all browsers support them)
 */
function isCompressionStreamAvailable(): boolean {
  try {
    return typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
  } catch {
    return false;
  }
}

/**
 * Web-based compression using Web Compression API
 * Supports: gzip, deflate (if available)
 *
 * **Algorithm Normalization:**
 * - Normalizes unsupported algorithms to 'gzip' up-front
 * - Falls back to NoOp if CompressionStream/DecompressionStream unavailable
 * - Prevents attempts to use unsupported algorithms that would throw
 */
class WebCompressionProvider implements CompressionProvider {
  private isAvailable: boolean;
  private normalizedAlgorithm: 'gzip' | 'deflate';

  constructor(private algorithm: string) {
    this.isAvailable = isCompressionStreamAvailable();

    // If CompressionStream not available, this provider should be replaced with NoOp
    if (!this.isAvailable) {
      logger
        .category('storage')
        .warn(
          `Web compression: CompressionStream/DecompressionStream not available, will need NoOp fallback`,
        );
    }

    // Normalize algorithm: only 'gzip' and 'deflate' are supported by Web Compression API
    if (['gzip', 'deflate'].includes(algorithm)) {
      this.normalizedAlgorithm = algorithm as 'gzip' | 'deflate';
    } else {
      logger
        .category('storage')
        .warn(
          `Web compression: algorithm '${algorithm}' not supported by CompressionStream, normalizing to 'gzip'`,
        );
      this.normalizedAlgorithm = 'gzip';
    }
  }

  async compress(data: Uint8Array): Promise<Uint8Array> {
    if (!this.isAvailable) {
      // getCompressionProvider() guards against this, but if reached somehow treat as no-op
      return data;
    }

    try {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(data);
          controller.close();
        },
      });

      const compressed = stream.pipeThrough(new CompressionStream(this.normalizedAlgorithm));
      const reader = compressed.getReader();
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      // Combine chunks into single Uint8Array
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      return result;
    } catch (error) {
      logger
        .category('storage')
        .error(
          `Web compression failed at algorithm=${this.normalizedAlgorithm}: ${error instanceof Error ? error.message : String(error)}`,
        );
      throw error;
    }
  }

  async decompress(data: Uint8Array): Promise<Uint8Array> {
    if (!this.isAvailable) {
      // getCompressionProvider() guards against this, but if reached somehow treat as no-op
      return data;
    }

    try {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(data);
          controller.close();
        },
      });

      const decompressed = stream.pipeThrough(
        new DecompressionStream(this.normalizedAlgorithm),
      );
      const reader = decompressed.getReader();
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      // Combine chunks into single Uint8Array
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      return result;
    } catch (error) {
      logger
        .category('storage')
        .error(
          `Web decompression failed at algorithm=${this.normalizedAlgorithm}: ${error instanceof Error ? error.message : String(error)}`,
        );
      throw error;
    }
  }

  supports(algorithm: string): boolean {
    return this.isAvailable && ['gzip', 'deflate'].includes(algorithm);
  }
}

/**
 * Native compression using zlib or expo-compression
 * Supports: gzip, deflate, zstd (if available)
 */
class NativeCompressionProvider implements CompressionProvider {
  private zlib: any;

  constructor(private algorithm: string) {
    this.zlib = null;

    // Try to load zlib from node/react-native (first choice)
    try {
      this.zlib = require('zlib');
      logger.category('storage').debug(`Loaded native zlib for compression`);
    } catch {
      // Fallback: try expo-zlib (web/expo environment)
      try {
        this.zlib = require('expo-zlib');
        logger.category('storage').debug(`Loaded expo-zlib for compression`);
      } catch {
        logger
          .category('storage')
          .warn(
            `Native zlib and expo-zlib not available, compression will be no-op. Algorithm=${algorithm}`,
          );
      }
    }
  }

  async compress(data: Uint8Array): Promise<Uint8Array> {
    if (!this.zlib) {
      return data; // No-op fallback
    }

    try {
      // Use zlib.gzip or zlib.deflate based on algorithm
      const method = this.algorithm === 'gzip' ? 'gzip' : 'deflate';

      return new Promise((resolve, reject) => {
        // eslint-disable-next-line security/detect-object-injection
        this.zlib[method](Buffer.from(data), (err: any, result: any) => {
          if (err) reject(err);
          else resolve(new Uint8Array(result));
        });
      });
    } catch (error) {
      logger
        .category('storage')
        .error(`Native compression failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async decompress(data: Uint8Array): Promise<Uint8Array> {
    if (!this.zlib) {
      return data; // No-op fallback
    }

    try {
      // Detect and decompress (zlib.gunzip auto-detects gzip)
      return new Promise((resolve, reject) => {
        this.zlib.gunzip(Buffer.from(data), (err: any, result: any) => {
          if (err) {
            // Fallback to inflate if gunzip fails
            this.zlib.inflate(Buffer.from(data), (inflateErr: any, inflateResult: any) => {
              if (inflateErr) reject(inflateErr);
              else resolve(new Uint8Array(inflateResult));
            });
          } else {
            resolve(new Uint8Array(result));
          }
        });
      });
    } catch (error) {
      logger
        .category('storage')
        .error(`Native decompression failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  supports(algorithm: string): boolean {
    return ['gzip', 'deflate', 'zstd'].includes(algorithm);
  }
}

/**
 * No-op compression provider (pass-through)
 * Used when compression is disabled or no provider available
 */
class NoOpCompressionProvider implements CompressionProvider {
  async compress(data: Uint8Array): Promise<Uint8Array> {
    return data; // No compression
  }

  async decompress(data: Uint8Array): Promise<Uint8Array> {
    return data; // No decompression
  }

  supports(_algorithm: string): boolean {
    return true; // Supports any algorithm (by doing nothing)
  }
}

let cachedProvider: CompressionProvider | null = null;

/**
 * Get the compression provider for the current platform and config
 *
 * **Platform Selection:**
 * - Web: Uses Web Compression API (CompressionStream/DecompressionStream)
 * - Native (iOS/Android): Uses zlib or expo-compression
 * - Fallback: NoOp provider (pass-through, no compression)
 *
 * **Config Integration:**
 * - Loads compression config from appsettings
 * - If compression disabled (enabled: false), returns NoOp provider
 * - Selects algorithm from config
 * - Caches provider after first call
 *
 * @returns CompressionProvider for configured algorithm on current platform
 */
export function getCompressionProvider(): CompressionProvider {
  if (cachedProvider) return cachedProvider;

  const appConfig = getAppConfig();
  const config = appConfig.compression || { enabled: true, algorithm: 'gzip' };

  // If compression disabled, use no-op provider
  if (!config.enabled) {
    cachedProvider = new NoOpCompressionProvider();
    logger.category('storage').info(`Compression disabled via config, using no-op provider`);
    return cachedProvider;
  }

  const algorithm = config.algorithm || 'gzip';

  // Platform detection and provider selection
  if (Platform.OS === 'web') {
    // Check if Web Compression API is available before using it
    if (!isCompressionStreamAvailable()) {
      logger
        .category('storage')
        .warn(
          `Web platform: CompressionStream/DecompressionStream not available, falling back to no-op compression`,
        );
      cachedProvider = new NoOpCompressionProvider();
    } else {
      const provider = new WebCompressionProvider(algorithm);
      cachedProvider = provider;
      logger
        .category('storage')
        .info(`Web compression provider selected with algorithm=${algorithm}`);
    }
  } else if (Platform.OS === 'ios' || Platform.OS === 'android') {
    cachedProvider = new NativeCompressionProvider(algorithm);
    logger
      .category('storage')
      .info(`Native compression provider selected with algorithm=${algorithm}`);
  } else {
    // Desktop or unknown platform
    cachedProvider = new NativeCompressionProvider(algorithm);
    logger
      .category('storage')
      .info(`Native compression provider selected (desktop) with algorithm=${algorithm}`);
  }

  return cachedProvider;
}

/**
 * Reset cached provider (for testing)
 */
export function resetCompressionProvider(): void {
  cachedProvider = null;
}

/**
 * Get detailed provider info for debugging/monitoring
 */
export function getCompressionProviderInfo(): {
  type: string;
  algorithm: string;
  enabled: boolean;
  platform: string;
} {
  const provider = getCompressionProvider();
  const appConfig = getAppConfig();
  const config = appConfig.compression || { enabled: true, algorithm: 'gzip' };

  return {
    type: provider.constructor.name,
    algorithm: config.algorithm || 'gzip',
    enabled: config.enabled ?? true,
    platform: Platform.OS,
  };
}
