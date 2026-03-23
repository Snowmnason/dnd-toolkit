# Compression and Storage Optimization - Implementation Guide

## Architecture Overview

The compression system is implemented as middleware in the storage layer, providing transparent compression/decompression for large data entries. It integrates seamlessly with existing storage backends and maintains backward compatibility.

## System Architecture

```
App Code
    ↓
SecureStorage API
    ↓
Compression Middleware ← Automatic compression/decompression
    ↓
Backend Routing (EncryptedStorage | FastCache | Platform Storage)
    ↓
Physical Storage
```

## Core Components

### Compression Middleware (`lib/middleware/storage/compression.ts`)

Central compression logic with platform-aware algorithms:

```typescript
export interface CompressionSettings {
  enabled: boolean;
  algorithm: 'gzip' | 'deflate';
  threshold: number; // bytes
  maxBytesPerEntry: number;
}

export interface CompressedData {
  data: string;
  originalSize: number;
  compressedSize: number;
  algorithm: string;
  timestamp: number;
}
```

### Key Functions

#### `shouldCompress(data: string, settings: CompressionSettings): boolean`
Determines if data should be compressed based on size threshold and settings.

#### `compressData(data: string | Uint8Array, options?): Promise<CompressedData>`
Core compression function with platform-specific implementations.

#### `decompressData(compressedData: string | Uint8Array, algorithm: string): Promise<string | Uint8Array>`
Core decompression function with error handling.

#### `getCompressionStats(): CompressionStats`
Tracks compression effectiveness and performance metrics.

## Platform-Specific Implementations

### Web Platform
```typescript
// Uses Web Compression API when available
if ('CompressionStream' in window) {
  const stream = new CompressionStream('gzip');
  // Stream-based compression
} else {
  // Fallback to pako.js library
  import('pako').then(pako => pako.gzip(data));
}
```

### Native Platforms (iOS/Android)
```typescript
// Uses expo-file-system or platform APIs
// iOS: NSCompression
// Android: GZIPOutputStream
const compressed = await FileSystem.compressAsync(data, {
  algorithm: 'gzip'
});
```

### Desktop (Electron)
```typescript
// Uses Node.js zlib
import { gzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);
const compressed = await gzipAsync(data);
```

## Integration Points

### SecureStorage Integration

Compression is automatically applied in `SecureStorage.setItem()` and `SecureStorage.setJSON()`:

```typescript
// In SecureStorage.ts
async setItem(key: string, value: string): Promise<void> {
  const shouldCompress = shouldCompress(value, this.settings.compression);
  if (shouldCompress) {
    const compressed = await compressData(value);
    value = JSON.stringify(compressed); // Store with metadata
  }

  return this.backend.setItem(key, value);
}
```

### QueryCache Integration

Query results are automatically compressed when stored:

```typescript
// In QueryCache.ts
async set<T>(key: string, data: T, options?: CacheOptions): Promise<void> {
  const jsonData = JSON.stringify(data);
  const compressed = await compressData(jsonData);

  const entry: CacheEntry = {
    data: compressed,
    timestamp: Date.now(),
    compressed: true,
    originalSize: jsonData.length,
    // ... other metadata
  };

  await this.storage.setItem(key, JSON.stringify(entry));
}
```

## Storage Limits Implementation

### Quota Management

```typescript
export interface StorageLimits {
  hardMaxBytes: number;        // 500MB default
  hardMaxBytesPerEntry: number; // 10MB default
  rejectOversizedEntries: boolean;
}

class StorageQuotaManager {
  async checkQuota(data: string): Promise<QuotaResult> {
    const size = new Blob([data]).size;
    const currentUsage = await this.getCurrentUsage();

    return {
      allowed: size <= this.limits.hardMaxBytesPerEntry,
      remaining: Math.max(0, this.limits.hardMaxBytes - currentUsage),
      wouldExceed: (currentUsage + size) > this.limits.hardMaxBytes
    };
  }
}
```

### Automatic Cleanup

When quota is exceeded, the system automatically removes oldest entries:

```typescript
async enforceQuota(): Promise<void> {
  const usage = await this.getCurrentUsage();
  if (usage > this.limits.hardMaxBytes) {
    const entries = await this.getAllEntriesSortedByAge();
    let freedBytes = 0;

    for (const entry of entries) {
      if (usage - freedBytes <= this.limits.hardMaxBytes * 0.8) break;
      await this.removeEntry(entry.key);
      freedBytes += entry.size;
    }
  }
}
```

## Error Handling & Recovery

### Compression Failures

```typescript
async safeCompress(data: string): Promise<string> {
  try {
    const compressed = await compressData(data);
    return JSON.stringify(compressed);
  } catch (error) {
    logger.category('storage').warn('Compression failed, storing uncompressed', error);
    return data; // Fallback to uncompressed
  }
}
```

### Decompression Failures

```typescript
async safeDecompress(storedData: string): Promise<string> {
  try {
    const parsed = JSON.parse(storedData);
    if (parsed.compressed) {
      return await decompressData(parsed.data, parsed.algorithm);
    }
    return storedData;
  } catch (error) {
    logger.category('storage').error('Decompression failed', error);
    return storedData; // Return as-is if decompression fails
  }
}
```

## Performance Optimizations

### Lazy Decompression

For large cached entries, decompression can be deferred:

```typescript
class LazyDecompressedCache {
  private decompressed = new Map<string, Promise<string>>();

  async get(key: string): Promise<string | null> {
    const cached = await this.storage.getItem(key);
    if (!cached) return null;

    if (!this.decompressed.has(key)) {
      this.decompressed.set(key, this.safeDecompress(cached));
    }

    return this.decompressed.get(key);
  }
}
```

### Memory Pool Management

Reuses compression buffers to reduce GC pressure:

```typescript
class CompressionBufferPool {
  private buffers: Uint8Array[] = [];

  getBuffer(size: number): Uint8Array {
    const buffer = this.buffers.find(b => b.length >= size) || new Uint8Array(size);
    return buffer;
  }

  returnBuffer(buffer: Uint8Array): void {
    if (this.buffers.length < 10) { // Limit pool size
      this.buffers.push(buffer);
    }
  }
}
```

## Testing Strategy

### Unit Tests

```typescript
describe('Compression Middleware', () => {
  it('should compress large data', async () => {
    const largeData = 'x'.repeat(2048); // > 1KB
    const compressed = await compressData(largeData);

    expect(compressed.compressedSize).toBeLessThan(largeData.length);
    expect(compressed.algorithm).toBe('gzip');
  });

  it('should skip compression for small data', async () => {
    const smallData = 'small';
    const result = await compressData(smallData);

    expect(result).toBe(smallData); // No compression
  });
});
```

### Integration Tests

```typescript
describe('Storage with Compression', () => {
  it('should store and retrieve compressed data transparently', async () => {
    const largeObject = { data: 'x'.repeat(2048) };

    await SecureStorage.setJSON('test:key', largeObject);
    const retrieved = await SecureStorage.getJSON('test:key');

    expect(retrieved).toEqual(largeObject);
  });
});
```

### Performance Benchmarks

```typescript
describe('Compression Performance', () => {
  benchmark('gzip compression', async () => {
    const data = JSON.stringify(largeTestData);
    await compressData(data, { algorithm: 'gzip' });
  });

  benchmark('deflate compression', async () => {
    const data = JSON.stringify(largeTestData);
    await compressData(data, { algorithm: 'deflate' });
  });
});
```

## Migration & Backward Compatibility

### Version Detection

Compression adds version metadata to detect compressed vs uncompressed data:

```typescript
interface StorageEntry {
  data: string;
  version: number;
  compressed?: boolean;
  compressionInfo?: {
    algorithm: string;
    originalSize: number;
    compressedSize: number;
  };
}
```

### Migration Strategy

When upgrading from uncompressed to compressed storage:

```typescript
async migrateToCompression(): Promise<void> {
  const keys = await SecureStorage.getAllKeys();

  for (const key of keys) {
    const data = await SecureStorage.getItem(key);
    if (data && !isCompressed(data)) {
      // Migrate uncompressed data to compressed format
      await SecureStorage.setItem(key, data); // Triggers compression
    }
  }
}
```

## Monitoring & Observability

### Compression Metrics

```typescript
interface CompressionStats {
  totalOperations: number;
  bytesCompressed: number;
  bytesSaved: number;
  avgCompressionRatio: number;
  errors: number;
  avgCompressionTime: number;
}

class CompressionMonitor {
  recordCompression(originalSize: number, compressedSize: number, duration: number): void {
    // Update metrics
  }

  getStats(): CompressionStats {
    // Return current statistics
  }
}
```

### Health Checks

```typescript
async checkCompressionHealth(): Promise<HealthStatus> {
  try {
    const testData = 'compression test data';
    const compressed = await compressData(testData);
    const decompressed = await decompressData(compressed.data, compressed.algorithm);

    return {
      healthy: decompressed === testData,
      latency: Date.now() - startTime,
      error: null
    };
  } catch (error) {
    return {
      healthy: false,
      latency: 0,
      error: error.message
    };
  }
}
```

## Security Considerations

### Data Integrity

Compression includes integrity checks to prevent tampering:

```typescript
async compressWithIntegrity(data: string): Promise<CompressedData> {
  const compressed = await compressData(data);
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));

  return {
    ...compressed,
    integrityHash: btoa(String.fromCharCode(...new Uint8Array(hash)))
  };
}
```

### Memory Safety

Prevents compression bombs and excessive memory usage:

```typescript
const MAX_COMPRESSION_RATIO = 10; // 10x expansion max
const MAX_MEMORY_USAGE = 50 * 1024 * 1024; // 50MB max

function validateCompressionSafety(originalSize: number, compressedSize: number): boolean {
  const ratio = compressedSize / originalSize;
  return ratio <= MAX_COMPRESSION_RATIO && compressedSize <= MAX_MEMORY_USAGE;
}
```

## Future Enhancements

### Planned Features

- **Adaptive compression**: Automatically choose best algorithm per data type
- **Progressive compression**: Stream compression for very large files
- **Compression profiles**: Predefined settings for different use cases
- **Background compression**: Async compression for non-blocking operations

### Extension Points

The compression system is designed to be extensible:

```typescript
interface CompressionAlgorithm {
  name: string;
  compress(data: Uint8Array): Promise<Uint8Array>;
  decompress(data: Uint8Array): Promise<Uint8Array>;
  isSupported(): boolean;
}

// Register custom algorithms
CompressionRegistry.register(new CustomAlgorithm());
```