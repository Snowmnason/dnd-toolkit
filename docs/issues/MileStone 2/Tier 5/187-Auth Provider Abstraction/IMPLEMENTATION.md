# Auth Provider Abstraction: Implementation Guide

This document provides technical details about the auth provider abstraction implementation, including architecture decisions, interface design, error handling patterns, and integration points.

## Architecture Overview

The auth provider abstraction follows a dependency injection pattern where auth backends are pluggable components that implement a common interface.

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Application   │────│  AuthStateManager │────│  AuthProvider  │
│                 │    │                  │    │   Interface     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                │                        │
                       ┌────────▼────────┐    ┌──────────▼──────────┐
                       │ Service Layer   │    │ Concrete Providers │
                       │ (Registration)  │    │                   │
                       └─────────────────┘    │ • SupabaseAuth     │
                                              │ • FirebaseAuth     │
                                              │ • CustomAuth       │
                                              └────────────────────┘
```

## Core Interfaces

### AuthProvider Interface

The `AuthProvider` interface defines the contract that all auth backends must implement:

```typescript
export interface Session {
  userId: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  raw?: any; // Provider-specific data
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
}
```

**Design Decisions:**
- **Async Methods**: All methods return `Promise` to support network calls
- **Unified Result Type**: `AuthResult` provides consistent success/error handling
- **Session Object**: Standardized session format with optional provider-specific data
- **Unsubscribe Pattern**: `onAuthStateChange` returns cleanup function

### Error Hierarchy

```typescript
export class AuthError extends Error {
  constructor(message: string, public original?: any) {
    super(message);
    this.name = 'AuthError';
  }

  toLog(): string {
    // Redacts PII for logging
    return `[${this.name}] ${this.message}`;
  }
}

export class InvalidCredentialsError extends AuthError {
  constructor(message = 'Invalid credentials', original?: any) {
    super(message, original);
    this.name = 'InvalidCredentialsError';
  }
}

export class NetworkError extends AuthError {
  constructor(message = 'Network error', original?: any) {
    super(message, original);
    this.name = 'NetworkError';
  }
}

export class UserNotFoundError extends AuthError {
  constructor(message = 'User not found', original?: any) {
    super(message, original);
    this.name = 'UserNotFoundError';
  }
}

export class EmailAlreadyExistsError extends AuthError {
  constructor(message = 'Email already exists', original?: any) {
    super(message, original);
    this.name = 'EmailAlreadyExistsError';
  }
}
```

**Error Design Principles:**
- **Hierarchical**: Base `AuthError` with specific subclasses
- **PII Protection**: `toLog()` method redacts sensitive data
- **Original Error**: Preserved for debugging while maintaining abstraction
- **Serializable**: Errors can be logged and transmitted safely

## Provider Registration System

### Registration API

```typescript
// lib/services/auth-provider.ts

let currentProvider: AuthProvider | null = null;

export function registerAuthProvider(
  provider: AuthProvider | (() => Promise<AuthProvider>)
): void {
  if (typeof provider === 'function') {
    // Async factory - resolve immediately
    provider().then(resolved => {
      currentProvider = resolved;
    }).catch(error => {
      logger.category('auth').error('Provider registration failed', { error });
      throw error;
    });
  } else {
    currentProvider = provider;
  }
}

export function getAuthProvider(): AuthProvider {
  if (!currentProvider) {
    throw new Error(
      'Auth provider not initialized. Call registerAuthProvider() during app bootstrap.'
    );
  }
  return currentProvider;
}

export function listRegisteredProviders(): string[] {
  return currentProvider ? [currentProvider.constructor.name] : [];
}
```

**Registration Features:**
- **Sync/Async Support**: Accepts both instances and factory functions
- **Singleton Pattern**: Only one provider active at a time
- **Guard Checks**: Prevents auth calls before provider registration
- **Error Handling**: Logs registration failures

### Kernel Integration

```typescript
// lib/kernel/app-kernel.ts

export class AppKernel {
  private phases = {
    servicesReady: false,
    authReady: false,
    appReady: false
  };

  async initialize() {
    try {
      // Phase 1: Register services
      await this.initializeServices();
      this.phases.servicesReady = true;

      // Phase 2: Configure auth
      await this.initializeAuth();
      this.phases.authReady = true;

      // Phase 3: Complete bootstrap
      this.phases.appReady = true;

    } catch (error) {
      logger.category('kernel').error('Bootstrap failed', { error });
      throw error;
    }
  }

  private async initializeServices() {
    // Register default Supabase provider
    const supabaseClient = createSupabaseClient();
    registerAuthProvider(new SupabaseAuthProvider(supabaseClient));
  }

  private async initializeAuth() {
    // Configure AuthStateManager with injected provider
    const provider = getAuthProvider();
    AuthStateManager.configure(provider);
  }
}
```

## SupabaseAuthProvider Implementation

### Constructor and Setup

```typescript
// lib/services/supabase/supabase-auth-provider.ts

export class SupabaseAuthProvider implements AuthProvider {
  constructor(private supabase: SupabaseClient) {
    // Validate client configuration
    if (!supabase) {
      throw new Error('Supabase client is required');
    }
  }
}
```

### Method Implementations

```typescript
async signUp(email: string, password: string): Promise<AuthResult> {
  try {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      throw this.mapSupabaseError(error);
    }

    return {
      success: true,
      data: this.mapToSession(data.session)
    };
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    throw new NetworkError('Signup failed', { original: error });
  }
}

async signIn(email: string, password: string): Promise<AuthResult> {
  try {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw this.mapSupabaseError(error);
    }

    return {
      success: true,
      data: this.mapToSession(data.session)
    };
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    throw new NetworkError('Sign in failed', { original: error });
  }
}

async resetPassword(email: string): Promise<{ success: boolean; message?: string }> {
  try {
    const { error } = await this.supabase.auth.resetPasswordForEmail(email);

    if (error) {
      throw this.mapSupabaseError(error);
    }

    return { success: true, message: 'Password reset email sent' };
  } catch (error) {
    throw new NetworkError('Failed to send reset email', { original: error });
  }
}

async getSession(): Promise<Session | null> {
  try {
    const { data } = await this.supabase.auth.getSession();

    if (!data.session) {
      return null;
    }

    return this.mapToSession(data.session);
  } catch (error) {
    logger.category('auth').warn('Failed to get session', { error });
    return null;
  }
}

onAuthStateChange(callback: (session: Session | null) => void): () => void {
  const { data: { subscription } } = this.supabase.auth.onAuthStateChange(
    async (event, session) => {
      if (session) {
        callback(this.mapToSession(session));
      } else {
        callback(null);
      }
    }
  );

  return () => subscription.unsubscribe();
}

async signOut(): Promise<void> {
  const { error } = await this.supabase.auth.signOut();

  if (error) {
    throw this.mapSupabaseError(error);
  }
}
```

### Error Mapping

```typescript
private mapSupabaseError(error: AuthError): AuthError {
  switch (error.message) {
    case 'Invalid login credentials':
      return new InvalidCredentialsError('Invalid email or password', { original: error });

    case 'User already registered':
      return new EmailAlreadyExistsError('Account already exists', { original: error });

    case 'Email not confirmed':
      return new InvalidCredentialsError('Please confirm your email first', { original: error });

    default:
      // Check error code patterns
      if (error.message.includes('network')) {
        return new NetworkError('Connection failed', { original: error });
      }

      return new AuthError('Authentication failed', { original: error });
  }
}
```

### Session Mapping

```typescript
private mapToSession(supabaseSession: any): Session {
  if (!supabaseSession) {
    throw new Error('Invalid session data');
  }

  return {
    userId: supabaseSession.user.id,
    accessToken: supabaseSession.access_token,
    refreshToken: supabaseSession.refresh_token,
    expiresAt: supabaseSession.expires_at,
    raw: supabaseSession // Keep full Supabase session for advanced use
  };
}
```

## AuthStateManager Integration

### Configuration

```typescript
// lib/auth/auth-state.ts

export class AuthStateManager {
  private static provider: AuthProvider | null = null;

  static configure(provider: AuthProvider): void {
    this.provider = provider;
  }

  private static getProvider(): AuthProvider {
    if (!this.provider) {
      throw new Error('AuthStateManager not configured. Call configure() first.');
    }
    return this.provider;
  }
}
```

### Auth Operations

```typescript
static async signInUser(email: string, password: string): Promise<AuthResult> {
  try {
    // Validate input
    validateEmail(email);
    validatePassword(password);

    // Check brute force guard
    await authAttemptGuard.checkAttempt(email, 'signin');

    // Call provider
    const provider = this.getProvider();
    const result = await provider.signIn(email, password);

    if (result.success) {
      // Store session
      await this.setSession(result.data);
      await this.setHasAccount(true);

      // Reset attempt counter
      await authAttemptGuard.resetAttempts(email, 'signin');
    }

    return result;
  } catch (error) {
    // Record failed attempt
    await authAttemptGuard.recordFailedAttempt(email, 'signin');

    // Log error
    logger.category('auth').error('Sign in failed', {
      error: error.toLog ? error.toLog() : error.message,
      email: this.redactEmail(email)
    });

    throw error;
  }
}
```

## Service Initializer Pattern

### Service Initializer

```typescript
// lib/services/service-initializer.ts

export async function initializeServices(): Promise<void> {
  try {
    // Initialize Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      logger.category('services').warn('Supabase not configured, using anonymous mode');
      return;
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false, // We handle persistence
        autoRefreshToken: true,
      }
    });

    // Register auth provider
    registerAuthProvider(new SupabaseAuthProvider(supabaseClient));

    logger.category('services').info('Auth provider registered');

  } catch (error) {
    logger.category('services').error('Service initialization failed', { error });
    throw error;
  }
}
```

## Configuration Support

### Appsettings Integration

```json
// appsettings.json
{
  "auth": {
    "provider": "supabase", // "firebase", "custom"
    "providerConfig": {
      "apiUrl": "https://api.example.com",
      "timeout": 30000
    }
  }
}
```

### Conditional Provider Registration

```typescript
// lib/services/service-initializer.ts

export async function initializeServices(config: AppConfig): Promise<void> {
  const providerType = config.auth?.provider || 'supabase';

  switch (providerType) {
    case 'supabase':
      const supabaseClient = createSupabaseClient();
      registerAuthProvider(new SupabaseAuthProvider(supabaseClient));
      break;

    case 'firebase':
      const { getAuth } = await import('firebase/auth');
      registerAuthProvider(new FirebaseAuthProvider(getAuth()));
      break;

    case 'custom':
      const customProvider = await createCustomProvider(config.auth.providerConfig);
      registerAuthProvider(customProvider);
      break;

    default:
      throw new Error(`Unknown auth provider: ${providerType}`);
  }
}
```

## Testing Infrastructure

### Mock Provider for Testing

```typescript
// lib/services/__tests__/mock-auth-provider.ts

export class MockAuthProvider implements AuthProvider {
  signInResults: Map<string, AuthResult> = new Map();
  signUpResults: Map<string, AuthResult> = new Map();

  setSignInResult(email: string, result: AuthResult): void {
    this.signInResults.set(email, result);
  }

  setSignUpResult(email: string, result: AuthResult): void {
    this.signUpResults.set(email, result);
  }

  async signIn(email: string, password: string): Promise<AuthResult> {
    const result = this.signInResults.get(email);
    if (!result) {
      throw new InvalidCredentialsError('Mock: No result configured');
    }
    return result;
  }

  async signUp(email: string, password: string): Promise<AuthResult> {
    const result = this.signUpResults.get(email);
    if (!result) {
      throw new EmailAlreadyExistsError('Mock: No result configured');
    }
    return result;
  }

  // Implement other methods with defaults...
}
```

### Unit Tests

```typescript
// lib/services/__tests__/auth-provider.test.ts

describe('AuthProvider registration', () => {
  beforeEach(() => {
    // Reset provider between tests
    currentProvider = null;
  });

  it('throws when getting provider before registration', () => {
    expect(() => getAuthProvider()).toThrow('Auth provider not initialized');
  });

  it('returns registered provider', () => {
    const provider = new MockAuthProvider();
    registerAuthProvider(provider);

    expect(getAuthProvider()).toBe(provider);
  });

  it('supports async provider factories', async () => {
    const provider = new MockAuthProvider();
    registerAuthProvider(async () => provider);

    // Wait for async registration
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(getAuthProvider()).toBe(provider);
  });
});
```

### Integration Tests

```typescript
// lib/auth/__tests__/with-injected-provider.test.ts

describe('AuthStateManager with injected provider', () => {
  let mockProvider: MockAuthProvider;

  beforeEach(() => {
    mockProvider = new MockAuthProvider();
    registerAuthProvider(mockProvider);
    AuthStateManager.configure(mockProvider);
  });

  it('routes sign in through provider', async () => {
    const expectedResult = {
      success: true,
      data: { userId: '123', accessToken: 'token' }
    };

    mockProvider.setSignInResult('test@example.com', expectedResult);

    const result = await AuthStateManager.signInUser('test@example.com', 'password');

    expect(result).toEqual(expectedResult);
  });

  it('handles provider errors', async () => {
    mockProvider.setSignInResult('test@example.com', {
      success: false,
      error: new InvalidCredentialsError('Invalid credentials')
    });

    await expect(
      AuthStateManager.signInUser('test@example.com', 'wrong')
    ).rejects.toThrow(InvalidCredentialsError);
  });
});
```

## Performance Considerations

### Provider Call Timing

- **Sign in/Sign up**: Expected < 5 seconds
- **Session check**: < 1 second
- **State changes**: Real-time via subscriptions

### Caching Strategy

```typescript
// Provider-level caching for session checks
private sessionCache: { session: Session | null; timestamp: number } | null = null;
private readonly CACHE_TTL = 30000; // 30 seconds

async getSession(): Promise<Session | null> {
  const now = Date.now();

  if (this.sessionCache && (now - this.sessionCache.timestamp) < this.CACHE_TTL) {
    return this.sessionCache.session;
  }

  const session = await this.supabase.auth.getSession();
  this.sessionCache = {
    session: session.data.session ? this.mapToSession(session.data.session) : null,
    timestamp: now
  };

  return this.sessionCache.session;
}
```

### Network Resilience

```typescript
// Retry logic for network operations
async signIn(email: string, password: string): Promise<AuthResult> {
  const maxRetries = 3;
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await this.supabase.auth.signInWithPassword({ email, password });
    } catch (error) {
      lastError = error;

      if (this.isRetryableError(error) && attempt < maxRetries) {
        await this.delay(Math.pow(2, attempt) * 1000); // Exponential backoff
        continue;
      }

      break;
    }
  }

  throw this.mapSupabaseError(lastError);
}

private isRetryableError(error: any): boolean {
  return error.message?.includes('network') ||
         error.code === 'ECONNRESET' ||
         error.code === 'ETIMEDOUT';
}
```

## Security Considerations

### PII Protection

```typescript
// Error logging with PII redaction
logger.category('auth').error('Auth operation failed', {
  operation: 'signIn',
  error: error.toLog(), // Redacts sensitive data
  email: this.redactEmail(email), // Only domain visible
  timestamp: new Date().toISOString()
});

private redactEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '[invalid]';

  const redactedLocal = local.length > 2
    ? `${local[0]}***${local[local.length - 1]}`
    : '***';

  return `${redactedLocal}@${domain}`;
}
```

### Session Security

- **Token Storage**: Encrypted via SecureStorage
- **Token Refresh**: Automatic via provider
- **Session Validation**: Server-side verification on each request
- **Logout Cleanup**: Complete session invalidation

## Migration Path

### From Direct Supabase Usage

**Before:**
```typescript
// Direct Supabase calls
const { data, error } = await supabase.auth.signInWithPassword({ email, password });
```

**After:**
```typescript
// Same API through abstraction
const result = await AuthStateManager.signInUser(email, password);
```

### Gradual Migration

1. **Phase 1**: Register SupabaseAuthProvider (no code changes)
2. **Phase 2**: Update error handling to use normalized errors
3. **Phase 3**: Switch to different provider if needed
4. **Phase 4**: Remove direct Supabase dependencies

## Future Extensions

### OAuth Support

```typescript
export interface OAuthProvider extends AuthProvider {
  signInWithProvider(provider: 'google' | 'github' | 'apple'): Promise<AuthResult>;
  getSupportedProviders(): string[];
}
```

### Multi-Factor Authentication

```typescript
export interface MFAProvider extends AuthProvider {
  requestMFACode(email: string): Promise<{ success: boolean }>;
  verifyMFACode(code: string): Promise<AuthResult>;
  isMFARequired(userId: string): Promise<boolean>;
}
```

### Session Persistence Wrapper

```typescript
export class PersistentAuthProvider implements AuthProvider {
  constructor(
    private provider: AuthProvider,
    private storage: SecureStorage
  ) {}

  async getSession(): Promise<Session | null> {
    // Check memory cache first
    if (this.cachedSession) return this.cachedSession;

    // Check persistent storage
    const stored = await this.storage.getItem('auth_session');
    if (stored) {
      this.cachedSession = JSON.parse(stored);
      return this.cachedSession;
    }

    // Fallback to provider
    return this.provider.getSession();
  }
}
```

This implementation provides a robust, extensible foundation for authentication that can adapt to different backend requirements while maintaining consistent APIs and security practices.