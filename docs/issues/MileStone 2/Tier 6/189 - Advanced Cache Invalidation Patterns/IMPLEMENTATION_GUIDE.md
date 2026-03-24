# Advanced Cache Invalidation Patterns - Implementation Guide

## Architecture Overview

The advanced cache invalidation system is implemented as a modular, layered architecture that extends the existing QueryCache with four specialized invalidation patterns. The system maintains clean separation between business logic and infrastructure while providing centralized validation and error handling.

## System Architecture

```
Application Layer
    ↓
QueryCache (lib/middleware/storage/helpers/query-cache/)
├── query-cache.ts              (Main API - orchestrates all patterns)
├── internals.ts                (Shared state + LRU eviction)
├── query-cache-core.ts         (Basic get/set operations)
├── query-cache-invalidation.ts (Pattern/tag/age invalidation)
├── query-cache-persistence.ts  (Persistence-level filtering)
└── query-cache-stats.ts        (Statistics + manual eviction)
    ↓
CacheInvalidationOrchestrator (system/storage/cache-invalidation/)
├── orchestrator.ts             (Central validation + coordination)
├── cascade-manager.ts          (Parent-child dependency tracking)
├── conditional-filter.ts       (Predicate-based filtering)
├── transaction-coordinator.ts  (Atomic batch operations)
└── deferred-queue.ts           (Scheduled invalidations)
    ↓
LRU Eviction Manager (system/storage/cache-invalidation/)
└── lru-eviction.ts             (Capacity management + auto-eviction)
    ↓
Type Definitions (type-definitions/cache-invalidation.ts)
```

## Core Components

### CacheInvalidationOrchestrator

Central coordinator that validates inputs, manages error handling, and delegates to specialized managers.

#### Key Responsibilities

- **Input Validation**: All operations validate parameters before delegation
- **Error Standardization**: Converts manager errors to `CacheInvalidationError`
- **Logging**: Consistent logging with category `'storage'`
- **Coordination**: Manages interactions between managers

#### Initialization

```typescript
// Called during kernel bootstrap (storage-phase.ts)
const orchestrator = new CacheInvalidationOrchestrator();
orchestrator.initialize({
  cacheCapacity: {
    hardMaxBytes: 10485760,
    softThreshold: 0.9,
    targetAfterEviction: 0.7
  }
});
```

### Specialized Managers

#### CascadeManager

Manages parent-child dependency relationships with cycle detection.

**Core Data Structure:**
```typescript
class CascadeManager {
  private cascades = new Map<string, string[]>();
  // parentPattern -> childPatterns[]
}
```

**Key Methods:**
- `registerCascade(parent, children)`: Stores dependency mapping
- `getDependencies(parent)`: Returns child patterns for invalidation
- `detectCycles()`: Prevents infinite loops during registration

**Cycle Detection Algorithm:**
```typescript
private detectCycles(parent: string, children: string[]): boolean {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  const hasCycle = (node: string): boolean => {
    if (recursionStack.has(node)) return true;
    if (visited.has(node)) return false;

    visited.add(node);
    recursionStack.add(node);

    const deps = this.cascades.get(node) || [];
    for (const dep of deps) {
      if (hasCycle(dep)) return true;
    }

    recursionStack.delete(node);
    return false;
  };

  return children.some(child => hasCycle(child));
}
```

#### ConditionalFilter

Provides predicate-based entry filtering with pattern matching.

**Core Algorithm:**
```typescript
async invalidateIfMatches(
  pattern: string,
  predicate: ConditionalPredicate,
  getCacheStats: () => CacheStats,
  delegateInvalidate: (keys: string[]) => Promise<InvalidationResult>
): Promise<ConditionalInvalidationResult> {
  // 1. Get all cache entries
  const stats = getCacheStats();

  // 2. Filter entries matching pattern + predicate
  const matchingKeys: string[] = [];
  for (const entry of stats.entries) {
    if (patternMatches(entry.key, pattern) && predicate(entry.key, entry)) {
      matchingKeys.push(entry.key);
    }
  }

  // 3. Delegate invalidation
  const result = await delegateInvalidate(matchingKeys);

  return {
    invalidatedCount: result.invalidatedCount,
    scannedCount: stats.entries.length,
    errors: result.errors
  };
}
```

#### TransactionCoordinator

Implements atomic batch operations with snapshot/restore semantics.

**Transaction Flow:**
```typescript
async transaction<T>(
  operation: (context: TransactionContext) => Promise<T>,
  config: TransactionConfig
): Promise<TransactionResult> {
  // 1. Create snapshot
  const snapshot = config.getSnapshot();

  // 2. Execute operation with transaction context
  const context = new TransactionContextImpl();
  let operationResult: T;

  try {
    operationResult = await operation(context);
  } catch (error) {
    // 3. Rollback on error
    await config.restoreSnapshot(snapshot);
    throw error;
  }

  // 4. Execute queued invalidations
  const invalidationResult = await config.executeInvalidations(
    context.getQueuedInvalidations()
  );

  // 5. Rollback if invalidations failed
  if (invalidationResult.errors.length > 0) {
    await config.restoreSnapshot(snapshot);
  }

  return {
    success: invalidationResult.errors.length === 0,
    invalidatedCount: invalidationResult.invalidatedCount,
    invalidationErrors: invalidationResult.errors,
    snapshotRestored: invalidationResult.errors.length > 0
  };
}
```

#### DeferredQueue

Manages scheduled invalidations with timeout cleanup.

**Implementation:**
```typescript
class DeferredQueue {
  private queue = new Map<string, DeferredItem>();

  async invalidateAfter(
    delayMs: number,
    patterns: string[],
    executor: (patterns: string[]) => Promise<ExecutionResult>
  ): Promise<DeferredScheduleResult> {
    const id = generateId();

    const timeoutId = setTimeout(async () => {
      try {
        await executor(patterns);
      } finally {
        this.queue.delete(id);
      }
    }, delayMs);

    const item: DeferredItem = {
      id,
      patterns,
      delayMs,
      scheduledAt: Date.now(),
      timeoutId,
      cancel: () => {
        clearTimeout(timeoutId);
        this.queue.delete(id);
      }
    };

    this.queue.set(id, item);
    return { id, patterns, delayMs, cancelFn: item.cancel };
  }
}
```

### LRU Eviction Manager

Automatic capacity management with configurable thresholds.

**Core Algorithm:**
```typescript
class LRUEvictionManager {
  private entries = new Map<string, LRUEntry>();
  private totalSize = 0;

  initialize(config: LRUCapacityConfig) {
    this.config = config;
  }

  trackEntry(key: string, sizeBytes: number) {
    const entry: LRUEntry = {
      key,
      sizeBytes,
      lastAccessTime: Date.now()
    };

    this.entries.set(key, entry);
    this.totalSize += sizeBytes;

    // Check if we need to evict
    if (this.shouldEvict()) {
      this.evictToTarget();
    }
  }

  private shouldEvict(): boolean {
    return this.totalSize > this.config.hardMaxBytes * this.config.softThreshold;
  }

  private evictToTarget(): EvictionResult {
    // Sort by access time (oldest first)
    const sortedEntries = Array.from(this.entries.values())
      .sort((a, b) => a.lastAccessTime - b.lastAccessTime);

    let evictedBytes = 0;
    const targetSize = this.config.hardMaxBytes * this.config.targetAfterEviction;

    for (const entry of sortedEntries) {
      if (this.totalSize - evictedBytes <= targetSize) break;

      this.entries.delete(entry.key);
      evictedBytes += entry.sizeBytes;
      this.totalSize -= entry.sizeBytes;

      // Notify cache to remove entry
      this.onEntryEvicted(entry.key);
    }

    return {
      evictedCount: sortedEntries.length,
      freedBytes: evictedBytes,
      currentSize: this.totalSize,
      durationMs: Date.now() - startTime
    };
  }
}
```

## Integration Points

### QueryCache Integration

The QueryCache acts as the main API facade, delegating advanced operations to the orchestrator.

**Method Mapping:**
```typescript
class QueryCacheClass {
  // Basic operations (internals)
  async get() { /* ... */ }
  async set() { /* ... */ }

  // Advanced operations (orchestrator)
  async registerCascade(parent, children) {
    return orchestrator.registerCascade(parent, children);
  }

  async invalidateIfMatches(pattern, predicate) {
    // Provide cache access to orchestrator
    const getCacheStats = () => this.getCacheStats();
    const delegate = (keys) => this.invalidateKeys(keys);
    return orchestrator.invalidateIfMatches(pattern, predicate, getCacheStats, delegate);
  }

  // ... other advanced methods
}
```

### Kernel Bootstrap Integration

The system initializes during the storage phase of app bootstrap.

**storage-phase.ts:**
```typescript
export async function storagePhase(): Promise<void> {
  // ... other initialization

  // Initialize cache invalidation system
  if (appConfig.cacheCapacity) {
    const { cacheInvalidationOrchestrator } = await import("@/system/Storage/");
    cacheInvalidationOrchestrator.initialize({ cacheCapacity: appConfig.cacheCapacity });
  }
}
```

### Type System Integration

Shared types ensure consistency across the system.

**cache-invalidation.ts:**
```typescript
// Error types
export class CacheInvalidationError extends Error {
  constructor(
    public readonly code: 'INVALID_PARAMS' | 'EXECUTION_FAILED' | 'VALIDATION_FAILED',
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'CacheInvalidationError';
  }
}

// Operation types
export interface TransactionResult {
  success: boolean;
  invalidatedCount: number;
  invalidationErrors: { key: string; error: Error }[];
  snapshotRestored: boolean;
  durationMs: number;
}

// ... other shared interfaces
```

## Error Handling Strategy

### Validation Layer

All operations validate inputs at the orchestrator level before delegation.

**Validation Examples:**
```typescript
// Pattern validation
private isValidPattern(pattern: string): boolean {
  return typeof pattern === 'string' && pattern.length > 0;
}

// Array validation
private validateChildPatterns(patterns: string[]): boolean {
  return Array.isArray(patterns) &&
         patterns.length > 0 &&
         patterns.every(p => this.isValidPattern(p));
}
```

### Error Propagation

Errors are standardized and include context for debugging.

**Error Flow:**
```
Manager throws Error → Orchestrator catches → Converts to CacheInvalidationError → Logs → Re-throws
```

### Recovery Mechanisms

- **Transaction Rollback**: Automatic snapshot restoration
- **Deferred Cleanup**: Timeout-based cleanup prevents memory leaks
- **Capacity Enforcement**: Automatic eviction prevents OOM
- **Graceful Degradation**: System continues operating even if some operations fail

## Performance Optimizations

### Memory Management

- **Lazy Initialization**: Managers created only when needed
- **Snapshot Optimization**: Shallow copies for transaction snapshots
- **Timer Cleanup**: Automatic cleanup of deferred operations
- **Size Tracking**: Efficient byte counting for capacity management

### Algorithm Optimizations

- **Pattern Matching**: Glob pattern compilation and caching
- **LRU Ordering**: Timestamp-based sorting for eviction
- **Batch Operations**: Single pass for multiple invalidations
- **Early Termination**: Stop scanning when limits reached

### Caching Optimizations

- **Dependency Resolution**: Cached cascade dependency lookups
- **Pattern Compilation**: Pre-compiled regex for pattern matching
- **Stats Aggregation**: Lazy calculation of statistics

## Testing Strategy

### Unit Tests

Each manager has comprehensive unit tests covering:

**CascadeManager Tests:**
```typescript
describe('CascadeManager', () => {
  it('should register and retrieve cascades', () => {
    manager.registerCascade('parent', ['child1', 'child2']);
    expect(manager.getDependencies('parent')).toEqual(['child1', 'child2']);
  });

  it('should detect circular dependencies', () => {
    manager.registerCascade('A', ['B']);
    expect(() => manager.registerCascade('B', ['A'])).toThrow(CacheInvalidationError);
  });
});
```

**TransactionCoordinator Tests:**
```typescript
describe('TransactionCoordinator', () => {
  it('should rollback on operation failure', async () => {
    const result = await coordinator.transaction(async (tx) => {
      tx.invalidate('key1');
      throw new Error('Operation failed');
    });

    expect(result.success).toBe(false);
    expect(result.snapshotRestored).toBe(true);
  });
});
```

### Integration Tests

End-to-end tests validate the complete system:

```typescript
describe('Cache Invalidation Integration', () => {
  it('should cascade + transaction + capacity management', async () => {
    // Register cascades
    await QueryCache.registerCascade('world:123', ['world:123:*']);

    // Perform transactional invalidation
    const result = await QueryCache.transaction(async (tx) => {
      tx.invalidate('world:123'); // Cascades to children
    });

    // Verify capacity management
    const capacity = await QueryCache.getLRUCapacityStats();
    expect(capacity.currentSize).toBeLessThan(capacity.hardMaxBytes);
  });
});
```

### Performance Benchmarks

Automated benchmarks ensure performance requirements:

```typescript
describe('Performance Benchmarks', () => {
  benchmark('cascade resolution', async () => {
    await QueryCache.registerCascade('parent', Array.from({length: 100}, (_, i) => `child${i}`));
    await QueryCache.getCascadeDependencies('parent');
  });

  benchmark('conditional filtering', async () => {
    // Populate cache with 1000 entries
    await QueryCache.invalidateIfMatches('pattern:*', () => true);
  });
});
```

## Security Considerations

### Input Validation

All user inputs are validated to prevent malicious patterns:

- **Pattern Injection**: Patterns validated for safe glob syntax
- **Predicate Safety**: Predicates executed in try-catch blocks
- **Key Sanitization**: Cache keys validated for length and format

### Resource Limits

Built-in limits prevent abuse:

- **Cascade Depth**: Maximum 10 levels to prevent infinite loops
- **Transaction Size**: Maximum 100 operations per transaction
- **Deferred Queue**: Maximum 50 concurrent deferred operations
- **Pattern Complexity**: Regex compilation timeout

### Audit Logging

All operations are logged for security monitoring:

```typescript
logger.category('storage').info('Cache invalidation', {
  operation: 'invalidateIfMatches',
  pattern,
  invalidatedCount: result.invalidatedCount,
  durationMs: Date.now() - startTime
});
```

## Migration & Compatibility

### Backward Compatibility

The system maintains full backward compatibility:

- **Existing APIs**: All basic QueryCache methods work unchanged
- **Optional Configuration**: Advanced features only activate with config
- **Graceful Degradation**: System works without cache invalidation features

### Version Management

Schema versioning for stored cache entries:

```typescript
interface CacheEntry {
  data: any;
  version: number;        // Schema version
  timestamp: number;
  compressed?: boolean;   // Future compression flag
  cascadeId?: string;     // Future cascade tracking
}
```

### Configuration Migration

Automatic config validation and migration:

```typescript
// Validate and migrate config during initialization
function validateCacheCapacityConfig(config: any): LRUCapacityConfig {
  const defaults = {
    hardMaxBytes: 10 * 1024 * 1024, // 10MB
    softThreshold: 0.9,
    targetAfterEviction: 0.7
  };

  return {
    hardMaxBytes: config.hardMaxBytes || defaults.hardMaxBytes,
    softThreshold: config.softThreshold || defaults.softThreshold,
    targetAfterEviction: config.targetAfterEviction || defaults.targetAfterEviction
  };
}
```

## Monitoring & Observability

### Metrics Collection

Built-in metrics for monitoring system health:

```typescript
interface CacheInvalidationMetrics {
  operationsCount: number;
  errorCount: number;
  averageLatency: number;
  cascadeDepth: number;
  transactionRollbackCount: number;
  capacityEvictionCount: number;
}
```

### Health Checks

Automated health checks for system validation:

```typescript
async function checkCacheInvalidationHealth(): Promise<HealthStatus> {
  try {
    // Test cascade registration
    await QueryCache.registerCascade('health:check', ['health:child']);
    const deps = await QueryCache.getCascadeDependencies('health:check');

    // Test transaction
    const result = await QueryCache.transaction(async (tx) => {
      tx.invalidate('health:test');
    });

    // Test capacity
    const capacity = await QueryCache.getLRUCapacityStats();

    return {
      healthy: deps.length > 0 && result.success && capacity.currentSize >= 0,
      metrics: { /* collected metrics */ }
    };
  } catch (error) {
    return { healthy: false, error: error.message };
  }
}
```

## Future Extensibility

### Plugin Architecture

The orchestrator design allows for plugin extensions:

```typescript
interface CacheInvalidationPlugin {
  name: string;
  initialize(config: any): void;
  beforeOperation(operation: string, params: any): void;
  afterOperation(operation: string, result: any): void;
}

// Register custom plugins
orchestrator.registerPlugin(new CustomInvalidationPlugin());
```

### Advanced Patterns

Planned extensions for future needs:

- **Distributed Invalidation**: Cross-device cache coordination
- **Predictive Invalidation**: ML-based cache warming
- **Hierarchical Caching**: Multi-level cache with different policies
- **Cache Analytics**: Usage pattern analysis and optimization suggestions

This implementation provides a robust, scalable foundation for advanced cache invalidation while maintaining clean architecture and comprehensive error handling.</content>
<parameter name="filePath">p:\CodingProjects\dnd-toolkit\docs\issues\MileStone 2\Tier 6\189 - Advanced Cache Invalidation Patterns\IMPLEMENTATION_GUIDE.md