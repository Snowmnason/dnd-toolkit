# Lib Layer

Domain-specific application modules providing business logic, data management, authentication, and cross-cutting concerns. Each module follows consistent patterns for configuration, error handling, and type safety, building on the system foundation layer.

## When to Use This Module

**Use this module if you need:**

- Authentication, session management, and route protection
- Database queries, mutations, and data synchronization
- Feature flags and configuration management
- Error handling and user-friendly error messages
- Analytics tracking and performance monitoring
- Navigation helpers and route configuration
- Offline data synchronization and conflict resolution
- Premium subscription management and entitlements

**Do NOT use this module for:**

- Low-level storage or networking (use system/ modules)
- UI components or styling (use components/)
- React-specific hooks (use hooks/)
- Platform-specific code (keep in system/)

## Architecture & Data Flow

```
Screens/Components
        ↓
Hooks Layer (UI formatting, error handling)
        ↓
Lib Layer (business logic, managers)
        ↓
System Layer (infrastructure, storage, network)
        ↓
Platform APIs
```

**Key Principles:**

- **Manager Pattern**: Each domain has a manager providing clean API to hooks/screens
- **Middleware Layer**: Preconditions, validation, and service checks before system calls
- **Type Safety**: Full TypeScript coverage with strict error handling
- **Separation of Concerns**: Business logic separate from UI and infrastructure
- **Observable**: Event-driven architecture with proper state management

## API Reference

### Core Managers

#### `AuthManager` (`lib/auth/`)

Authentication and session management.

```typescript
class AuthManager {
  static async signIn(email: string, password: string): Promise<AuthResult>
  static async signOut(): Promise<void>
  static async getSession(): Promise<Session | null>
  static async resetPassword(email: string): Promise<{ success: boolean }>
}
```

**Example:**
```typescript
import { AuthManager } from '@/lib/auth';

const result = await AuthManager.signIn(email, password);
if (result.success) {
  // Handle successful login
}
```

#### `DatabaseManager` (`lib/database/`)

Database operations and query coordination.

```typescript
class DatabaseManager {
  static async getWorlds(userId: string): Promise<World[]>
  static async createWorld(world: WorldInput): Promise<World>
  static async updateWorld(worldId: string, updates: Partial<World>): Promise<World>
}
```

**Example:**
```typescript
import { DatabaseManager } from '@/lib/database';

const worlds = await DatabaseManager.getWorlds(currentUser.id);
```

#### `FeatureFlagsManager` (`lib/feature-flags/`)

Feature flag evaluation and synchronization.

```typescript
class FeatureFlagsManager {
  static async isEnabled(flagName: string, userId?: string): Promise<boolean>
  static async getVariant(flagName: string, userId?: string): Promise<string>
  static subscribe(callback: (flags: FeatureFlags) => void): () => void
}
```

**Example:**
```typescript
import { FeatureFlagsManager } from '@/lib/feature-flags';

const enabled = await FeatureFlagsManager.isEnabled('newUI');
```

#### `RealtimeManager` (`lib/realtime/`)

Real-time event subscriptions and live updates.

```typescript
class RealtimeManager {
  static subscribe(channel: string, handler: RealtimeHandler): () => void
  static unsubscribe(channel: string, handler: RealtimeHandler): void
  static publish(channel: string, payload: any): void
  static getConnectedChannels(): string[]
}
```

**Example:**
```typescript
import { RealtimeManager } from '@/lib/realtime';

const unsubscribe = RealtimeManager.subscribe('world_updates', (payload) => {
  console.log('World updated:', payload);
});
```

### Utility Modules

#### Logger (`lib/utils/`)

Category-based logging with feature flag control.

```typescript
const logger = {
  category(cat: string): CategoryLogger,
  debug(category: string, message: string, ...args: any[]): void,
  info(category: string, message: string, ...args: any[]): void,
  warn(category: string, message: string, ...args: any[]): void,
  error(category: string, message: string, ...args: any[]): void,
  success(category: string, message: string, ...args: any[]): void
};
```

**Example:**
```typescript
import { logger } from '@/lib/utils';

logger.category('auth').info('User logged in', { userId });
```

#### Error Classes (`lib/error/`)

Type-safe error handling with metadata.

```typescript
class AppError extends Error {
  constructor(code: string, message: string, cause?: Error);
  readonly code: string;
  readonly category: string;
  readonly severity: ErrorSeverity;
  readonly recoverable: boolean;
}
```

**Example:**
```typescript
import { AppError, ERROR_CODES } from '@/lib';

throw new AppError(ERROR_CODES.AUTH.INVALID_CREDENTIALS, 'Invalid login');
```

## Configuration

Configuration is managed through `appsettings.json` files with environment-specific overrides.

```json
{
  "featureFlags": {
    "debugLogs": false,
    "analyticsEnabled": true
  },
  "api": {
    "baseUrl": "https://api.example.com",
    "timeout": 30000
  }
}
```

## Dependencies

### External Packages

- **`@supabase/supabase-js`** – Database and auth backend
- **`zod`** – Runtime type validation
- **`react-query`** – Data fetching and caching
- **`sentry`** – Error tracking and monitoring

### Internal Dependencies

- **`system/Storage`** – Encrypted storage for sensitive data
- **`system/Network`** – Network connectivity detection
- **`system/API`** – HTTP client with resilience
- **`system/Jobs`** – Background job processing

## Error Handling & Edge Cases

### Authentication Errors

**Session Expiry:**
Automatic token refresh with fallback to re-authentication. Users see clear messaging about expired sessions.

**Network Issues:**
Auth operations retry automatically. Offline auth uses cached sessions with reduced functionality.

### Database Errors

**Connection Failures:**
Automatic retry with exponential backoff. Offline operations queue for later sync.

**Permission Errors:**
Clear error messages guide users to contact support or check permissions.

### Configuration Errors

**Missing Settings:**
Graceful fallbacks to defaults. Critical missing config throws early with clear messaging.

**Invalid Values:**
Runtime validation catches configuration errors. Development mode shows warnings.

## Performance Notes

### Query Optimization

**Caching Strategy:**
React Query provides intelligent caching. Database queries use connection pooling and prepared statements.

**Batch Operations:**
Multiple related operations are batched to reduce network round trips.

### Memory Management

**Cleanup:**
Event listeners and subscriptions are properly cleaned up. Long-running operations have cancellation support.

**Lazy Loading:**
Heavy modules load on-demand to reduce initial bundle size.

## Observability & Analytics

### Event Tracking

**User Actions:**
Key user interactions are tracked for analytics and product insights.

**Performance Metrics:**
Startup time, query performance, and error rates are monitored.

**Logger Categories:**
- `auth` – Authentication events
- `database` – Query performance and errors
- `network` – Connectivity and API calls
- `performance` – Startup and rendering metrics

## Related Modules

- **`system/`** – Foundation infrastructure layer
- **`hooks/`** – React hooks for UI integration
- **`providers/`** – React context providers
- **`components/ui/`** – Reusable UI components

## File Breakdown

| File | Purpose |
| ---- | ------ |
| `auth/auth-manager.ts` | Authentication orchestration |
| `database/database-manager.ts` | Database query coordination |
| `error/app-error.ts` | Type-safe error classes |
| `feature-flags/feature-flags-manager.ts` | Feature flag evaluation |
| `kernel/use-app-kernel.tsx` | App bootstrap and phases |
| `navigation/navigation-config.ts` | Route definitions |
| `network/network-service.ts` | Network middleware |
| `offline/offline-manager.ts` | Offline sync coordination |
| `storage/storage-service.ts` | Storage middleware |
| `utils/logger.ts` | Category-based logging |
| `utils/ERROR_CODES.ts` | Centralized error codes |
