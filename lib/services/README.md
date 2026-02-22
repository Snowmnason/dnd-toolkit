# Services

Abstractions for external service integrations, API clients, and analytics exporters. Provides consistent interfaces for third-party services and pluggable backends with error handling and retry logic.

## When to Use This Module

**Use this module if you need to:**
- Integrate with external APIs or services
- Abstract service-specific logic behind consistent interfaces
- Handle service errors and retries uniformly
- Implement pluggable analytics exporters
- Create provider adapters for different backends

**Do NOT use this module for:**
- Internal app logic (use other lib modules)
- Direct HTTP requests (use `lib/network`)

## Architecture & Data Flow

```
Component
        ↓
Service Client (e.g., ApiService) or Analytics Exporter (e.g., SentryExporter)
        ↓
lib/network -> HTTP request or Provider-specific API
        ↓
Parse response / handle errors / queue for retry
```

**Key Principles:**
- **Abstraction**: Service-specific and provider-specific details are hidden behind interfaces.
- **Consistency**: All services and exporters follow similar patterns for requests, exports, and errors.
- **Pluggability**: Analytics exporters can be swapped or added without changing core logic.

## API Reference

### Service Interfaces

Define common interfaces for service clients.

### Analytics Exporter Interfaces

Define interfaces for pluggable analytics exporters:

- `AnalyticsExporter` — Contract for custom analytics backends
- `QueuedBreadcrumb` — Breadcrumb structure for offline queuing
- `BreadcrumbProvider` — Interface for breadcrumb delivery providers
- `BreadcrumbSendResult` — Result of sending breadcrumbs

### Service Clients

Concrete implementations for specific services.

### Analytics Exporters

Concrete implementations for analytics backends:

- `SentryAdapter` — Sentry-specific breadcrumb provider
- Future: `MixpanelExporter`, `SegmentExporter`, etc.

## Dependencies

### External Packages
- None specific (depends on services integrated)

### Internal Dependencies
- **`lib/network`** – HTTP client and request handling
- **`lib/error`** – Error handling and categorization
- **`lib/analytics`** – Analytics event types and exporter interfaces

## Error Handling & Edge Cases

### Service Unavailable
Services should handle downtime gracefully with retries and fallbacks.

### Rate Limiting
Implement backoff strategies for rate-limited services.

## Performance Notes

Service calls should be cached where appropriate to reduce external requests.

## Related Modules
- **`lib/network`** – Low-level HTTP and network handling
- **`lib/error`** – Error processing and user feedback
- **`lib/analytics`** – Analytics system that uses service exporters

## File Breakdown
| File | Purpose |
| ---- | ------- |
| `provider-adapter.ts` | Defines provider-agnostic interfaces for breadcrumb providers (QueuedBreadcrumb, BreadcrumbSendResult, etc.) |
| `sentry/sentry-adapter.ts` | Sentry-specific implementation of BreadcrumbProvider interface |
| `auth-provider.ts` | AuthProvider interface and registration API for pluggable auth backends |
| `supabase/supabase-auth-provider.ts` | SupabaseAuthProvider implementation of AuthProvider interface |
| `service-initializer.ts` | Registers default providers (SupabaseAuthProvider) during kernel bootstrap |

## Auth Providers

This module provides abstraction for authentication backends, enabling multi-provider support and dependency injection. Auth providers can be swapped via configuration without changing app code.

### When to Use This Module

**Use this module if you need to:**
- Abstract auth backend logic behind consistent interfaces
- Support multiple auth providers (Supabase, Firebase, custom backends)
- Implement dependency injection for auth systems
- Create reusable auth modules across projects
- Handle auth provider errors uniformly

**Do NOT use this module for:**
- Internal auth state management (use `lib/auth`)
- Route protection logic (use `lib/auth/useAuthGuard`)
- Auth UI components (use app-level components)

### Architecture & Data Flow

```
App Startup
        ↓
Kernel Bootstrap → Service Initializer
        ↓
registerAuthProvider(SupabaseAuthProvider)
        ↓
AuthStateManager.configure(provider)
        ↓
Auth Operations (signUp, signIn, etc.)
        ↓
Provider Interface → Backend API (Supabase/Firebase/Custom)
        ↓
Normalized Response/Error
```

**Key Principles:**
- **Provider Abstraction**: Auth backend details hidden behind `AuthProvider` interface
- **Dependency Injection**: Providers injected at runtime via `registerAuthProvider()`
- **Error Normalization**: Provider-specific errors mapped to common types
- **Backward Compatibility**: Supabase remains default; no breaking changes

### API Reference

#### AuthProvider Interface

Core interface that all auth providers must implement:

```typescript
export interface Session {
  userId: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  raw?: any; // provider-specific payload
}

export type AuthResult<T = Session> = 
  | { success: true; data: T }
  | { success: false; error: AuthError };

export interface AuthProvider {
  signUp(email: string, password: string): Promise<AuthResult>;
  signIn(email: string, password: string): Promise<AuthResult>;
  resetPassword(email: string): Promise<{ success: boolean; message?: string }>;
  getSession(): Promise<Session | null>;
  onAuthStateChange(callback: (session: Session | null) => void): () => void;
  signOut(): Promise<void>;
  restoreSession(rawSession: any): Promise<boolean>;
}
```

#### Common Error Types

Normalized error classes for consistent error handling:

- `AuthError` (base class)
- `InvalidCredentialsError` — Wrong email/password
- `NetworkError` — Connection issues
- `UserNotFoundError` — Account doesn't exist
- `EmailAlreadyExistsError` — Duplicate email on signup

All errors include an optional `.original` field with the provider-specific error and a `toLog()` method that redacts PII.

#### Registration API

```typescript
// Register a provider (async operation)
registerAuthProvider(provider: AuthProvider | (() => Promise<AuthProvider>)): Promise<void>;

// Get the registered provider (async)
getAuthProvider(): Promise<AuthProvider>;

// Get the registered provider synchronously (returns null if not set)
getAuthProviderSync(): AuthProvider | null;

// Get debug info about the registered provider
getProviderDebugInfo(): { name: string; isConfigured: boolean; ... };
```

#### Usage Example

```typescript
import { registerAuthProvider, SupabaseAuthProvider } from '@/lib/services';

// Register default Supabase provider
await registerAuthProvider(new SupabaseAuthProvider(supabaseClient));

// Get the provider (async)
const provider = await getAuthProvider();
await provider.signIn('user@example.com', 'password');

// Or use sync variant for non-async contexts (returns null if not set)
const providerSync = getAuthProviderSync();
if (providerSync) {
  // provider is available
}
```

### Supported Providers

- **SupabaseAuthProvider** — Reference implementation for Supabase Auth
- **FirebaseAuthProvider** — Future: Firebase Authentication wrapper
- **Custom Backend** — Implement `AuthProvider` interface for any auth service

### Dependencies

#### External Packages
- `@supabase/supabase-js` — For SupabaseAuthProvider (optional)
- `firebase/auth` — For future FirebaseAuthProvider (optional)

#### Internal Dependencies
- **`lib/kernel`** — Provider registration during bootstrap
- **`lib/auth`** — AuthStateManager uses injected provider
- **`lib/error`** — Error categorization and logging
- **`lib/logger`** — Auth error logging with category `'auth'`

### Error Handling & Edge Cases

#### Provider Initialization Failure
- Logged with category `'auth'`
- App can degrade to offline mode or anonymous access
- Clear error message: "Auth provider initialization failed"

#### Session Refresh Failures
- Provider handles retry logic internally
- AuthStateManager falls back to stored session if refresh fails
- Triggers re-authentication flow if session becomes invalid

#### Network Errors
- Mapped to `NetworkError` with retry suggestions
- User-facing message: "Check your connection and try again"

#### Provider-Specific Errors
- Normalized to common error types
- Original error preserved in `.original` field for debugging
- PII redacted before logging

### Provider Implementation Guide

#### Adding a New Provider

1. **Implement AuthProvider Interface**

```typescript
import { AuthProvider, AuthResult, Session, InvalidCredentialsError } from '@/lib/services';

export class MyAuthProvider implements AuthProvider {
  constructor(private config: MyConfig) {}

  async signUp(email: string, password: string): Promise<AuthResult> {
    try {
      const result = await this.api.signUp(email, password);
      return { success: true, data: this.mapToSession(result) };
    } catch (error) {
      if (error.code === 'EMAIL_EXISTS') {
        throw new EmailAlreadyExistsError('Account already exists', { original: error });
      }
      throw new InvalidCredentialsError('Signup failed', { original: error });
    }
  }

  // Implement other methods...
}
```

2. **Error Mapping**

Map provider-specific errors to common types:

```typescript
private mapError(error: any): AuthError {
  switch (error.code) {
    case 'INVALID_CREDENTIALS':
      return new InvalidCredentialsError('Invalid email or password');
    case 'NETWORK_ERROR':
      return new NetworkError('Connection failed');
    default:
      return new AuthError('Authentication failed');
  }
}
```

3. **Session Mapping**

Convert provider-specific session to common format:

```typescript
private mapToSession(providerSession: any): Session {
  return {
    userId: providerSession.user.id,
    accessToken: providerSession.access_token,
    refreshToken: providerSession.refresh_token,
    expiresAt: providerSession.expires_at,
    raw: providerSession, // Keep original for advanced use
  };
}
```

#### Firebase Example

```typescript
import { AuthProvider, AuthResult, Session } from '@/lib/services';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

export class FirebaseAuthProvider implements AuthProvider {
  constructor(private auth = getAuth()) {}

  async signIn(email: string, password: string): Promise<AuthResult> {
    try {
      const result = await signInWithEmailAndPassword(this.auth, email, password);
      const token = await result.user.getIdToken();
      return {
        success: true,
        data: {
          userId: result.user.uid,
          accessToken: token,
          raw: result,
        },
      };
    } catch (error) {
      throw new InvalidCredentialsError('Invalid credentials', { original: error });
    }
  }

  // Implement other methods...
}
```

### Registration & Initialization

Providers are registered during kernel bootstrap via `service-initializer.ts`:

```typescript
// lib/services/service-initializer.ts
export async function initializeServices() {
  // Register default Supabase provider
  const supabaseClient = createSupabaseClient();
  registerAuthProvider(new SupabaseAuthProvider(supabaseClient));
  
  // Future: conditional registration based on config
  // if (config.services?.auth?.provider === 'firebase') {
  //   registerAuthProvider(new FirebaseAuthProvider());
  // }
}
```

The kernel calls this during the CONFIG phase, ensuring providers are ready before auth operations begin.

### Related Modules

- **`lib/kernel`** — Calls service initializer during bootstrap
- **`lib/auth`** — AuthStateManager uses injected provider
- **`lib/auth/useAuthGuard`** — Route protection works with any provider
- **`lib/database`** — Database provider abstraction (#255)
- **`lib/error`** — Error tracker provider (#254)

### Testing

#### Unit Test Patterns

Mock providers for testing AuthStateManager:

```typescript
import { AuthProvider, AuthResult } from '@/lib/services';

const mockProvider: AuthProvider = {
  signIn: vi.fn().mockResolvedValue({
    success: true,
    data: { userId: '123', accessToken: 'token' }
  }),
  // Mock other methods...
};

// Test AuthStateManager with injected provider
await AuthStateManager.configure(mockProvider);
```

#### Provider Testing

Test provider implementations in isolation:

```typescript
describe('SupabaseAuthProvider', () => {
  it('maps Supabase errors correctly', async () => {
    // Mock Supabase to throw AuthError
    // Assert InvalidCredentialsError is thrown
  });
});
```

### Future Enhancements

- **OAuth/SSO Providers** — Extend interface for social login
- **Passwordless Auth** — Add `sendMagicLink()`, `verifyMagicLink()` methods
- **Multi-Factor Authentication** — MFA coordination across providers
- **Session Persistence Wrapper** — Provider-agnostic session storage
- **Runtime Provider Switching** — Hot-swap providers without restart

This module is designed to be **app-agnostic** — no dnd-toolkit specifics, enabling reuse in future projects with different auth backends.