# Safe Mode System

A resilience layer that detects and gracefully handles critical app failures, providing users with clear recovery options instead of crashes.

## When to Use Safe Mode

Safe mode should be triggered when critical systems fail and the app cannot operate normally. It's **not** for transient errors or expected edge cases—use normal error handling for those.

**Trigger safe mode when:**

- Storage is corrupted or unreadable
- Auth session is invalid and cannot be restored
- Kernel bootstrap times out without completing
- Network/sync failures persist across multiple retries

**Don't trigger safe mode for:**

- Temporary network glitches (use retry logic instead)
- Missing optional features (disable gracefully)
- Expired sessions on first attempt (try refresh before escalating)
- Single failed API calls (use normal error handling)

## Architecture & Data Flow

Safe mode operates through a state machine integrated with AppKernel:

```
NORMAL (null safeMode)
  ↓
[Health checks detect failure]
  ↓
DEGRADED or SAFE (SafeModeLevel enum, user sees degraded/safe screen)
  ↓
[If recovery fails or critical enough]
  ↓
RECOVERY (separate recovery screen with explicit actions)
  ↓
[User chooses recovery action]
  ↓
[Recovery procedure runs]
  ↓
back to NORMAL (if successful)
```

**Key Components:**

1. **lib/error/safe-mode.ts** – Types, enums, and definitions
   - `SafeModeLevel`: NORMAL, DEGRADED, SAFE, RECOVERY
   - `SafeModeReason`: Specific failure reasons (STORAGE_UNREADABLE, AUTH_EXPIRED, etc.)
   - `RecoveryAction`: Available recovery options (CLEAR_CACHE, RESET_AUTH, etc.)
   - `SafeModeState`: Immutable snapshot of app health
   - `SAFE_MODE_DEFINITIONS`: Maps reasons → levels, features, recovery options
   - Helper functions: `getSafeModeDefinition()`, `getSafeModeMessage()`, `createSafeModeState()`

2. **AppKernel (lib/kernel/app-kernel.ts)** – State management
   - `state.safeMode: SafeModeState | null` – Stored in kernel state
   - `setSafeMode(state)` – Set safe mode state (triggers listener notifications)
   - `isSafeMode()` – Check if any safe mode is active
   - `getSafeMode()` – Get current state (null if NORMAL)
   - `isInSafeModeLevel(level)` – Check specific level

3. **React Hooks (hooks/error/use-safe-mode.ts)** – Component integration
   - `useSafeMode()` – Get current safe mode state
   - `useIsSafeMode()` – Check if any safe mode active
   - `useIsInSafeModeLevel(level)` – Check specific level
   - `useIsDegradedOrSafe()` – Check if bundled degraded/safe screen should show
   - `useIsInRecovery()` – Check if in recovery state
   - `useSetSafeMode(reason, details)` – Trigger safe mode transition
   - `useClearSafeMode()` – Exit safe mode (recovery successful)
   - `useIsFeatureAffected(feature)` – Check if feature is disabled

4. **SafeModeScreen (components/SafeModeScreen.tsx)** – UI (Phase 3)
   - DEGRADED + SAFE bundled: Shows reason, affected features, "back to nav" button
   - RECOVERY separate: Shows critical message, recovery action buttons

## Configuration

Safe mode configuration is defined in `config/appsettings.json` (production) or `config/appsettings.dev.json` (development):

```json
{
  "safeMode": {
    "kernelTimeoutMs": 10000,
    "syncFailureThreshold": 3,
    "healthCheckIntervalMs": 30000,
    "autoRecoveryAttempts": 2,
    "autoRecoveryDelayMs": 5000
  }
}
```

In code, load from config:

```typescript
import { getAppConfig } from "@/lib/config";

const config = getAppConfig();
const safeModeConfig = config.safeMode; // Access the SafeModeConfig values
```

## API Reference

### SafeModeLevel

```typescript
enum SafeModeLevel {
  NORMAL = "normal", // Everything works
  DEGRADED = "degraded", // Some features unavailable (bundled in UI)
  SAFE = "safe", // Minimal functionality (bundled in UI)
  RECOVERY = "recovery", // Critical failure (separate screen)
}
```

### SafeModeReason

```typescript
enum SafeModeReason {
  STORAGE_UNREADABLE,
  STORAGE_CORRUPTED,
  STORAGE_QUOTA_EXCEEDED,
  AUTH_EXPIRED,
  AUTH_INVALID,
  SESSION_LOST,
  KERNEL_TIMEOUT,
  KERNEL_PRELOAD_FAILED,
  KERNEL_CONFIG_FAILED,
  NETWORK_SYNC_FAILURES,
  NETWORK_CASCADE,
  NETWORK_UNAVAILABLE,
  UNKNOWN,
}
```

### SafeModeState

```typescript
interface SafeModeState {
  level: SafeModeLevel; // Current level
  reason: SafeModeReason; // What triggered it
  affectedFeatures: AffectedFeature[]; // Features that are disabled
  recoveryOptions: RecoveryAction[]; // User can choose from these
  timestamp: number; // When it was triggered
  details?: string; // Additional context
  originalError?: Error; // The underlying error
}
```

### RecoveryAction

```typescript
enum RecoveryAction {
  CLEAR_CACHE, // Remove QueryCache + app data
  RESET_AUTH, // Clear session, redirect to login
  RESTORE_BACKUP, // Restore from saved backup
  CONTACT_SUPPORT, // Open email to support
  REINSTALL, // Clear all data
}
```

### Example: Triggering Safe Mode

```typescript
import { useSetSafeMode } from '@/hooks/error';
import { SafeModeReason } from '@/lib/error/safe-mode';

function MyComponent() {
  const setSafeMode = useSetSafeMode();

  const handleStorageError = async (error: Error) => {
    setSafeMode(SafeModeReason.STORAGE_CORRUPTED, 'Failed to read encrypted data');
  };

  return (
    // ...
  );
}
```

### Example: Checking Safe Mode in Component

```typescript
import { useSafeMode, useIsFeatureAffected } from '@/hooks/error';

function SyncButton() {
  const safeMode = useSafeMode();
  const isSyncDisabled = useIsFeatureAffected('sync');

  if (isSyncDisabled) {
    return <Button disabled title="Sync unavailable" />;
  }

  return <Button title="Sync Now" onPress={handleSync} />;
}
```

## Dependencies

**External:**

- React (hooks)
- AppKernel (state subscription)

**Internal:**

- `lib/error/safe-mode.ts` – Type definitions
- `lib/kernel/app-kernel.ts` – State management
- `lib/utils/logger.ts` – Logging (optional)

## Error Handling & Edge Cases

**Multiple failures** – If one system fails while already in safe mode, the reason updates but state is preserved. Use highest severity level.

**Recovery timeout** – Recovery actions can timeout. Implement timeouts in recovery handlers and show user-friendly error if recovery fails.

**Offline during recovery** – Some recovery actions (CONTACT_SUPPORT, RESTORE_BACKUP) require connectivity. Handle gracefully.

**Partial recovery** – App may recover partially (e.g., auth works but sync fails). Use lower-severity level if possible.

## Performance Notes

- Safe mode checks should be **infrequent** (health polling interval in config, default 30s)
- State updates trigger AppKernel listeners, which notify all subscribed components
- Component hooks use `useEffect` + state to avoid rerenders on unrelated kernel updates
- Avoid checking safe mode in high-frequency renderers (like list items)

## Observability & Analytics

Safe mode events are automatically tracked via [lib/analytics](../analytics) when users interact with the system:

**Events Tracked:**
- `safe_mode_entered` – When app enters safe mode (reason, affected features, recovery options)
- `safe_mode_action` – When user taps "Back to Navigation" (DEGRADED/SAFE states)
- `safe_mode_recovery_action_selected` – When user selects a recovery action (RECOVERY state)
- `safe_mode_recovery_action_succeeded` – When recovery completes successfully
- `safe_mode_recovery_action_failed` – When recovery fails (includes error context)

**Performance Metrics:**
- `safe_mode_${level}` – Total time spent in safe mode UI (fires if > 60s)
- `recovery_action:${action}` – Duration of recovery action execution

All events respect analytics consent and don't include sensitive data. See [docs/issues/MileStone 2/173 - Safe Mode Implementation/IMPLEMENTATION_OVERVIEW.md](../../docs/issues/MileStone%202/173%20-%20Safe%20Mode%20Implementation/IMPLEMENTATION_OVERVIEW.md) for event schemas and dashboard queries.

## Related Modules

- [lib/kernel/app-kernel.ts](../kernel/app-kernel.ts) – Bootstrap and state management
- [lib/error/ErrorBoundary.tsx](./ErrorBoundary.tsx) – React error boundary (separate from safe mode)
- [lib/auth/auth-state.ts](../auth/auth-state.ts) – Auth validation (triggers AUTH failures)
- [lib/storage/SecureStorage.ts](../storage/SecureStorage.ts) – Storage validation (triggers STORAGE failures)
- [lib/analytics](../analytics/) – Track safe mode events (Phase 6)

## File Breakdown

| File                | Purpose                                              |
| ------------------- | ---------------------------------------------------- |
| `safe-mode.ts`      | Types, enums, definitions, helper functions          |
| `ErrorBoundary.tsx` | React error boundary (pre-existing, separate system) |
| `index.ts`          | Barrel exports                                       |

## Testing

Safe mode should be tested in:

- **Unit tests** – Type definitions and helper functions
- **Integration tests** – Safe mode transitions through AppKernel
- **E2E tests** – User flow: trigger failure → see safe mode UI → recover
- **Manual testing** – Test each recovery action on each platform

See [docs/A Testing Guide/SAFE_MODE_TESTING.md](../../docs/A%20Testing%20Guide/SAFE_MODE_TESTING.md) for detailed testing procedures, test cases, and dev testing tools.

## Future Enhancements

- **Per-component safe mode** – Disable specific buttons/fields instead of entire features
- **Backup infrastructure** – Automatic app state snapshots for restore
- **Safe mode presets** – Pre-configured profiles (e.g., offline mode, low-bandwidth)
- **Advanced analytics** – Track recovery success rates, time-to-recovery, user abandonment
- **Recovery UI customization** – Themed messaging, in-app recovery flows (vs. email)
