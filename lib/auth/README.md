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

```
User Action (SignUp / SignIn / PasswordReset)
        ↓
Validate Input (email, password, username)
        ├─ ReDoS-safe regex, sanitization, length checks
        ↓
Check Auth Attempt Guard (brute-force protection)
        ├─ 5 attempts / 10 min window per email+scope
        ├─ 15 min lockout after exceeding threshold
        ├─ Tracked in encrypted storage
        ↓
Call Auth Provider (injected from lib/services)
        ├─ Provider-agnostic interface (Supabase, Firebase, custom)
        ├─ Made via lib/api RequestManager (retry, dedup)
        ↓
Persist Session to SecureStorage
        ├─ Saves access_token, refresh_token, user metadata
        ├─ Encrypted; survives app restarts
        ↓
Update Auth State (hasAccount: true)
        ├─ Stored in SecureStorage
        ↓
Return Result (success/error/redirectTo)
        ↓
UI Triggers Redirect (route guards, navigation)
```

**Key Principles:**

- **Secure by default**: All credentials and session data encrypted via encrypted storage (works with lib/storage)
- **Brute-force protected**: Rate limiting per email per operation type (signin, signup, reset)
- **Validated inputs**: Email/password/username validated (ReDoS-safe) before reaching auth provider
- **Session recovery**: Auth state persists; app recovers session on restart via SecureStorage
- **Provider-agnostic**: Core logic independent of auth provider (injected from lib/services)
- **Graceful degradation**: Offline support via SecureStorage; no external call required for auth checks
- **Observable**: All state changes logged; integrates with analytics (works with lib/analytics)

## Provider Injection

Auth providers are injected from `lib/services` via dependency injection, enabling multi-backend support:

- **Default Provider**: SupabaseAuthProvider (registered during kernel bootstrap)
- **Provider Interface**: All providers implement `AuthProvider` from `@/lib/services`
- **Injection Point**: `AuthStateManager.configure(provider)` called by kernel
- **Error Handling**: Provider errors normalized to common types (InvalidCredentialsError, NetworkError, etc.)
- **No Direct Imports**: Auth module never imports Supabase directly; uses injected provider

This design allows swapping auth backends (Firebase, custom) without changing auth module code.

## API Reference

### `AuthStateManager`

Manages local auth state storage and retrieval.

#### `AuthStateManager.getAuthState(): Promise<AuthState>`

Returns current authentication state (`{ hasAccount: boolean }`).

Returns current authentication state (`{ hasAccount: boolean }`).

```ts
const state = await AuthStateManager.getAuthState();
if (state.hasAccount) {
  // User is authenticated
}
```

#### `AuthStateManager.setHasAccount(hasAccount: boolean): Promise<void>`

Marks user as authenticated or not. Called during signup, signin, and logout.

```ts
await AuthStateManager.setHasAccount(true); // After signin success
await AuthStateManager.setHasAccount(false); // After logout
```

#### `AuthStateManager.setSession(session: any): Promise<void>`

Persists session information after successful auth provider login. Updates `hasAccount: true` and caches optional user email.

```ts
await AuthStateManager.setSession(providerSession);
```

#### `AuthStateManager.clearAuthState(): Promise<void>`

Clears all auth state and user-specific cached data on logout. Removes:

- `hasAccount` flag
- User data, connected worlds
- World access cache
- Query cache (to prevent stale user data from leaking)

```ts
await AuthStateManager.clearAuthState(); // On logout
```

#### `AuthStateManager.getUserId(): Promise<string | undefined>`

Retrieves stored user ID from local auth state.

```ts
const userId = await AuthStateManager.getUserId();
```

#### `AuthStateManager.getUserData(): Promise<any>`

Retrieves full stored user profile from local auth state.

```ts
const userData = await AuthStateManager.getUserData();
```

---

### `signUpUser(email, password): Promise<SignUpResult>`

Creates a new user account.

**Parameters:**

- `email` (string) – Email address to register
- `password` (string) – Password (6+ chars, must meet strength requirements)

**Returns:** `SignUpResult` object:

```ts
{
  success: boolean;
  error?: string;                    // User-facing error message
  validationWarning?: string;        // Client validation passed but server validation failed
  showEmailExistsModal?: boolean;    // Indicates email already exists
  redirectTo?: string;               // Where to navigate on success
}
```

**Example:**

```ts
const result = await signUpUser("user@example.com", "SecurePass123!");
if (result.success) {
  router.push(result.redirectTo!); // → email confirmation screen
} else if (result.showEmailExistsModal) {
  // Show "email already exists" modal
} else {
  showError(result.error);
}
```

**Process:**

1. Validates email format and password strength (client-side)
2. Checks brute-force rate limit (5 attempts per 10 min)
3. Calls auth provider (Supabase, custom API)
4. Records success/failure for brute-force tracking
5. Returns redirect URL on success (usually email confirmation screen)

---

### `signInUser(email, password): Promise<SignInResult>`

Authenticates an existing user.

**Parameters:**

- `email` (string) – Email address to sign in
- `password` (string) – User's password

**Returns:** `SignInResult` object:

```ts
{
  success: boolean;
  error?: string;              // User-facing error message
  validationWarning?: string;  // Client validation passed but server validation failed
  redirectTo?: string;         // Where to navigate on success
}
```

**Example:**

```ts
const result = await signInUser("user@example.com", "SecurePass123!");
if (result.success) {
  await AuthStateManager.setHasAccount(true);
  router.push(result.redirectTo!); // → main app
} else {
  showError(result.error);
}
```

---

### `resetPassword(email): Promise<ResetPasswordResult>`

Initiates password reset flow via auth provider email.

**Parameters:**

- `email` (string) – Email address to reset password

**Returns:** `ResetPasswordResult` object:

```ts
{
  success: boolean;
  error?: string;                    // User-facing error
  message?: string;                  // Success message (e.g., "Check your email")
  showEmailNotFoundModal?: boolean;  // Email doesn't exist
}
```

---

### `checkUserSession(): Promise<SessionCheckResult>`

Checks if user has valid session and complete profile.

**Returns:** `SessionCheckResult` object:

```ts
{
  hasValidSession: boolean;
  hasCompleteProfile: boolean;
  shouldRedirectTo?: string;  // Where to navigate based on auth state
}
```

**Example:** Used during app bootstrap to determine where to redirect user.

```ts
const session = await checkUserSession();
if (session.shouldRedirectTo) {
  router.replace(session.shouldRedirectTo);
}
```

---

### `useAuthGuard(bootstrapReady?, level?, options?): AuthState`

React hook for protecting routes. Subscribes to auth state changes and redirects unauthenticated users.

**Parameters:**

- `bootstrapReady` (boolean?) – Optional override of app bootstrap state (typically from kernel)
- `level` (AuthLevel?) – Auth requirement level: `'account-only'` (needs account) or `'world-required'` (needs account + world access)
- `options` (AuthGuardOptions?) – `{ forceVerification?: boolean }` – Always check provider, ignore cache age

**Returns:** `AuthState` – `'loading'`, `'authenticated'`, or `'unauthenticated'`

**Example:**

```ts
export default function ProtectedScreen() {
  const authState = useAuthGuard(kernel.phases.appReady, 'account-only');

  if (authState === 'loading') return <LoadingSpinner />;
  if (authState === 'unauthenticated') return <Redirect href="/login" />;

  return <ScreenContent />;
}
```

---

### `checkAuthGuard(email, scope): Promise<GuardResult>`

Checks brute-force protection for an email. Returns whether auth attempt is allowed.

**Parameters:**

- `email` (string) – Email address to check
- `scope` ('signin' | 'signup' | 'reset') – Auth operation type

**Returns:** `GuardResult` object:

```ts
{
  allowed: boolean;        // Is the attempt allowed?
  remaining: number;       // Attempts remaining in current window
  retryAfterMs?: number;   // If locked out, milliseconds until retry allowed
}
```

**Thresholds:** 5 attempts per 10-minute window; 15-minute lockout after exceeding

---

### Validation Functions

#### `validateEmail(email): { isValid: boolean; sanitized: string; ... }`

Validates email format and sanitizes input. Checks for SQL injection, control characters, valid length.

#### `validatePassword(password): { isValid: boolean; strength: string; ... }`

Validates password strength (6+ chars, uppercase, lowercase, number, special char). Returns breakdown by criteria.

#### `validateUsername(username): { isValid: boolean; sanitized: string; ... }`

Validates username format (3-20 chars, alphanumeric + underscore/hyphen).

---

### Utility Functions

#### `getEmailDomain(email): string`

Extracts domain from email (e.g., "gmail.com" from "user@gmail.com").

#### `getEmailProvider(domain): { name: string; url: string }`

Returns email provider info (name and web URL) for known providers (Gmail, Outlook, Yahoo, etc.).

#### `openEmailApp(email): Promise<void>`

Opens user's email app or email provider website. Useful for directing users to check confirmation emails.

#### `sanitizeInput(input): string`

Sanitizes string input: removes null bytes, control characters, limits length to 1000 chars. Used before validation.

---

## Dependencies

### External Packages

- **`@supabase/supabase-js`** (optional) – Default auth provider implementation
- **`expo-router`** – Routing and navigation (for route protection)

### Internal Dependencies

- **`lib/services`** – Injected auth provider (AuthProvider interface)
- **`lib/storage` (SecureStorage)** – Encrypted storage for auth state and attempts
- **`lib/cache` (QueryCache)** – Cleared on logout to prevent stale user data leaks
- **`lib/api` (RequestManager)** – Makes auth API calls (signup, signin, reset password)
- **`lib/database`** – Database operations (may be used by auth providers)
- **`lib/utils/logger`** – Logs auth events and security incidents
- **`lib/analytics`** – Tracks auth flows (signup, signin, failures)
- **`lib/kernel`** – App bootstrap state for route guards

---

## Error Handling & Edge Cases

### Auth Provider Not Available

If no auth provider is configured or available (e.g., network issues, misconfiguration), the module degrades gracefully:

- `signUpUser()` returns error: "Unable to connect to servers"
- `useAuthGuard()` skips subscription setup
- Auth state is still readable from local storage

### Brute-Force Protection

After 5 failed attempts in 10 minutes, further attempts fail with: `"Too many sign up attempts. Try again in XXX seconds."`

- Tracked per email × scope (separate counters for signin vs. signup)
- Resets on successful auth
- Lockout persists across app restarts (stored in SecureStorage)

### Email Already Exists (Signup)

Auth provider returns `EmailAlreadyExistsError`, module sets `showEmailExistsModal: true` to trigger UI modal.

### Invalid Password (Signup)

Server rejects weak passwords; module catches and returns friendly error: `"Password does not meet requirements."`

### Session Recovery

On app restart, `AuthStateManager.getAuthState()` recovers previous session from SecureStorage. If missing/invalid, defaults to `{ hasAccount: false }`.

### Race Condition: Multiple SignIn Attempts

If user taps "Sign In" twice rapidly, both requests go to RequestManager. Deduplication via cache key `'auth:signin:email'` coalesces requests (same promise returned).

### Logout with In-Flight Requests

`AuthStateManager.clearAuthState()` is called on logout; it clears QueryCache to prevent stale data. In-flight auth requests may still complete but are ignored by UI.

---

## Performance Notes

### Auth State Check Cost

`AuthStateManager.getAuthState()` is O(1): single SecureStorage read. No external calls.

### Validation Cost

Input validation (email, password) uses simple regex without backtracking (ReDoS-safe). O(n) where n = input length (typically < 1000 chars).

### Brute-Force Tracking

Auth attempt guard loads/saves JSON from SecureStorage. O(1) per check (small JSON, not unbounded).

### Route Guard Subscription

`useAuthGuard()` sets up auth provider subscription once per mount. Listens to future auth state changes; no polling.

### Session Recovery

On app launch, a single `checkUserSession()` call. If session valid and profile complete, determines routing destination. Non-blocking.

---

## Related Modules

- **`lib/services`** – Auth provider abstraction and dependency injection
- **`lib/database`** – Database operations (used by auth providers)
- **`lib/storage` (SecureStorage)** – Encrypts and stores auth state, attempt history, sensitive user data
- **`lib/cache` (QueryCache)** – Cleared on logout to prevent stale data leaks; coordinates with auth lifecycle
- **`lib/api` (RequestManager)** – Makes auth API calls; provides retry/rate limit for signup/signin
- **`lib/utils/logger`** – Auth event logging (security category for auth state changes)
- **`lib/analytics`** – Tracks auth flows (signup success/failure, signin success/failure)
- **`lib/kernel`** – App bootstrap; coordinates kernel phase readiness with route guards

---

## File Breakdown

| File                                                                                        | Purpose                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth-state.ts`                                                                             | Manages persistent auth state in SecureStorage. Tracks `hasAccount` flag, user ID/data, session info. Implements logout cleanup (cache invalidation, data removal).          |
| `authService.ts`                                                                            | Core auth operations: `signUpUser()`, `signInUser()`, `resetPassword()`, and `checkUserSession()`. Orchestrates validation, provider calls, and state persistence.           |
| `useAuthGuard.ts`                                                                           | React hook for route protection. Subscribes to auth state changes, handles redirects, supports auth levels ('account-only', 'world-required').                               |
| `sessionService.ts`                                                                         | Session lifecycle helpers: `checkUserSession()`, `prepareAuthNavigation()`. Used during bootstrap to determine routing.                                                      |
| `auth-attempt-guard.ts`                                                                     | Brute-force protection: tracks failed auth attempts per email, enforces 5-attempt/10-min limit, 15-min lockout.                                                              |
| `auth-health-monitor.ts`                                                                    | Periodic session health checks via background jobs. Verifies session validity every 4 hours (prod) or 1 minute (dev). Triggers SAFE safe mode on expiration.                 |
| `validation.ts`                                                                             | Input validation functions: `validateEmail()`, `validatePassword()`, `validateUsername()`. Includes sanitization and security checks (ReDoS-safe, SQL injection protection). |
| `emailUtils.ts`                                                                             | Email helpers: `getEmailDomain()`, `getEmailProvider()`, `openEmailApp()`. Enables user-friendly email verification flows.                                                   |
| `redirectSafety.ts`                                                                         | Redirect safety utilities (not detailed here; likely prevents open redirects).                                                                                               |
| `encrypted-storage.ts`                                                                      | Legacy file (likely deprecated in favor of `lib/storage/SecureStorage`).                                                                                                     |
| `useSignInForm.ts`, `useSignUpForm.ts`, `useResetPasswordConfirm.ts`, `useWelcomeScreen.ts` | React hooks for form state management and auth flows. UI-specific (app-layer), not core auth logic.                                                                          |

**Note**: Auth provider implementations (e.g., SupabaseAuthProvider) are now located in `lib/services/` for better separation of concerns and reusability across projects.
