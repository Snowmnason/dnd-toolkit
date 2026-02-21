# Auth Provider Abstraction: Usage Guide

This guide shows how to use the pluggable auth provider system that enables swapping between Supabase, Firebase, or custom auth backends without changing application code.

## Using the Default Supabase Provider

**No code changes required!** The default Supabase provider is automatically registered during app startup.

```typescript
// Your existing auth code works unchanged
import { AuthStateManager } from '@/lib/auth';

const result = await AuthStateManager.signUpUser('user@example.com', 'password123');
```

**What happens behind the scenes:**
1. Kernel bootstrap registers `SupabaseAuthProvider` via `registerAuthProvider()`
2. `AuthStateManager.configure()` is called with the provider
3. All auth operations route through the injected provider
4. Errors are normalized to common types

## Registering a Custom Provider at Startup

To use a different auth provider, register it during app initialization:

### 1. Create Your Provider

```typescript
import { AuthProvider, AuthResult, Session, InvalidCredentialsError } from '@/lib/services';

export class MyCustomAuthProvider implements AuthProvider {
  constructor(private apiUrl: string, private apiKey: string) {}

  async signIn(email: string, password: string): Promise<AuthResult> {
    try {
      const response = await fetch(`${this.apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        throw new InvalidCredentialsError('Invalid credentials');
      }

      const data = await response.json();
      return {
        success: true,
        data: {
          userId: data.user.id,
          accessToken: data.token,
          raw: data
        }
      };
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        throw error;
      }
      throw new NetworkError('Connection failed', { original: error });
    }
  }

  // Implement other required methods...
  async signUp(email: string, password: string): Promise<AuthResult> { /* ... */ }
  async resetPassword(email: string): Promise<{ success: boolean; message?: string }> { /* ... */ }
  async getSession(): Promise<Session | null> { /* ... */ }
  onAuthStateChange(callback: (session: Session | null) => void): () => void { /* ... */ }
  async signOut(): Promise<void> { /* ... */ }
}
```

### 2. Register During Bootstrap

Update your app's entry point or kernel initialization:

```typescript
// In lib/kernel/app-kernel.ts or similar bootstrap file
import { registerAuthProvider } from '@/lib/services';
import { MyCustomAuthProvider } from './my-custom-auth-provider';

export async function initializeApp() {
  // Register your custom provider
  const provider = new MyCustomAuthProvider(
    process.env.EXPO_PUBLIC_API_URL!,
    process.env.EXPO_PUBLIC_API_KEY!
  );
  registerAuthProvider(provider);

  // Continue with normal app initialization...
}
```

### 3. Use Auth as Normal

```typescript
// Same API, different backend
import { AuthStateManager } from '@/lib/auth';

const result = await AuthStateManager.signInUser('user@example.com', 'password123');
// Now uses your custom provider instead of Supabase
```

## Firebase Provider Implementation Example

```typescript
import { AuthProvider, AuthResult, Session, InvalidCredentialsError, NetworkError } from '@/lib/services';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

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
          raw: result
        }
      };
    } catch (error: any) {
      switch (error.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          throw new InvalidCredentialsError('Invalid email or password', { original: error });
        case 'auth/too-many-requests':
          throw new NetworkError('Too many attempts. Try again later.', { original: error });
        default:
          throw new NetworkError('Authentication failed', { original: error });
      }
    }
  }

  async signUp(email: string, password: string): Promise<AuthResult> {
    try {
      const result = await createUserWithEmailAndPassword(this.auth, email, password);
      const token = await result.user.getIdToken();

      return {
        success: true,
        data: {
          userId: result.user.uid,
          accessToken: token,
          raw: result
        }
      };
    } catch (error: any) {
      switch (error.code) {
        case 'auth/email-already-in-use':
          throw new EmailAlreadyExistsError('Account already exists', { original: error });
        case 'auth/weak-password':
          throw new InvalidCredentialsError('Password too weak', { original: error });
        default:
          throw new NetworkError('Signup failed', { original: error });
      }
    }
  }

  async resetPassword(email: string): Promise<{ success: boolean; message?: string }> {
    try {
      await sendPasswordResetEmail(this.auth, email);
      return { success: true, message: 'Password reset email sent' };
    } catch (error: any) {
      throw new NetworkError('Failed to send reset email', { original: error });
    }
  }

  async getSession(): Promise<Session | null> {
    const user = this.auth.currentUser;
    if (!user) return null;

    const token = await user.getIdToken();
    return {
      userId: user.uid,
      accessToken: token,
      raw: user
    };
  }

  onAuthStateChange(callback: (session: Session | null) => void): () => void {
    return onAuthStateChanged(this.auth, async (user) => {
      if (!user) {
        callback(null);
        return;
      }

      const token = await user.getIdToken();
      callback({
        userId: user.uid,
        accessToken: token,
        raw: user
      });
    });
  }

  async signOut(): Promise<void> {
    await signOut(this.auth);
  }
}
```

## Custom Backend Provider Example

For a REST API backend:

```typescript
import { AuthProvider, AuthResult, Session, InvalidCredentialsError, NetworkError, UserNotFoundError, EmailAlreadyExistsError } from '@/lib/services';

export class RestApiAuthProvider implements AuthProvider {
  constructor(
    private baseUrl: string,
    private apiKey?: string
  ) {}

  private async apiCall(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
      ...options.headers
    };

    const response = await fetch(url, { ...options, headers });
    const data = await response.json();

    if (!response.ok) {
      throw data; // API error response
    }

    return data;
  }

  async signIn(email: string, password: string): Promise<AuthResult> {
    try {
      const data = await this.apiCall('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      return {
        success: true,
        data: {
          userId: data.user.id,
          accessToken: data.token,
          refreshToken: data.refreshToken,
          expiresAt: data.expiresAt,
          raw: data
        }
      };
    } catch (error: any) {
      switch (error.code) {
        case 'INVALID_CREDENTIALS':
          throw new InvalidCredentialsError('Invalid email or password', { original: error });
        case 'USER_NOT_FOUND':
          throw new UserNotFoundError('Account not found', { original: error });
        default:
          throw new NetworkError('Login failed', { original: error });
      }
    }
  }

  async signUp(email: string, password: string): Promise<AuthResult> {
    try {
      const data = await this.apiCall('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      return {
        success: true,
        data: {
          userId: data.user.id,
          accessToken: data.token,
          raw: data
        }
      };
    } catch (error: any) {
      switch (error.code) {
        case 'EMAIL_EXISTS':
          throw new EmailAlreadyExistsError('Account already exists', { original: error });
        case 'INVALID_EMAIL':
          throw new InvalidCredentialsError('Invalid email format', { original: error });
        default:
          throw new NetworkError('Signup failed', { original: error });
      }
    }
  }

  async resetPassword(email: string): Promise<{ success: boolean; message?: string }> {
    try {
      await this.apiCall('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email })
      });
      return { success: true, message: 'Password reset email sent' };
    } catch (error: any) {
      throw new NetworkError('Failed to send reset email', { original: error });
    }
  }

  async getSession(): Promise<Session | null> {
    try {
      const data = await this.apiCall('/auth/session');
      return {
        userId: data.user.id,
        accessToken: data.token,
        refreshToken: data.refreshToken,
        expiresAt: data.expiresAt,
        raw: data
      };
    } catch (error) {
      return null; // No active session
    }
  }

  onAuthStateChange(callback: (session: Session | null) => void): () => void {
    // For REST APIs, you might need to poll or use websockets
    // This is a simplified example
    const interval = setInterval(async () => {
      try {
        const session = await this.getSession();
        callback(session);
      } catch (error) {
        callback(null);
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }

  async signOut(): Promise<void> {
    await this.apiCall('/auth/logout', { method: 'POST' });
  }
}
```

## Provider Registration and Kernel Bootstrap

### How Registration Works

1. **App Startup**: Kernel initializes services
2. **Provider Registration**: `registerAuthProvider()` stores the provider instance
3. **AuthStateManager Configuration**: `AuthStateManager.configure()` is called with the provider
4. **Auth Operations**: All auth calls route through the injected provider

### Bootstrap Integration

```typescript
// lib/kernel/app-kernel.ts
import { registerAuthProvider } from '@/lib/services';
import { SupabaseAuthProvider } from '@/lib/services/supabase/supabase-auth-provider';
import { AuthStateManager } from '@/lib/auth';

export class AppKernel {
  async initialize() {
    // Phase 1: Register services
    const supabaseClient = createSupabaseClient();
    registerAuthProvider(new SupabaseAuthProvider(supabaseClient));

    // Phase 2: Configure auth system
    const provider = getAuthProvider();
    AuthStateManager.configure(provider);

    // Phase 3: Continue bootstrap...
  }
}
```

### Async Provider Registration

For providers that need async initialization:

```typescript
// Register with factory function
registerAuthProvider(async () => {
  const config = await loadConfigFromServer();
  return new MyAsyncAuthProvider(config);
});

// Or register instance after async setup
const provider = await initializeProvider();
registerAuthProvider(provider);
```

## Handling Auth Errors

### Common Error Types

All providers normalize errors to these types:

- **`InvalidCredentialsError`**: Wrong email/password
- **`NetworkError`**: Connection issues, timeouts
- **`UserNotFoundError`**: Account doesn't exist
- **`EmailAlreadyExistsError`**: Duplicate email on signup

### User-Facing Messages

```typescript
import { AuthStateManager } from '@/lib/auth';
import { InvalidCredentialsError, NetworkError } from '@/lib/services';

try {
  await AuthStateManager.signInUser(email, password);
} catch (error) {
  if (error instanceof InvalidCredentialsError) {
    showToast('Invalid email or password. Please try again.');
  } else if (error instanceof NetworkError) {
    showToast('Connection failed. Check your internet and try again.');
  } else {
    showToast('Something went wrong. Please try again later.');
  }
}
```

### Error Logging

Errors are automatically logged with category `'auth'`:

```typescript
// Logs show normalized error + redacted PII
logger.category('auth').error('Sign in failed', {
  error: error.message,
  type: error.constructor.name,
  // PII automatically redacted
});
```

## Debugging Auth Failures

### Check Provider Registration

```typescript
import { getAuthProvider, listRegisteredProviders } from '@/lib/services';

// Verify provider is registered
try {
  const provider = getAuthProvider();
  console.log('Provider registered:', provider.constructor.name);
} catch (error) {
  console.error('No auth provider registered!');
}

// List all registered providers
console.log('Registered providers:', listRegisteredProviders());
```

### Check Auth State

```typescript
import { AuthStateManager } from '@/lib/auth';

// Check current auth state
const state = await AuthStateManager.getAuthState();
console.log('Auth state:', state);

// Check stored session
const session = await AuthStateManager.getStoredSession();
console.log('Stored session:', session);
```

### Network Issues

```typescript
// Test provider connectivity
import { getAuthProvider } from '@/lib/services';

const provider = getAuthProvider();
try {
  await provider.getSession(); // Test basic connectivity
  console.log('Provider connection OK');
} catch (error) {
  console.error('Provider connection failed:', error);
}
```

### Provider State

```typescript
// Check provider-specific state
const provider = getAuthProvider();
console.log('Provider type:', provider.constructor.name);

// For Supabase provider
if (provider instanceof SupabaseAuthProvider) {
  const { data } = await supabase.auth.getSession();
  console.log('Supabase session:', data.session);
}
```

## Troubleshooting Common Issues

### "Auth provider not initialized"

**Cause**: Calling auth methods before provider registration completes.

**Solution**: Ensure provider is registered during kernel bootstrap before any auth operations.

```typescript
// Bad: Auth called before provider ready
AuthStateManager.signInUser(email, password); // ❌ Throws error

// Good: Wait for kernel ready
if (kernel.phases.appReady) {
  AuthStateManager.signInUser(email, password); // ✅ Works
}
```

### "Invalid credentials" on valid login

**Cause**: Provider-specific error mapping issue.

**Debug**:
```typescript
try {
  await AuthStateManager.signInUser(email, password);
} catch (error) {
  console.log('Normalized error:', error.message);
  console.log('Original error:', error.original); // Check provider-specific details
}
```

### Session not persisting

**Cause**: Provider session handling or SecureStorage issue.

**Check**:
```typescript
// Verify session storage
const stored = await SecureStorage.getItem('auth_session');
console.log('Stored session:', stored);

// Test provider session
const providerSession = await getAuthProvider().getSession();
console.log('Provider session:', providerSession);
```

### Provider switching mid-session

**Warning**: Switching providers invalidates existing sessions.

```typescript
// This will break existing sessions
registerAuthProvider(new FirebaseAuthProvider()); // ❌ Existing Supabase session invalid

// Instead, switch providers only on logout
await AuthStateManager.signOut();
registerAuthProvider(new FirebaseAuthProvider()); // ✅ Clean switch
```

## Testing Custom Providers

### Mock Provider for Unit Tests

```typescript
import { AuthProvider, AuthResult, Session } from '@/lib/services';

export class MockAuthProvider implements AuthProvider {
  signInCalls: Array<{ email: string; password: string }> = [];
  signUpCalls: Array<{ email: string; password: string }> = [];

  async signIn(email: string, password: string): Promise<AuthResult> {
    this.signInCalls.push({ email, password });

    if (email === 'test@example.com' && password === 'password') {
      return {
        success: true,
        data: {
          userId: '123',
          accessToken: 'mock-token',
          raw: { mock: true }
        }
      };
    }

    throw new InvalidCredentialsError('Invalid credentials');
  }

  async signUp(email: string, password: string): Promise<AuthResult> {
    this.signUpCalls.push({ email, password });

    return {
      success: true,
      data: {
        userId: '123',
        accessToken: 'mock-token',
        raw: { mock: true }
      }
    };
  }

  async resetPassword(email: string): Promise<{ success: boolean; message?: string }> {
    return { success: true, message: 'Reset email sent' };
  }

  async getSession(): Promise<Session | null> {
    return {
      userId: '123',
      accessToken: 'mock-token',
      raw: { mock: true }
    };
  }

  onAuthStateChange(callback: (session: Session | null) => void): () => void {
    // Mock implementation
    return () => {};
  }

  async signOut(): Promise<void> {
    // Mock implementation
  }
}
```

### Testing AuthStateManager with Mock Provider

```typescript
import { AuthStateManager } from '@/lib/auth';
import { registerAuthProvider } from '@/lib/services';
import { MockAuthProvider } from './mock-auth-provider';

describe('AuthStateManager with injected provider', () => {
  let mockProvider: MockAuthProvider;

  beforeEach(() => {
    mockProvider = new MockAuthProvider();
    registerAuthProvider(mockProvider);
    AuthStateManager.configure(mockProvider);
  });

  it('signs in successfully', async () => {
    const result = await AuthStateManager.signInUser('test@example.com', 'password');

    expect(result.success).toBe(true);
    expect(mockProvider.signInCalls).toHaveLength(1);
  });

  it('handles invalid credentials', async () => {
    await expect(
      AuthStateManager.signInUser('wrong@example.com', 'wrong')
    ).rejects.toThrow(InvalidCredentialsError);
  });
});
```

### Integration Testing

```typescript
describe('Provider registration flow', () => {
  it('registers and uses custom provider', async () => {
    // Register custom provider
    const customProvider = new MyCustomAuthProvider();
    registerAuthProvider(customProvider);

    // Configure AuthStateManager
    AuthStateManager.configure(customProvider);

    // Verify auth operations use the custom provider
    const result = await AuthStateManager.signInUser('user@example.com', 'password');
    expect(result.success).toBe(true);
  });
});
```

This guide covers the essential patterns for using and testing the pluggable auth provider system. The abstraction enables easy backend swapping while maintaining consistent APIs and error handling across your application.