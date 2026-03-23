# Compression and Storage Optimization - Usage Guide

## Overview

The storage system includes automatic compression for large cache entries to optimize memory usage and storage efficiency. Compression is transparent to application code and happens automatically based on configurable thresholds.

## When to Use Compression

**Use compression for:**
- Large JSON data structures (>1KB)
- Text-heavy cache entries
- Query results with repetitive data
- User preferences and settings
- World data and character sheets

**Do NOT use compression for:**
- Already compressed data (images, videos, archives)
- Small data (<1KB) - compression overhead not worth it
- Binary data that doesn't compress well
- Frequently accessed data in hot paths

## Configuration

Compression is configured globally in `appsettings.json`:

```json
{
  "compression": {
    "enabled": true,
    "algorithm": "gzip",
    "threshold": 1024,
    "maxBytesPerEntry": 10485760
  },
  "cacheSecurityLimits": {
    "hardMaxBytes": 524288000,
    "hardMaxEntries": 5000,
    "rejectOversizedEntries": false
  }
}
```

### Configuration Options

- **`enabled`**: Enable/disable compression globally
- **`algorithm`**: Compression algorithm (`"gzip"` or `"deflate"`)
- **`threshold`**: Minimum size in bytes to trigger compression (default: 1024)
- **`maxBytesPerEntry`**: Maximum size per entry; oversized entries are stored uncompressed with a warning

## Automatic Compression

Compression happens transparently when storing data through `SecureStorage` or `QueryCache`:

```typescript
import { SecureStorage, STORAGE_KEYS } from "@/lib/storage";

// Large JSON automatically compressed
await SecureStorage.setJSON(STORAGE_KEYS.WORLD_DATA, largeWorldObject);

// Query results automatically compressed
await QueryCache.set("worlds:user:123", worldsData, {
  staleTime: 300,
  tags: ["worlds"]
});
```

## Manual Compression (Advanced)

For special cases, you can manually compress/decompress data:

```typescript
import { compressData, decompressData } from "@/lib/middleware/storage/compression/compression-middleware";

// Manual compression
const compressed = await compressData(largeJsonString, {
  algorithm: 'gzip',
  level: 6
});

// Store compressed data
await SecureStorage.setItem(key, compressed.data);

// Manual decompression
const stored = await SecureStorage.getItem(key);
if (stored) {
  const original = await decompressData(stored, 'gzip');
}
```

## Monitoring Compression Effectiveness

Track compression statistics to optimize your storage usage:

```typescript
import { getCompressionStats } from "@/lib/middleware/storage/compression/compression-middleware";

const stats = getCompressionStats();
console.log(`Compression Stats:
  - Total operations: ${stats.totalOperations}
  - Bytes compressed: ${stats.bytesCompressed}
  - Bytes saved: ${stats.bytesSaved}
  - Average ratio: ${(stats.avgCompressionRatio * 100).toFixed(1)}%`);
```

## Storage Limits and Quota Management

The system enforces storage limits to prevent quota exhaustion:

```typescript
import { FastCache } from "@/lib/storage";

// Check cache usage
const stats = await FastCache.getStats();
if (stats.quotaPercentage > 80) {
  console.warn("Cache quota 80% full, consider cleanup");
}

// Automatic cleanup for oversized entries
// (configured in appsettings.json)
```

## Best Practices

### Data Organization
- Group related data to maximize compression ratios
- Use consistent key naming for better cache management
- Consider data access patterns when setting TTL values

### Performance Optimization
- Enable compression for JSON/text data >1KB
- Disable compression for pre-compressed binary data
- Monitor compression stats in development
- Use appropriate cache TTL values to balance freshness vs. performance

### Error Handling
```typescript
import { safeStorageSet } from "@/lib/storage";

const result = await safeStorageSet({
  operation: "set",
  key: STORAGE_KEYS.LARGE_DATA,
  value: largeData,
  onError: (err) => {
    if (err.message.includes("quota")) {
      showNotification("Storage full. Please clear app data.");
    }
  }
});
```

## Troubleshooting

### Common Issues

**"Compression failed" errors:**
- Check if data is already compressed
- Verify algorithm is supported on platform
- Ensure data size is within limits

**Storage quota exceeded:**
- Clear unused cache entries
- Reduce cache TTL values
- Check for memory leaks in cached data

**Poor compression ratios:**
- Data may already be compressed
- Try different algorithm (gzip vs deflate)
- Consider data structure optimization

### Platform-Specific Considerations

**Web:**
- Uses Web Compression API when available
- Falls back to JavaScript implementation
- Respects browser storage quotas

**Native (iOS/Android):**
- Uses platform compression libraries
- Optimized for mobile performance
- Handles memory constraints gracefully

**Desktop:**
- Uses Node.js zlib for compression
- Higher memory limits available
- Better compression ratios possible

## Integration Examples

### With Query Cache
```typescript
import { useQuery } from "@/hooks/storage";

// Automatic compression for large query results
const { data: worlds } = useQuery(
  "worlds:list",
  fetchWorlds,
  {
    revalidationStrategy: "background",
    // Large results automatically compressed
  }
);
```

### With Secure Storage
```typescript
import { SecureStorage } from "@/lib/storage";

// User preferences automatically compressed if >1KB
await SecureStorage.setJSON(STORAGE_KEYS.USER_PREFERENCES, {
  theme: "dark",
  layout: { /* large layout config */ },
  shortcuts: { /* extensive shortcuts */ }
});
```

### With World Access Cache
```typescript
import { worldAccessCache } from "@/lib/storage";

// Access flags compressed for large world lists
await worldAccessCache.updateAccessFlag(worldId, true, "create");
// Automatically compressed if total data > threshold
```