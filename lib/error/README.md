# Error Module

Centralized error handling system with type-safe error codes, structured metadata, and safe mode resilience. Provides consistent error management across the application with graceful failure handling and user recovery options.

## When to Use This Module

**For centralized error handling:**
- Throwing and catching type-safe errors with structured metadata
- Converting unknown errors to AppError instances
- Getting user-friendly error messages and recovery strategies
- Validating error codes and accessing error metadata

**For safe mode resilience:**
- Trigger safe mode when critical systems fail (storage corruption, auth failures, kernel timeouts)
- Handle persistent network/sync failures across multiple retries
- Provide users with clear recovery options instead of crashes

**Don't use for:**
- Transient network glitches (use retry logic instead)
- Missing optional features (disable gracefully)
- Single failed API calls (use normal error handling)

## Architecture & Data Flow

### Centralized Error Handling

```
App Code
  ↓
Throw/Catch AppError with ERROR_CODES
  ↓
Type-safe error codes + structured metadata
  ↓
Consistent logging, user messages, retry strategies
```

### Safe Mode Resilience

```
NORMAL (healthy)
       ↓
[Health checks detect failure]
       ↓
DEGRADED or SAFE (some features unavailable)
       ↓
[If recovery fails or critical enough]
       ↓
RECOVERY (critical failure with recovery options)
       ↓
[User chooses recovery action]
       ↓
[Recovery procedure runs]
       ↓
back to NORMAL (if successful)
```

**Key Components:**

**Error Handling:**
- **AppError** – Typed error class enforcing valid error codes from ERROR_CODES
- **ERROR_CODES integration** – Centralized registry with metadata (severity, recoverability, user messages)
- **Validation helpers** – Type guards, metadata accessors, error conversion utilities
- **Error enrichment** – Automatic metadata population for logging and analytics

**Safe Mode:**
- **SafeModeLevel** – State machine: NORMAL, DEGRADED, SAFE, RECOVERY
- **SafeModeReason** – Why it triggered (storage, auth, network, kernel, etc.)
- **SafeModeState** – Immutable snapshot (level, reason, affected features, recovery options, timestamp)
- **AppKernel integration** – Stores `state.safeMode`, triggers listener notifications on change
- **React hooks** – `useSafeMode()`, `useIsSafeMode()`, `useIsInSafeModeLevel(level)`, `useSetSafeMode()`, `useClearSafeMode()`
- **SafeModeScreen (UI)** – DEGRADED+SAFE bundled (shows reason + "back to nav"); RECOVERY separate (recovery actions)

## API Reference

### Centralized Error Handling

#### `AppError` Class

Typed error class that enforces valid error codes from ERROR_CODES registry.

```typescript
class AppError extends Error {
  constructor(code: string, message: string, cause?: Error);
  
  readonly code: string;           // ERROR_CODES.* value
  readonly category: string;       // 'auth', 'network', etc.
  readonly severity: ErrorSeverity; // 'critical', 'high', 'medium', 'low'
  readonly recoverable: boolean;   // Can be resolved with retry/user action
  readonly retryStrategy: RetryStrategy; // 'exponential-backoff', 'linear', 'none'
  readonly timestamp: number;      // When error was created
  readonly userMessage?: string;   // User-friendly message
  
  toJSON(): object;                // Structured serialization
}
```

**Example:**
```typescript
import { AppError } from '@/lib/error';
import { ERROR_CODES } from '@/lib/utils';

throw new AppError(
  ERROR_CODES.AUTH.INVALID_CREDENTIALS,
  'Invalid email or password'
);
```

#### Type Guards & Helpers

**`isAppError(error: unknown): error is AppError`**
Check if error is an AppError instance.

**`toAppError(error: unknown): AppError`**
Convert any error to AppError (preserves AppError, wraps others).

**`getErrorSeverity(code: string): ErrorSeverity`**
Get severity level for error code.

**`getErrorUserMessage(code: string): string | undefined`**
Get user-friendly message for error code.

**`isRecoverableError(code: string): boolean`**
Check if error can be recovered from.

**Example:**
```typescript
import { isAppError, getErrorSeverity, isRecoverableError } from '@/lib/error';

try {
  await riskyOperation();
} catch (error) {
  if (isAppError(error)) {
    if (isRecoverableError(error.code)) {
      // Retry logic
    }
    logger.error(error.category, error.message, { code: error.code });
  }
}
```

#### Error Code Validation

**`validateErrorCodeDev(code: string, context: string): void`**
Development-only validation that warns on invalid error codes.

**`getAllErrorCodes(): string[]`**
Get all registered error codes.

**`getErrorCodesByCategory(category: string): string[]`**
Get error codes for specific category.

---

### Safe Mode System

```typescript
enum SafeModeLevel {
  NORMAL = "normal",       // Everything works
  DEGRADED = "degraded",   // Some features unavailable (transient issues)
  SAFE = "safe",           // Minimal functionality (persistent issues)
  RECOVERY = "recovery",   // Critical failure (separate screen)
}
```

### SafeModeReason Enum

```typescript
enum SafeModeReason {
  STORAGE_UNREADABLE, STORAGE_CORRUPTED, STORAGE_QUOTA_EXCEEDED,
  AUTH_EXPIRED, AUTH_INVALID, SESSION_LOST,
  KERNEL_TIMEOUT, KERNEL_PRELOAD_FAILED, KERNEL_CONFIG_FAILED,
  NETWORK_SYNC_FAILURES, NETWORK_CASCADE, NETWORK_UNAVAILABLE,
  UNKNOWN,
}
```

### SafeModeState Interface

```typescript
interface SafeModeState {
  level: SafeModeLevel;           // Current level
  reason: SafeModeReason;         // What triggered it
  affectedFeatures: AffectedFeature[]; // Disabled features
  recoveryOptions: RecoveryAction[];   // User recovery choices
  timestamp: number;              // When triggered
  details?: string;               // Additional context
  originalError?: Error;          // Underlying error
}
```

### React Hooks

#### `useSafeMode(): SafeModeState | null`

Get current safe mode state (null if NORMAL).

```typescript
const safeMode = useSafeMode();
if (safeMode) {
  console.log(safeMode.reason); // STORAGE_CORRUPTED, etc.
  console.log(safeMode.affectedFeatures); // Features that are disabled
}
```

#### `useIsSafeMode(): boolean`

Check if any safe mode is active (DEGRADED, SAFE, or RECOVERY).

#### `useIsInSafeModeLevel(level: SafeModeLevel): boolean`

Check if in specific level (e.g., RECOVERY).

#### `useSetSafeMode(reason: SafeModeReason, details?: string): (reason: SafeModeReason, details?: string) => void`

Trigger safe mode transition. Called when health check detects failure.

```typescript
const setSafeMode = useSetSafeMode();

try {
  // ... operation ...
} catch (error) {
  setSafeMode(SafeModeReason.STORAGE_CORRUPTED, error.message);
}
```

#### `useClearSafeMode(): void`

Exit safe mode (called after successful recovery).

```typescript
const clearSafeMode = useClearSafeMode();

if (recoverySuccessful) {
  clearSafeMode();
}
```

#### `useIsFeatureAffected(feature: AffectedFeature): boolean`

Check if feature is disabled by safe mode.

```typescript
const isSyncDisabled = useIsFeatureAffected(AffectedFeature.SYNC);
if (isSyncDisabled) {
  return <Button disabled title="Sync unavailable in safe mode" />;
}
```

### Tiered Error Reporting

Error reporting respects user consent levels with tiered payload scoping. Integrated with error tracking providers for crash reporting and API error tracking.

#### Consent-Based Payload Scoping

- **`none`**: No error reporting (errors stored locally; user prompted for opt-in via dialog)
- **`basic`**: Minimal payload (error type, message, stack trace, app version) - no component stack, user context, or breadcrumbs
- **`full`**: Full payload (includes component stack, user context, breadcrumbs, device info)

#### `getCrashReportPayload(error: Error, componentStack?: string, consent: ConsentLevel): ErrorCaptureOptions | null`

Builds consent-appropriate error capture options for the ErrorTrackerProvider. Returns `null` for `none` consent (no send).

**Parameters:**
- `error`: The Error object to report
- `componentStack?`: React component stack (for render errors)
- `consent`: Current analytics consent level

**Returns:** Error capture options or `null` if reporting disabled

**Example:**
```typescript
import { getCrashReportPayload, AnalyticsConsent } from "@/lib/analytics";
import { getErrorTracker } from "@/lib/services";

try {
  // risky operation
} catch (error) {
  const options = getCrashReportPayload(error, componentStack, AnalyticsConsent.getLevel());
  if (options) {
    getErrorTracker().captureException(error, options);
  }
}
```

**Integration Points:**
- `ErrorBoundary.tsx`: Catches React render errors with tiered reporting
- `lib/api/request-manager.ts`: Reports API failures with consent scoping

## Dependencies

### External

- **React** (hooks)
- **AppKernel** (state subscription)

### Internal

- **`lib/kernel/app-kernel.ts`** – State management (stores/updates safeMode state)
- **`lib/utils/logger.ts`** – Logging (optional error category)

## Error Handling & Edge Cases

### Multiple Failures

If one system fails while already in safe mode, the reason updates but state preserved. Use highest severity level.

### Recovery Timeout

Recovery actions can timeout. Implement timeouts in recovery handlers; show user-friendly error if recovery fails.

### Offline During Recovery

Some recovery actions (CONTACT_SUPPORT, RESTORE_BACKUP) require connectivity. Handle gracefully with fallback options.

### Partial Recovery

App may recover partially (e.g., auth works but sync fails). Use lower-severity level if possible; avoid overcorrecting.

## Performance Notes

- Safe mode checks should be **infrequent** (health polling interval configurable, default 30s)
- State updates trigger AppKernel listeners, which notify subscribed components
- Component hooks use `useEffect` + state to avoid rerenders on unrelated kernel updates
- Avoid checking safe mode in high-frequency renderers (like list items)

## Observability

Safe mode events are automatically tracked via [lib/analytics](../analytics):

| Event | When |
| --- | --- |
| `safe_mode_entered` | User enters safe mode (includes reason, affected features) |
| `safe_mode_action` | User taps "Back to Navigation" (DEGRADED/SAFE state) |
| `safe_mode_recovery_action_selected` | User selects recovery action (RECOVERY state) |
| `safe_mode_recovery_action_succeeded` | Recovery completes successfully |
| `safe_mode_recovery_action_failed` | Recovery fails (includes error context) |

All events respect analytics consent and don't include sensitive data.

## Related Modules

- **`lib/kernel`** – Stores and manages safe mode state; integrates with bootstrap phases
- **`lib/analytics`** – Tracks safe mode events (user behavior, recovery success rates); provides `getCrashReportPayload()` for tiered error reporting based on consent levels
- **`lib/auth`** – AuthStateManager can trigger AUTH safe mode reasons
- **`lib/storage`** – SecureStorage validation triggers STORAGE safe mode reasons
- **ErrorBoundary.tsx** – Separate React error boundary (pre-existing, catches render errors)

## File Breakdown

| File | Purpose |
| --- | --- |
| `safe-mode.ts` (388 lines) | Type definitions (SafeModeLevel, SafeModeReason, SafeModeState, AffectedFeature), enums, helper functions |
| `ErrorBoundary.tsx` | React error boundary for render-time errors (separate from safe mode) |
| `feature-gating.ts` | Feature disable/enable logic during safe mode (maps reasons to disabled features) |
| `navigation-guards.ts` | Navigation restrictions during safe mode (prevent navigation to features that are disabled) |
| `network-cascade-detector.ts` | Monitors network failures; triggers NETWORK_CASCADE reason when failures cascade |
| `recovery-actions.ts` | Recovery action handlers (CLEAR_CACHE, RESET_AUTH, RESTORE_BACKUP, CONTACT_SUPPORT, REINSTALL) |
| `index.ts` | Barrel export of public API |
