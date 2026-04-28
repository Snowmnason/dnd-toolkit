# Auth Module

Email/password authentication system with brute-force protection, secure session persistence, input validation, pluggable auth providers (Supabase, Firebase, custom), route guards, and background health monitoring. Session state survives app restarts via encrypted storage; auth attempts are rate-limited (5 attempts per 10 minutes) with automatic 15-minute lockout on failure.

## When to Use This Module

**Use this module if you need to:**

- Implement email/password signup and signin with form validation
- Protect routes based on authentication state (logged in vs. logged out)
- Handle brute-force attacks with automatic rate limiting and lockout (5 attempts / 10 min)
- Persist user sessions across app restarts via encrypted storage
- Support pluggable auth providers (Supabase, Firebase, custom backends)
- Validate email, password, and username inputs with ReDoS-safe regex
- Integrate auth state with route navigation (redirects, login screens)

**Do NOT use this module for:**

- OAuth2/OIDC social login (not yet supported)
- Multi-factor authentication (MFA) (not yet supported)
- Role-based access control or permission checking (use per-route checks or [lib/premium](../premium/README.md) instead)
- Raw email validation without signup context (use `validateEmail()` directly instead)

## Architecture & Data Flow

The auth module follows a layered architecture with clear separation of concerns:

```
User Action
    ↓
Auth Manager (Gateway)
    ↓
Domain Systems (Business Logic)
    ↓
Middleware (Network + Validation)
    ↓
System Infrastructure (Storage, API, Providers)
```

**Key Systems:**

- **Auth Manager** (`auth-manager.ts`) – Single public API gateway for all auth operations. Handles validation, rate limiting, and delegates to domain systems.
- **Sign-In System** (`account/sign-in-system.ts`) – Handles session establishment (sign-in, re-auth, OAuth) and post-login data synchronization.
- **Sign-Out System** (`account/sign-out-system.ts`) – Orchestrates logout with extensible hook system for cleanup phases.
- **Sign-Up System** (`account/sign-up-system.ts`) – Manages user registration with email verification.
- **Delete Account System** (`account/delete-account-system.ts`) – Handles account deletion with server cleanup and sign-out.
- **Auth State Manager** (`auth-state.ts`) – Persistent storage and retrieval of auth state.

**Data Flow Examples:**

**Sign In Flow:**
```
User Input → Auth Manager (validation) → Sign-In System (auth + DB sync) → State Update
```

**Sign Out Flow:**
```
User Action → Auth Manager → Sign-Out System (hook phases) → State Clear
```

**Re-Auth Flow:**
```
Bootstrap/OAuth → Freshness Check (skip if <4 days) → Sign-In System (token restore + DB sync) → State Update
```

**Key Principles:**

- **Gateway Pattern**: All auth operations go through `auth-manager.ts` for consistent validation and error handling
- **System Separation**: Business logic isolated in domain systems, middleware handles network concerns
- **Hook-Based Cleanup**: Sign-out uses extensible hooks for modular cleanup phases
- **Staleness-Aware Re-Auth**: Session restoration considers data age for security (fresh/stale/dead phases)
- **Provider Agnostic**: Core logic independent of auth backend through dependency injection

## Provider Injection

Auth providers are injected from `lib/services` via dependency injection, enabling multi-backend support:

- **Default Provider**: SupabaseAuthProvider (registered during kernel bootstrap)
- **Provider Interface**: All providers implement `AuthProvider` from `@/lib/services`
- **Injection Point**: `AuthStateManager.configure(provider)` called by kernel
- **Error Handling**: Provider errors normalized to common types (InvalidCredentialsError, NetworkError, etc.)
- **No Direct Imports**: Auth module never imports Supabase directly; uses injected provider

This design allows swapping auth backends (Firebase, custom) without changing auth module code.

## API Reference

### Public API (Auth Manager)

The auth module exposes a single public API through `auth-manager.ts`. All operations go through this gateway for consistent validation, rate limiting, and error handling.

#### `signUpUser(email, password): Promise<SignUpResult>`

Creates a new user account with email verification.

**Parameters:**
- `email` (string) – Email address to register
- `password` (string) – Password (6+ chars, meets strength requirements)

**Returns:** `SignUpResult` object with success status, errors, and redirect information.

**Example:**
```ts
const result = await signUpUser("user@example.com", "SecurePass123!");
if (result.success) {
  navigate.push(result.redirectTo!); // → email confirmation
}
```

#### `signInUser(email, password): Promise<SignInResult>`

Authenticates an existing user and performs post-login setup.

**Parameters:**
- `email` (string) – Email address
- `password` (string) – User's password

**Returns:** `SignInResult` object with success status and redirect destination.

**Example:**
```ts
const result = await signInUser("user@example.com", "SecurePass123!");
if (result.success) {
  navigate.push(result.redirectTo!); // → main app
}
```

#### `initiateSignOut(source): Promise<SignOutPhase1Result>`

Initiates the sign-out process with cleanup phases.

**Parameters:**
- `source` (SignOutSource) – Context: `'user-initiated'` or `'auth-state-change'`

**Returns:** Result of the sign-out preparation phase.

#### `confirmSignOut(): Promise<SignOutPhase2Result>`

Completes the sign-out process by clearing all auth state and user data.

**Returns:** Result of the final cleanup phase.

#### `restoreSession(tokens): Promise<Session>`

Restores a user session from tokens (used during bootstrap/re-auth).

**Parameters:**
- `tokens` (AuthTokens) – Access and refresh tokens

**Returns:** Restored session object.

#### `useAuthGuard(bootstrapReady?, level?, options?): AuthState`

React hook for protecting routes based on auth state.

**Parameters:**
- `bootstrapReady` (boolean?) – App bootstrap completion status
- `level` (AuthLevel?) – `'account-only'` or `'world-required'`
- `options` (AuthGuardOptions?) – Additional options like force verification

**Returns:** `'loading'`, `'authenticated'`, or `'unauthenticated'`

**Example:**
```ts
const authState = useAuthGuard(kernel.phases.appReady, 'account-only');
if (authState === 'loading') return <LoadingSpinner />;
if (authState === 'unauthenticated') return <Redirect href="/login" />;
return <ProtectedContent />;
```

### Domain Systems (Internal API)

These systems contain the core business logic and are called by the auth manager. They are not part of the public API.

#### Sign-In System

```ts
// Establish session and sync data
performSignIn(email, password): Promise<SignInResult>
performReAuth(tokens, context): Promise<ReAuthResult>
performSignInWithIdToken(provider, token): Promise<SignInResult>
```

#### Sign-Out System

```ts
// Orchestrated logout with hooks
performSignOutPhase1_DBSync(source): Promise<SignOutPhase1Result>
performSignOutPhase2_ClearAndSignOut(): Promise<SignOutPhase2Result>
```

#### Auth State Manager

```ts
// Persistent state management
AuthStateManager.getAuthState(): Promise<AuthState>
AuthStateManager.setHasAccount(hasAccount: boolean): Promise<void>
AuthStateManager.clearAuthState(): Promise<void>
```

### Validation & Security

#### `checkAuthGuard(email, scope): Promise<GuardResult>`

Checks brute-force protection status for auth attempts.

**Parameters:**
- `email` (string) – Email to check
- `scope` ('signin' | 'signup' | 'reset') – Operation type

**Returns:** Whether attempt is allowed and retry timing.

#### Validation Functions

```ts
validateEmail(email): { isValid: boolean; sanitized: string }
validatePassword(password): { isValid: boolean; strength: string }
validateUsername(username): { isValid: boolean; sanitized: string }
```
### Utility Functions

#### `getEmailDomain(email): string`

Extracts domain from email address.

#### `getEmailProvider(domain): { name: string; url: string }`

Returns email provider information for known services.

#### `openEmailApp(email): Promise<void>`

Opens user's email app or provider website for email verification.

#### `sanitizeInput(input): string`

Sanitizes string input for security.

---

## Dependencies

### External Packages

- **`@supabase/supabase-js`** (optional) – Default auth provider implementation
- **`expo-router`** – Navigation and routing for auth redirects

### Internal Dependencies

- **`lib/middleware/services`** – Auth provider abstraction and network calls
- **`lib/storage`** (SecureStorage) – Encrypted persistence of auth state and sessions
- **`lib/cache`** (QueryCache) – Cleared on logout to prevent stale user data
- **`lib/database`** – User profile and world access data operations
- **`lib/jobs`** – Background job management for auth-related tasks
- **`lib/navigation`** – Route building and redirect logic
- **`lib/analytics`** – Auth flow tracking and security event logging
- **`lib/kernel`** – App bootstrap coordination and phase management
- **`lib/utils/logger`** – Structured logging for auth operations
- **`maps/storage-keys.ts`** – Centralized storage key constants
- **`validation/`** – Input validation schemas and functions
- **`lib/analytics`** – Tracks auth flows (signup, signin, failures)
- **`lib/kernel`** – App bootstrap state for route guards

---

## Error Handling & Edge Cases

### Auth Provider Not Available

If no auth provider is configured or network issues occur, operations degrade gracefully:

- Sign-in/sign-up return: "Unable to connect to servers"
- Re-auth fails silently, user redirected to sign-in
- Auth state remains readable from local storage

### Brute-Force Protection

Rate limiting prevents abuse with per-email tracking:

- **Threshold**: 5 failed attempts per 10-minute window
- **Lockout**: 15-minute cooldown after exceeding threshold
- **Tracking**: Persists across app restarts via SecureStorage
- **Reset**: Successful auth clears failure counter

### Session Staleness (Re-Auth Security)

Session restoration considers data age for security:

- **Fresh** (< 7 days): Auto-restore, proceed to world selection
- **Stale** (7-30 days): Auto-restore but redirect to welcome screen
- **Dead** (> 30 days): Deny restore, require manual sign-in

Age calculated from `LAST_LOGGED_IN` timestamp updated during successful auth.

### Sign-Out Hook Failures

Sign-out system continues despite individual hook failures:

- Each phase runs all hooks, collecting errors
- Non-critical failures logged but don't block logout
- Final result includes success status and error details

### Race Conditions

Multiple concurrent auth attempts are handled via:

- Request deduplication in middleware layer
- Atomic state updates in AuthStateManager
- Serial execution of sign-out phases

### Invalid Tokens (401 Responses)

Automatic token refresh on 401 errors:

- Middleware intercepts failed requests
- Attempts silent token refresh
- Retries original request with new token
- Triggers sign-out if refresh fails

### Email Verification Required

Sign-up succeeds but requires email confirmation:

- User redirected to confirmation screen
- Auth state not set until email verified
- Re-auth attempts blocked until confirmation

---

## Performance Notes

### Auth State Operations

- **State Checks**: O(1) SecureStorage reads, no external calls
- **State Updates**: Atomic writes with immediate persistence
- **Session Recovery**: Single read on app launch, non-blocking

### Validation Performance

- **Input Validation**: O(n) regex operations (n ≤ 1000 chars)
- **ReDoS Safe**: No backtracking in regex patterns
- **Sanitization**: Linear time string processing

### Rate Limiting

- **Guard Checks**: O(1) JSON read from SecureStorage
- **Counter Updates**: Atomic increments with persistence
- **Memory Efficient**: Small JSON objects, bounded size

### Sign-Out Orchestration

- **Hook Execution**: Serial phases prevent race conditions
- **Error Isolation**: Individual hook failures don't block others
- **Cleanup Scope**: Targeted clearing prevents over-cleaning

### Re-Auth Efficiency

- **Staleness Check**: Timestamp comparison (no I/O)
- **Conditional Sync**: Only fetches data when needed
- **Background Jobs**: Non-blocking offline queue processing

### Network Operations

- **Request Deduplication**: Prevents redundant auth calls
- **Circuit Breaker**: Fast-fail on repeated provider failures
- **Token Refresh**: Automatic retry with new credentials

---

## Related Modules

- **`lib/middleware/services`** – Auth provider abstraction and network request handling
- **`lib/storage`** – SecureStorage for encrypted auth state persistence
- **`lib/cache`** – QueryCache cleared during sign-out to prevent data leaks
- **`lib/database`** – User profile and world access data synchronization
- **`lib/jobs`** – Background job coordination for auth-related tasks
- **`lib/navigation`** – Route determination and redirect logic
- **`lib/analytics`** – Auth flow tracking and security monitoring
- **`lib/kernel`** – App bootstrap phases and initialization coordination
- **`lib/error`** – Error type definitions and mapping functions
- **`validation/`** – Input validation schemas and security functions

---

## File Breakdown

| File | Purpose |
|------|---------|
| `auth-manager.ts` | Public API gateway for all auth operations with validation and delegation |
| `auth-state.ts` | Persistent auth state management and session storage |
| `auth-operations.ts` | Core auth business logic and result type definitions |
| `auth-attempt-guard.ts` | Brute-force protection and rate limiting per email/scope |
| `auth-layer.ts` | Auth strategy abstractions and provider management |
| `default-strategies.ts` | Default auth strategies for different operation types |
| `guards/` | Route protection and session validation utilities |
| `health/` | Background session health monitoring and validation |
| `account/sign-in-system.ts` | Unified session establishment (sign-in, re-auth, OAuth) |
| `account/sign-out-system.ts` | Orchestrated logout with extensible hook system |
| `account/sign-up-system.ts` | User registration with email verification |
| `account/delete-account-system.ts` | Account deletion with server cleanup |
| `account/update-creds-system.ts` | Password/username update operations |
| `account/invite-system.ts` | World invitation and access management |
| `validation.ts` | Input validation functions for security |
| `emailUtils.ts` | Email domain detection and provider utilities |

**Note**: Auth provider implementations (e.g., SupabaseAuthProvider) are now located in `lib/services/` for better separation of concerns and reusability across projects.
