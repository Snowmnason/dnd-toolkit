# Architectural Pattern: Centralized Error Handling

## Decision

**All errors in the application must use the centralized `ERROR_CODES` system combined with the typed `AppError` class.** No arbitrary error strings or magic error codes allowed.

## Rationale

1. **Consistency** - Uniform error handling across all modules and features
2. **Observability** - Structured error codes enable better monitoring and debugging
3. **User Experience** - Consistent error messages and recovery strategies
4. **Maintainability** - Centralized error definitions prevent duplication and inconsistencies
5. **Type Safety** - TypeScript enforcement prevents invalid error codes at compile time

## Pattern

### Core Components

- **`ERROR_CODES`** - Centralized registry of all valid error codes (in `lib/utils/ERROR_CODES.ts`)
- **`ERROR_CODES_METADATA`** - Structured metadata for each error (severity, recoverable, retry strategy, user message)
- **`AppError`** - Typed error class that enforces valid error codes (in `lib/error/app-error.ts`)
- **Validation** - Helper functions to validate and query error codes (in `lib/error/validate-error-code.ts`)
- **Reference** - Machine-readable documentation for each error (in `lib/error/error-code-reference.ts`)

### Error Code Structure

```typescript
export const ERROR_CODES = {
  AUTH: {
    INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
    SESSION_EXPIRED: 'AUTH_SESSION_EXPIRED',
    // ...
  },
  NETWORK: {
    TIMEOUT: 'NETWORK_TIMEOUT',
    OFFLINE: 'NETWORK_OFFLINE',
    // ...
  },
  // ...
};
```

### Error Metadata Structure

```typescript
export const ERROR_CODES_METADATA = {
  [ERROR_CODES.AUTH.INVALID_CREDENTIALS]: {
    severity: 'low',
    recoverable: true,
    retryStrategy: 'none',
    userMessage: 'Invalid email or password. Please try again.',
    category: 'auth'
  },
  // ...
};
```

## Implementation Examples

### Throwing Errors

```typescript
import { AppError } from '@/lib/error';
import { ERROR_CODES } from '@/lib/utils';

// ✅ GOOD: Use AppError with type-safe error codes
async function signInUser(email: string, password: string) {
  try {
    const result = await authProvider.signIn(email, password);
    if (!result.success) {
      throw new AppError(
        ERROR_CODES.AUTH.INVALID_CREDENTIALS,
        'Invalid email or password'
      );
    }
  } catch (error) {
    // Preserve original error for debugging
    throw new AppError(
      ERROR_CODES.AUTH.UNKNOWN,
      `Sign-in failed: ${error.message}`,
      error instanceof Error ? error : undefined
    );
  }
}

// ❌ AVOID: Hardcoded error strings
throw new Error('Invalid email or password');
throw new Error('AUTH_001'); // Magic codes
```

### Catching & Handling Errors

```typescript
import { isAppError, getErrorSeverity, isRecoverableError } from '@/lib/error';
import { ERROR_CODES } from '@/lib/utils';

async function handleOperationWithRetry() {
  try {
    return await someOperation();
  } catch (error) {
    if (isAppError(error)) {
      // Check specific error codes
      if (error.code === ERROR_CODES.NETWORK.TIMEOUT) {
        return retryWithBackoff(() => someOperation());
      }

      if (error.code === ERROR_CODES.AUTH.SESSION_EXPIRED) {
        await clearSession();
        router.push('/login/sign-in');
        return null;
      }

      // Check metadata to decide on retry
      if (error.recoverable) {
        return retryWithStrategy(error.retryStrategy);
      }

      // Log with structured data
      logger.error(error.category, error.message, {
        code: error.code,
        severity: error.severity,
        recoverable: error.recoverable
      });
    }

    // Convert unknown errors
    const appError = toAppError(error);
    logger.error('operation', appError.message, appError.toJSON());
  }
}
```

### User-Facing Messages

```typescript
import { getErrorUserMessage } from '@/lib/error';

function showErrorToUser(error: AppError) {
  const userMessage = getErrorUserMessage(error.code)
    ?? 'An unexpected error occurred. Please try again.';

  showAlert({
    title: 'Error',
    message: userMessage,
    buttons: ['OK']
  });
}
```

### Logging with Error Context

```typescript
import { logger } from '@/lib/utils';

function logErrorWithCode(error: AppError) {
  logger.error(error.category, error.message, {
    code: error.code,
    severity: error.severity,
    recoverable: error.recoverable,
    retryStrategy: error.retryStrategy,
    timestamp: error.timestamp,
    stack: error.stack,
  });
}
```
