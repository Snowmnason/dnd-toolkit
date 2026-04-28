# Auth System Usage Guide

This guide explains how to use the centralized auth system for sign-in, sign-out, re-authentication, and account management operations.

## Overview

The auth system is organized into domain-specific systems that handle different aspects of authentication:

- **Sign-In System**: Handles all forms of session establishment (user login, token restore, OAuth)
- **Sign-Out System**: Orchestrates logout with extensible cleanup phases
- **Sign-Up System**: Manages user registration
- **Delete Account System**: Handles account deletion
- **Auth Manager**: Public API gateway that provides consistent validation and error handling

## Basic Usage

### Sign In

```typescript
import { signInUser } from '@/lib/auth';

// User-initiated sign in
const result = await signInUser('user@example.com', 'password');

if (result.success) {
  // Navigate to the returned redirect destination
  navigate.push(result.redirectTo);
} else {
  // Handle error
  showError(result.error);
}
```

### Sign Out

```typescript
import { initiateSignOut, confirmSignOut } from '@/lib/auth';

// Two-phase sign out for user confirmation flows
const phase1Result = await initiateSignOut('user-initiated');

if (phase1Result.success) {
  // Show confirmation dialog if needed
  const confirmed = await showSignOutConfirmation();
  
  if (confirmed) {
    const phase2Result = await confirmSignOut();
    if (phase2Result.success) {
      navigate.replace('/login');
    }
  }
}
```

### Route Protection

```typescript
import { useAuthGuard } from '@/lib/auth';

export default function ProtectedScreen() {
  const authState = useAuthGuard(kernel.phases.appReady, 'account-only');
  
  if (authState === 'loading') {
    return <LoadingSpinner />;
  }
  
  if (authState === 'unauthenticated') {
    return <Redirect href="/login" />;
  }
  
  return <ProtectedContent />;
}
```

## Advanced Usage

### Re-Authentication (Token Restore)

```typescript
import { performReAuth } from '@/lib/auth';

// During app bootstrap or OAuth flows
const tokens = { access_token: '...', refresh_token: '...' };
const result = await performReAuth(tokens, 'bootstrap');

if (result.success) {
  // Check staleness phase for routing
  if (result.stalenessPhase === 'fresh') {
    navigate.replace('/select-world');
  } else if (result.stalenessPhase === 'stale') {
    navigate.replace('/welcome');
  }
} else {
  navigate.replace('/login');
}
```

### Sign Up

```typescript
import { signUpUser } from '@/lib/auth';

const result = await signUpUser('user@example.com', 'SecurePass123!');

if (result.success) {
  navigate.push(result.redirectTo); // Usually email confirmation screen
} else if (result.showEmailExistsModal) {
  showEmailExistsModal();
} else {
  showError(result.error);
}
```

### Account Deletion

```typescript
import { performDeletePhase2_DeleteAndSignOut } from '@/lib/auth';

// After user confirmation and server-side deletion
const result = await performDeletePhase2_DeleteAndSignOut('user-initiated');

if (result.success) {
  navigate.replace('/login');
} else {
  // Account deleted on server but local cleanup failed
  showWarning('Account deleted but some local data may remain');
}
```

## Staleness-Based Re-Authentication

The system implements security-conscious session restoration based on data age:

- **Fresh** (< 7 days): Auto-restore, proceed to world selection
- **Stale** (7-30 days): Auto-restore but redirect to welcome screen (auto-login available)
- **Dead** (> 30 days): Deny restore, require manual sign-in

```typescript
// Check staleness after re-auth
const result = await performReAuth(tokens, 'bootstrap');

switch (result.stalenessPhase) {
  case 'fresh':
    navigate.replace('/select-world');
    break;
  case 'stale':
    navigate.replace('/welcome'); // Shows auto-login button
    break;
  case 'dead':
    navigate.replace('/login'); // Manual sign-in required
    break;
}
```

## Error Handling

### Common Error Patterns

```typescript
// Handle auth failures consistently
try {
  const result = await signInUser(email, password);
  
  if (!result.success) {
    if (result.error?.includes('Too many')) {
      // Rate limited - show retry timer
      showRateLimitError(result.error);
    } else {
      // Generic auth failure
      showError(result.error);
    }
  }
} catch (error) {
  // Network or unexpected errors
  if (error.message?.includes('network')) {
    showNetworkError();
  } else {
    showGenericError();
  }
}
```

### Brute Force Protection

The system automatically handles rate limiting:

```typescript
import { checkAuthGuard } from '@/lib/auth';

// Check if attempt is allowed before showing form
const guard = await checkAuthGuard(email, 'signin');

if (!guard.allowed) {
  showRateLimitMessage(guard.retryAfterMs);
  return;
}

// Proceed with auth attempt
```

## Integration Points

### With React Navigation

```typescript
// In layout components
export default function AuthLayout() {
  const authState = useAuthGuard(kernel.phases.appReady, 'account-only');
  
  if (authState === 'loading') {
    return <SplashScreen />;
  }
  
  if (authState === 'unauthenticated') {
    return <Slot />; // Shows login screens
  }
  
  return <ProtectedLayout />;
}
```

### With Data Fetching

```typescript
// Clear stale data on sign out
const signOutResult = await confirmSignOut();

// Query cache is automatically cleared, but you can add custom cleanup
if (signOutResult.success) {
  // Any additional cleanup logic
  customCache.clear();
}
```

### With Analytics

```typescript
// Auth events are automatically tracked
// Add custom tracking if needed
const result = await signInUser(email, password);

if (result.success) {
  analytics.track('user_signed_in', {
    method: 'email',
    has_complete_profile: result.userId ? true : false
  });
}
```

## Security Considerations

- **Token Storage**: All sensitive data is encrypted via SecureStorage
- **Session Persistence**: Auth state survives app restarts
- **Rate Limiting**: Automatic protection against brute force attacks
- **Staleness Checks**: Prevents indefinite access with old sessions
- **Input Validation**: All inputs are sanitized and validated
- **Error Isolation**: Sign-out continues despite individual cleanup failures

## Migration from Legacy Auth

If migrating from direct auth provider calls:

```typescript
// Old way
const { data, error } = await supabase.auth.signInWithPassword({ email, password });

// New way
const result = await signInUser(email, password);
```

Key changes:
- Use auth manager functions instead of direct provider calls
- Handle structured results instead of raw provider responses
- Leverage built-in validation and rate limiting
- Use staleness-aware re-authentication