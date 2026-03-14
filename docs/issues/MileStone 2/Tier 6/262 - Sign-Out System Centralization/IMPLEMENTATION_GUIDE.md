# Auth System Implementation Guide

This guide provides detailed implementation information for the centralized auth system, including architecture, data flows, and extension points.

## Architecture Overview

The auth system follows a layered architecture with clear separation of concerns:

```
User Interface
    ↓
Auth Manager (Gateway)
    ↓
Domain Systems (Business Logic)
    ↓
Middleware (Network + Infrastructure)
    ↓
External Providers (Supabase, etc.)
```

### Core Components

- **Auth Manager** (`auth-manager.ts`): Single public API with validation and delegation
- **Domain Systems** (`account/*.ts`): Business logic for specific auth operations
- **Auth State Manager** (`auth-state.ts`): Persistent state storage and retrieval
- **Middleware Layer**: Network handling, rate limiting, and provider abstraction

## Domain Systems

### Sign-In System (`account/sign-in-system.ts`)

**Purpose**: Unified session establishment for all auth entry points.

**Key Functions**:
- `performSignIn(email, password)`: User-initiated authentication
- `performReAuth(tokens, context)`: Token-based session restore
- `performSignInWithIdToken(provider, token)`: OAuth/native auth

**Data Flow**:
```
Input Validation → Rate Limiting → Provider Call → Session Storage → Data Sync → Redirect Determination
```

**Post-Auth Setup** (shared across all entry points):
1. Store `HAS_ACCOUNT` flag
2. Update `LAST_LOGGED_IN` timestamp
3. Sync user profile from database
4. Refresh connected worlds
5. Drain offline queue
6. Determine redirect based on profile completeness

### Sign-Out System (`account/sign-out-system.ts`)

**Purpose**: Orchestrated logout with extensible cleanup phases.

**Architecture**: Hook-based system with serial phase execution.

**Phases**:
- **before-auth**: Pre-cleanup (drain queues, stop background jobs)
- **auth**: Provider sign-out + state clearing
- **after-auth**: Post-cleanup (UI reset, notifications)

**Hook System**:
```typescript
interface ISignOutHook {
  phase: 'before-auth' | 'after-auth';
  name: string;
  priority: number; // Higher = executes first
  execute: (context) => Promise<void>;
}
```

**Default Hooks**:
- QueryCache.clearAll() (priority 5)
- Storage key clearing (priority 10)
- Theme reset (priority 1)
- Offline queue drain (priority 12)
- App params reset (priority 10)

### Sign-Up System (`account/sign-up-system.ts`)

**Purpose**: User registration with email verification.

**Flow**:
```
Validation → Rate Check → Provider Call → Success Tracking → Redirect to Confirmation
```

### Delete Account System (`account/delete-account-system.ts`)

**Purpose**: Account deletion with guaranteed cleanup.

**Two-Phase Process**:
1. **Phase 1**: Server-side deletion (requires password verification)
2. **Phase 2**: Local cleanup via sign-out system

**Safety**: If server deletion succeeds but local cleanup fails, user is informed but not blocked.

## Auth Manager (Gateway Pattern)

### Purpose

The auth manager serves as the single entry point for all auth operations, providing:

- Consistent input validation
- Rate limiting checks
- Error normalization
- Result mapping
- Security logging

### Key Functions

```typescript
// Public API examples
export const signInUser = async (email: string, password: string): Promise<SignInResult>
export const signUpUser = async (email: string, password: string): Promise<SignUpResult>
export const initiateSignOut = async (source: SignOutSource): Promise<SignOutPhase1Result>
export const confirmSignOut = async (): Promise<SignOutPhase2Result>
```

### Validation & Security

- **Input Sanitization**: All inputs pass through `sanitizeInput()`
- **Format Validation**: Email/password validation with ReDoS-safe regex
- **Rate Limiting**: Per-email, per-operation type checking
- **Error Mapping**: Provider errors normalized to user-friendly messages

## Auth State Management

### Storage Keys

All auth-related data uses centralized keys from `maps/storage-keys.ts`:

```typescript
export const STORAGE_KEYS = {
  HAS_ACCOUNT: 'auth:has_account',
  LAST_LOGGED_IN: 'auth:last_logged_in',
  USER_PROFILE: 'auth:user_profile',
  CONNECTED_WORLDS: 'auth:connected_worlds',
  // ... etc
} as const;
```

### State Persistence

- **SecureStorage**: All sensitive data encrypted (AES-CTR)
- **Cross-Platform**: Same encryption on web, iOS, Android
- **Atomic Updates**: State changes are transactional
- **Recovery**: Automatic session restoration on app launch

### Staleness Tracking

`LAST_LOGGED_IN` timestamp enables age-based security:

```typescript
const ageMs = Date.now() - LAST_LOGGED_IN;
const phase = ageMs < 7 * 24 * 60 * 60 * 1000 ? 'fresh' :
              ageMs < 30 * 24 * 60 * 60 * 1000 ? 'stale' : 'dead';
```

## Middleware Integration

### Request Layer

Auth operations use the middleware system for:

- **Network Readiness**: Checks online status before requests
- **Circuit Breaker**: Fast-fail on repeated failures
- **Retry Logic**: Automatic retry with backoff
- **Deduplication**: Prevents duplicate concurrent requests

### Provider Abstraction

```typescript
interface IAuthProvider {
  signIn(email, password): Promise<Session>;
  signOut(): Promise<void>;
  restoreSession(tokens): Promise<Session>;
  refreshSession(): Promise<Session | null>; // NEW
}
```

**Default Provider**: SupabaseAuthProvider with automatic fallback handling.

## Error Handling Strategy

### Error Types

- **ValidationError**: Input format issues
- **RateLimitError**: Too many attempts
- **NetworkError**: Connectivity issues
- **AuthError**: Invalid credentials
- **ProviderError**: Backend-specific failures

### Error Mapping

```typescript
// Provider errors → User-friendly messages
EmailAlreadyExistsError → "An account with this email already exists"
InvalidCredentialsError → "Invalid email or password"
NetworkError → "Unable to connect to servers"
```

### Graceful Degradation

- **Offline**: Auth state readable from cache, new operations fail gracefully
- **Provider Down**: Fallback to cached state, show network error
- **Partial Failures**: Sign-out continues despite individual hook failures

## Security Features

### Brute Force Protection

- **Per-Email Tracking**: Separate counters for signin/signup/reset
- **Time Windows**: 5 attempts per 10-minute window
- **Lockout**: 15-minute cooldown after threshold
- **Persistence**: Counters survive app restarts

### Session Security

- **Token Encryption**: All tokens stored encrypted
- **Auto-Refresh**: 401 responses trigger silent refresh
- **Staleness Checks**: Age-based session validation
- **Secure Cleanup**: Comprehensive state clearing on logout

### Input Security

- **Sanitization**: Null byte and control character removal
- **Length Limits**: Prevent buffer overflow attacks
- **Regex Validation**: ReDoS-safe patterns
- **SQL Injection Prevention**: Input escaping

## Extension Points

### Adding Sign-Out Hooks

```typescript
import { signOutSystem } from '@/lib/auth/account/sign-out-system';

// Register custom cleanup
signOutSystem.registerHook({
  phase: 'after-auth',
  name: 'custom-cleanup',
  priority: 5,
  execute: async (context) => {
    // Custom cleanup logic
    await customCache.clear();
  }
});
```

### Custom Auth Providers

```typescript
class CustomAuthProvider implements IAuthProvider {
  async signIn(email: string, password: string): Promise<Session> {
    // Custom implementation
  }
  
  async signOut(): Promise<void> {
    // Custom implementation
  }
  
  // ... other methods
}

// Register during app initialization
AuthStateManager.configure(new CustomAuthProvider());
```

### Adding Auth Operations

1. Create domain system in `account/`
2. Add public function in `auth-manager.ts`
3. Export from `index.ts`
4. Update validation and error handling

## Testing Strategy

### Unit Tests

- **Domain Systems**: Test business logic in isolation
- **Auth Manager**: Test validation and delegation
- **State Manager**: Test storage operations
- **Hooks**: Test registration and execution order

### Integration Tests

- **Full Flows**: Sign-in → state update → redirect
- **Error Scenarios**: Network failures, invalid credentials
- **Race Conditions**: Concurrent auth attempts
- **Persistence**: App restart recovery

### E2E Tests

- **User Journeys**: Complete sign-in/sign-out flows
- **Cross-Platform**: Web, iOS, Android behavior
- **Offline Scenarios**: Network failure handling
- **Security**: Brute force protection validation

## Performance Considerations

### Optimizations

- **Lazy Loading**: Auth systems loaded on-demand
- **Caching**: Auth state cached in memory
- **Deduplication**: Request coalescing prevents duplicates
- **Background Processing**: Non-blocking operations

### Monitoring

- **Metrics**: Auth success/failure rates
- **Latency**: Operation timing
- **Errors**: Failure pattern analysis
- **Security Events**: Brute force attempt tracking

## Migration Path

### From Legacy Auth

1. **Replace Direct Calls**: Use auth manager functions
2. **Update Error Handling**: Handle structured results
3. **Add Staleness Checks**: Implement age-based routing
4. **Register Hooks**: Move cleanup logic to sign-out hooks
5. **Update Tests**: Test through public API

### Backward Compatibility

- **No Breaking Changes**: Legacy functions still work
- **Gradual Migration**: Systems can be adopted incrementally
- **Fallback Support**: Direct provider access still available
- **Deprecation Path**: Legacy functions marked for removal

## Troubleshooting

### Common Issues

- **Stale Sessions**: Check `LAST_LOGGED_IN` timestamp
- **Hook Failures**: Review sign-out system logs
- **Rate Limiting**: Clear storage keys for testing
- **Provider Errors**: Check network and provider status

### Debug Tools

```typescript
// Check current auth state
const state = await AuthStateManager.getAuthState();

// View registered hooks
const hooks = signOutSystem.getRegisteredHooks();

// Clear rate limiting (development only)
await SecureStorage.removeItem(STORAGE_KEYS.AUTH_ATTEMPTS);
```

### Logging

All auth operations are logged with categories:
- `auth`: General auth operations
- `auth.security`: Security events
- `auth.performance`: Timing information
- `auth.errors`: Error details