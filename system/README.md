# System Layer

Foundation layer providing app-agnostic, reusable services for storage, networking, job queuing, API communication, and system initialization. These modules are designed to be framework-independent and can be used across different applications.

## When to Use This Module

**Use this module if you need:**

- Encrypted, cross-platform storage with versioning and migration support
- Network connectivity detection and state management
- Background job queuing with persistence and retry logic
- HTTP client with resilience features (retry, caching, rate limiting)
- App bootstrap orchestration and phase management

**Do NOT use this module for:**

- Application-specific business logic (use lib/ modules instead)
- UI components or React-specific code
- Domain-specific data models or operations
- Feature flags or configuration (use lib/config)
- Authentication flows (use lib/auth)

## Architecture & Data Flow

```
Application Code
        ↓
lib/ Middleware (preconditions, validation)
        ↓
System Layer (pure infrastructure)
        ↓
Platform APIs (AsyncStorage, fetch, etc.)
```

**Key Principles:**

- **App-Agnostic**: No application-specific logic or dependencies
- **Framework-Independent**: Can be used with React Native, web, or other frameworks
- **Cross-Platform**: Consistent APIs across iOS, Android, web, and desktop
- **Resilient**: Built-in error handling, retry logic, and fallback mechanisms
- **Observable**: Event-driven architecture with status reporting

## API Reference

### Storage (`system/Storage/`)

Cross-platform encrypted storage with versioning and migration support.

#### `SecureStorage` Class

Main storage interface with encryption and versioning.

```typescript
class SecureStorage {
  static async getItem(key: string): Promise<string | null>
  static async setItem(key: string, value: string): Promise<void>
  static async removeItem(key: string): Promise<void>
  static async clear(): Promise<void>
  static async getAllKeys(): Promise<string[]>
}
```

**Example:**
```typescript
import { SecureStorage } from '@/system/Storage';

// Store encrypted data
await SecureStorage.setItem('user_session', sessionData);

// Retrieve with automatic decryption
const session = await SecureStorage.getItem('user_session');
```

#### Storage Versioning

Automatic data migration when storage schema changes.

```typescript
// Versioning handled automatically on app startup
// No manual migration code needed in application
```

### Network (`system/Network/`)

Network connectivity detection and state management.

#### `NetworkDetection` Class

Monitors network status and provides connectivity information.

```typescript
class NetworkDetection {
  static getCurrentState(): NetworkState
  static subscribe(callback: (state: NetworkState) => void): () => void
  static async isOnline(): Promise<boolean>
}
```

**Example:**
```typescript
import { NetworkDetection } from '@/system/Network';

const unsubscribe = NetworkDetection.subscribe((state) => {
  console.log('Network:', state.isConnected ? 'online' : 'offline');
});

// Check current status
const online = await NetworkDetection.isOnline();
```

### Jobs (`system/Jobs/`)

Background job queuing with persistence and execution.

#### `BackgroundJobQueue` Class

Queues and executes background tasks with retry logic.

```typescript
class BackgroundJobQueue {
  static async enqueue(job: Job): Promise<string>
  static async dequeue(jobId: string): Promise<Job | null>
  static async getStatus(jobId: string): Promise<JobStatus>
  static subscribe(callback: (event: JobEvent) => void): () => void
}
```

**Example:**
```typescript
import { BackgroundJobQueue } from '@/system/Jobs';

const jobId = await BackgroundJobQueue.enqueue({
  type: 'sync_data',
  payload: { userId: '123' },
  retryPolicy: { maxAttempts: 3, backoffMs: 1000 }
});
```

### API (`system/API/`)

HTTP client with resilience features and request management.

#### `RequestManager` Class

Handles HTTP requests with caching, retry, and offline support.

```typescript
class RequestManager {
  static async request<T>(config: RequestConfig): Promise<T>
  static async get<T>(url: string, config?: RequestConfig): Promise<T>
  static async post<T>(url: string, data?: any, config?: RequestConfig): Promise<T>
}
```

**Example:**
```typescript
import { RequestManager } from '@/system/API';

const data = await RequestManager.get('/api/worlds', {
  timeout: 5000,
  retry: { maxAttempts: 3 },
  cache: { ttl: 300000 } // 5 minutes
});
```

### Kernel (`system/Kernel/`)

App bootstrap orchestration and phase management.

#### `AppKernel` Class

Manages application initialization phases and startup sequence.

```typescript
class AppKernel {
  static async initialize(): Promise<void>
  static getCurrentPhase(): KernelPhase
  static subscribe(callback: (phase: KernelPhase) => void): () => void
}
```

**Example:**
```typescript
import { AppKernel } from '@/system/Kernel';

// Initialize app foundation
await AppKernel.initialize();

// Monitor startup progress
const unsubscribe = AppKernel.subscribe((phase) => {
  console.log('Phase:', phase);
});
```

### Degrade (`system/Degrade/`)

Graceful degradation framework for handling system failures and reduced functionality states.

#### `DegradationManager` Class

Manages system degradation levels and provides fallback strategies.

```typescript
class DegradationManager {
  static getCurrentLevel(): DegradationLevel
  static setLevel(level: DegradationLevel): void
  static subscribe(callback: (level: DegradationLevel) => void): () => void
  static isFeatureAvailable(feature: string): boolean
}
```

**Example:**
```typescript
import { DegradationManager } from '@/system/Degrade';

// Check if a feature is available under current degradation level
if (DegradationManager.isFeatureAvailable('offline_sync')) {
  // Use full functionality
} else {
  // Use degraded fallback
}

// Subscribe to degradation level changes
const unsubscribe = DegradationManager.subscribe((level) => {
  console.log('Degradation level:', level);
});
```

## Dependencies

### External Packages

- **`@react-native-async-storage/async-storage`** – Native storage backend
- **`expo-crypto`** – Encryption utilities
- **`expo-network`** – Network detection
- **None** – Jobs system is pure JavaScript

### Internal Dependencies

- **None** – System layer is the foundation and has no internal dependencies

## Error Handling & Edge Cases

### Storage Errors

**Corrupted Data:**
System automatically detects corruption and falls back to empty state. Application should handle missing data gracefully.

**Quota Exceeded:**
Storage operations throw `StorageQuotaExceededError`. Application should show user-friendly message and suggest cleanup.

**Platform Limitations:**
Some platforms have storage limits. System enforces reasonable defaults but applications should monitor usage.

### Network Errors

**Intermittent Connectivity:**
Network detection provides real-time status. Requests automatically queue when offline and retry when back online.

**DNS Failures:**
Network layer includes retry logic with exponential backoff for transient failures.

### Job Queue Errors

**Job Failures:**
Jobs automatically retry based on policy. Failed jobs are logged but don't crash the application.

**Storage Unavailable:**
Jobs persist to disk when possible. If storage fails, jobs are held in memory until storage recovers.

### API Errors

**Rate Limiting:**
Automatic retry with backoff when rate limited. Applications receive normal errors for business logic handling.

**Network Timeouts:**
Configurable timeouts with automatic retry. Long-running requests can be cancelled by application.

## Performance Notes

### Storage Performance

**Encryption Overhead:**
AES-CTR encryption adds ~10-20% overhead. Cached decryption for frequently accessed data.

**Migration Performance:**
Version migrations run once per version change. Large datasets may cause brief startup delay.

### Network Performance

**State Machine:**
Event-driven state changes with minimal polling. Network checks only when needed.

**Connection Pooling:**
HTTP client reuses connections for better performance.

### Jobs Performance

**Memory Usage:**
Jobs stored in memory with optional disk persistence. Memory usage scales with queue size.

**Execution Batching:**
Jobs can be batched for efficiency. Scheduler optimizes execution order.

### API Performance

**Request Deduplication:**
Identical concurrent requests are automatically deduplicated.

**Caching:**
Response caching reduces network calls. TTL-based expiration with manual invalidation.

## Related Modules

- **`lib/storage`** – Application-specific storage wrapper with business logic
- **`lib/network`** – Network middleware with preconditions and connectivity helpers
- **`lib/jobs`** – Job service wrapper with domain-specific job types
- **`lib/api`** – API client wrapper with request/response transformation
- **`lib/kernel`** – Application kernel wrapper with domain logic

## File Breakdown

| File | Purpose |
| ---- | ------ |
| `Storage/SecureStorage.ts` | Main encrypted storage interface |
| `Storage/encrypted-storage.ts` | AES-CTR encryption implementation |
| `Storage/versioning/` | Data migration and versioning logic |
| `Network/network-detection.ts` | Network connectivity monitoring |
| `Network/state-machine.ts` | Network state management |
| `Jobs/background-job-queue.ts` | Job queuing and execution |
| `Jobs/job-executor.ts` | Job execution lifecycle |
| `Jobs/job-scheduler.ts` | Job scheduling and batching |
| `API/request-manager.ts` | HTTP client with resilience |
| `API/resilience/` | Retry, caching, rate limiting logic |
| `Kernel/app-kernel.ts` | App bootstrap orchestration |
| `Services/` | Service adapters and initialization |</content>
<parameter name="filePath">p:\CodingProjects\dnd-toolkit\system\README.md