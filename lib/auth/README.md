# Auth Module

Comprehensive authentication system providing email/password auth with secure session management, rate limiting, brute-force protection, input validation, and integration with optional auth providers (e.g., Supabase). Designed as a portable foundation for building auth-protected applications.

## When to Use This Module

**Use this module if you need to:**

- Implement email/password authentication with brute-force protection
- Protect routes based on authentication state (account-only, world-required)
- Handle user signup, signin, password reset, and logout flows with input validation
- Prevent brute-force attacks with rate limiting and account lockout
- Store auth state securely across app restarts via [lib/storage's SecureStorage](../storage/README.md)
- Manage user sessions with automatic recovery and Supabase integration
- Support optional third-party auth providers (Supabase, future: OAuth2)
- Validate input forms using [lib/schemas](../schemas/README.md) Zod schemas

**Do NOT use this module for:**

- OAuth2/OIDC social login (not yet supported; future enhancement)
- Multi-factor authentication (MFA) out-of-the-box (future enhancement)
- JWT token management beyond session recovery (consider token layer)
- Role-based access control at the auth level (implement using [lib/premium's SubscriptionManager](../premium/README.md) or domain-specific checks instead)
- Route protection/authentication guards (use [lib/routing's AUTH_CONFIG](../routing/README.md) + `useAuthGuard` hook instead)

## Architecture & Data Flow

```
User Action (SignUp / SignIn / PasswordReset)
        ↓
Validate Input (email, password, username)
        ↓
Check Auth Attempt Guard (brute-force protection)
        ↓
Call Auth Provider (Supabase, custom API, etc.)
        ↓
Persist Session to SecureStorage
        ↓
Update Auth State (hasAccount: true)
        ↓
Return Result (success/error)
        ↓
UI Triggers Redirect (based on result)
```

**Key Principles:**

- **Secure-by-default**: All credentials encrypted via SecureStorage; no plaintext storage
- **Brute-force protected**: Rate limiting per email via auth-attempt-guard (5 attempts / 10 min)
- **Validated inputs**: Email/password/username validated before reaching auth provider
- **Session recovery**: Auth state persists; app recovers session on restart
- **Provider-agnostic**: Core logic independent of auth provider (Supabase, Firebase, custom API)
- **Graceful degradation**: Offline support via SecureStorage; no external call required for auth checks
- **Observable**: All auth events logged and tracked to analytics

## API Reference

### `AuthStateManager`

Manages local auth state storage and retrieval.

#### `AuthStateManager.getAuthState(): Promise<SupabaseAuthState>`

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
await AuthStateManager.setSession(supabaseSession);
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

- **`@supabase/supabase-js`** (optional, lazy-loaded) – Auth provider integration
- **`expo-router`** – Routing and navigation (for route protection)

### Internal Dependencies

- **`lib/storage` (SecureStorage)** – Encrypted storage for auth state and attempts
- **`lib/cache` (QueryCache)** – Cleared on logout to prevent stale user data leaks
- **`lib/api` (RequestManager)** – Makes auth API calls (signup, signin, reset password)
- **`lib/database` (Supabase lazy)** – Optional auth provider; guarded by `isSupabaseConfigured()`
- **`lib/utils/logger`** – Logs auth events and security incidents
- **`lib/analytics`** – Tracks auth flows (signup, signin, failures)
- **`lib/kernel`** – App bootstrap state for route guards

---

## Error Handling & Edge Cases

### Supabase Not Configured

If Supabase is not configured (e.g., GitHub Pages, no env vars), the module degrades gracefully:

- `signUpUser()` returns error: "Unable to connect to servers"
- `useAuthGuard()` skips subscription setup
- Auth state is still readable from local storage

### Brute-Force Protection

After 5 failed attempts in 10 minutes, further attempts fail with: `"Too many sign up attempts. Try again in XXX seconds."`

- Tracked per email × scope (separate counters for signin vs. signup)
- Resets on successful auth
- Lockout persists across app restarts (stored in SecureStorage)

### Email Already Exists (Signup)

Supabase returns error, module detects common patterns ("User already registered", "duplicate key") and sets `showEmailExistsModal: true` to trigger UI modal.

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

`useAuthGuard()` sets up Supabase auth subscription once per mount. Listens to future auth state changes; no polling.

### Session Recovery

On app launch, a single `checkUserSession()` call. If session valid and profile complete, determines routing destination. Non-blocking.

---

## Related Modules

- **`lib/database` (Supabase)** – Auth provider integration; optional, guarded by `isSupabaseConfigured()`
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

---

## Testing

Currently, no dedicated test guide exists for this module. When adding tests, create a guide at `docs/A Testing Guide/auth.md` following the repository's testing guide template.

**Manual testing tips:**

- **Signup**: Valid email + strong password → should succeed; weak password → should fail with validation error
- **Brute-force**: Attempt signup 6 times with same email → 6th attempt should fail with lockout message
- **Session recovery**: Signup → close app → reopen → `AuthStateManager.getAuthState()` should return `hasAccount: true`
- **Logout**: Sign in → call `clearAuthState()` → verify all storage keys cleared; `getAuthState()` returns `hasAccount: false`
- **Route guard**: Protect a route with `useAuthGuard('account-only')` → unauthenticated user should be redirected
- **Email validation**: Test various email formats; verify ReDoS-safe regex doesn't hang on pathological inputs
- **Offline**: Disable network → attempt signup → should fail gracefully (not hang)

---

## Future Enhancements

- **Account Recovery**: Account deletion, data export, identity verification

_Deferred (cost/complexity) - see `docs/suggestions/auth/` for discussion:_

- Social Login (OAuth2 providers - deferred, cost)
- Passwordless Auth (Magic link, WebAuthn, biometric - deferred, complicated)
- Security Events (Audit log, IP tracking, device fingerprinting - deferred, complicated)
