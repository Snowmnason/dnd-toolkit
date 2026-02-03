# Safe Mode: Usage & Implementation Guide

## What is Safe Mode?

Safe Mode is an emergency resilience system that activates when critical app failures occur. Instead of crashing, the app enters a controlled state where it can show users what's wrong and provide recovery options.

**The Problem It Solves:**

- Storage corruption → App hangs or crashes
- Auth session expires → User stuck at login
- Network failures cascade → Data updates blocked
- Kernel bootstrap fails → App never fully loads

**The Solution:**

- Detects failure
- Shows user a clear message about what happened
- Offers recovery options they can choose from
- Tracks whether recovery succeeds (for debugging)

## How It Works: 4 States

### 1. NORMAL (default)

App is working normally. Safe mode is `null`.

### 2. DEGRADED or SAFE

Some features are unavailable, but app is partially functional.

**What the user sees:**

```
┌─────────────────────────────┐
│  App in Degraded Mode       │
├─────────────────────────────┤
│  Your app data cannot be    │
│  read right now. This is    │
│  usually temporary.         │
│                             │
│  Affected: sync, offline    │
│                             │
│  [Back to Navigation]       │
└─────────────────────────────┘
```

User can tap "Back to Navigation" to continue using the app with limited features.

### 3. RECOVERY

Critical failure - app can't operate safely. Shows recovery action buttons.

**What the user sees:**

```
┌─────────────────────────────┐
│  Critical Issue Detected    │
├─────────────────────────────┤
│  Your app encountered a     │
│  serious error. Please      │
│  choose a recovery action:  │
│                             │
│  [Clear Cache & Restart]    │
│  [Reset & Log In Again]     │
│  [Contact Support]          │
│  [Reinstall App]            │
└─────────────────────────────┘
```

User must choose one of these options to proceed.

## Triggers: When Does Safe Mode Activate?

Safe mode is triggered by health checks that run during app bootstrap and periodically in the background:

| Trigger              | Level    | Reason                 | Recovery Options                 |
| -------------------- | -------- | ---------------------- | -------------------------------- |
| Storage unreadable   | RECOVERY | Can't decrypt data     | Clear Cache, Restore Backup      |
| Storage corrupted    | RECOVERY | Decryption failed      | Clear Cache, Restore Backup      |
| Auth session expired | SAFE     | Auth token invalid     | Reset Auth                       |
| Auth session lost    | SAFE     | Lost mid-operation     | Reset Auth                       |
| Kernel timeout       | RECOVERY | Bootstrap took >10s    | Clear Cache, Reinstall           |
| Sync failures (3+)   | DEGRADED | Network issues persist | Clear Cache, Contact Support     |
| Network unavailable  | DEGRADED | No internet            | (Auto-recovery when reconnected) |

**Note:** Safe mode is rare. Most transient errors are handled by normal retry logic.

## Recovery Actions: What Can Users Do?

### 1. Clear Cache & Restart

**What it does:** Removes all cached data and restarts the app from clean state.

**When to use:** After network failures, sync issues, or app state corruption.

**Result:** Navigates to world selection screen (user stays logged in).

**Roughly 80% success rate** on cache-related issues.

### 2. Reset & Log In Again

**What it does:** Clears authentication and logs user out completely.

**When to use:** After auth failures or session expiration.

**Result:** Navigates to login screen (user must re-enter credentials).

**Near 100% success rate** on auth issues.

### 3. Contact Support

**What it does:** Opens email with diagnostic information pre-filled.

**When to use:** If other recovery actions don't work, or for advanced issues.

**Result:** User sends email to support team with full diagnostic context.

### 4. Reinstall App

**What it does:** Guides user to manually uninstall and reinstall from app store.

**When to use:** Last resort if other options don't work.

**Result:** Clean app installation, all data cleared.

**100% success rate** but requires reinstall + re-login.

## For Developers: Triggering Safe Mode

Safe mode is triggered automatically by health checks. To manually trigger it (for testing):

**In Settings:**

1. Navigate to Settings screen
2. Scroll to "Safe Mode Testing"
3. Tap one of three buttons to enter DEGRADED, SAFE, or RECOVERY state

**In Code:**

```typescript
import { useSetSafeMode } from "@/hooks/error";
import { SafeModeReason } from "@/lib/error/safe-mode";

function MyComponent() {
  const setSafeMode = useSetSafeMode();

  const handleStorageError = async (error: Error) => {
    // Enter RECOVERY state
    setSafeMode(
      SafeModeReason.STORAGE_CORRUPTED,
      "Storage corruption detected",
    );
  };

  // ...
}
```

## For Developers: Checking Safe Mode

Use hooks to check if app or specific features are in safe mode:

```typescript
import {
  useSafeMode,
  useIsSafeMode,
  useIsFeatureAffected
} from '@/hooks/error';

function MyComponent() {
  const safeMode = useSafeMode();           // Full state or null
  const isSafeMode = useIsSafeMode();       // Boolean
  const isSyncDisabled = useIsFeatureAffected('sync');  // Boolean

  if (isSyncDisabled) {
    return <Button disabled title="Sync unavailable" />;
  }

  return <Button title="Sync Now" />;
}
```

## Analytics: What Gets Tracked

Safe mode events are automatically sent to analytics (Sentry) for monitoring:

**Events fired:**

1. `safe_mode_entered` – When user enters safe mode (reason, features affected)
2. `safe_mode_action` – When user taps "Back to Navigation"
3. `safe_mode_recovery_action_selected` – When user selects a recovery option
4. `safe_mode_recovery_action_succeeded` – When recovery completes successfully
5. `safe_mode_recovery_action_failed` – When recovery fails (includes error)

**Use cases:**

- Monitor safe mode frequency (should be rare)
- Track which recovery actions work best
- Debug failure patterns (e.g., 90% of STORAGE_CORRUPTED lead to CLEAR_CACHE)
- Measure recovery success rates

## Architecture: How It's Implemented

**Files involved:**

- `lib/error/safe-mode.ts` – Type definitions and configuration
- `lib/kernel/app-kernel.ts` – State container
- `components/SplashScreen/SafeModeScreen.tsx` – UI component
- `lib/error/recovery-actions.ts` – Recovery action handlers
- `lib/analytics` – Event tracking

**Flow:**

```
Health Check (storage, auth, kernel)
  ↓ [Failure detected]
  ↓
AppKernel.setSafeMode(reason, details)
  ↓ [Notifies all listeners]
  ↓
app/_layout.tsx [Renders SafeModeScreen instead of normal content]
  ↓ [User sees safe mode UI]
  ↓
[User chooses action]
  ↓
executeRecoveryAction() [Clears cache, resets auth, opens email, etc.]
  ↓ [Success or failure]
  ↓
Navigation or error handling
```

## Configuration

Default settings in `config/appsettings.json`:

```json
{
  "safeMode": {
    "kernelTimeoutMs": 10000, // 10s until bootstrap timeout
    "syncFailureThreshold": 3, // Failures before cascade detected
    "healthCheckIntervalMs": 30000, // Check every 30s
    "autoRecoveryAttempts": 2, // Retry up to 2 times
    "autoRecoveryDelayMs": 5000 // Wait 5s between retries
  }
}
```

## Testing Safe Mode

**Manual testing:**

1. Go to Settings → Safe Mode Testing
2. Tap buttons to trigger different states
3. Test recovery actions

**Automated testing:**
See [docs/A Testing Guide/SAFE_MODE_TESTING.md](../../A%20Testing%20Guide/SAFE_MODE_TESTING.md) for detailed test procedures.

## Related

- [lib/error/README.md](../../../../lib/error/README.md) – Technical API reference
- [docs/A Testing Guide/SAFE_MODE_TESTING.md](../../A%20Testing%20Guide/SAFE_MODE_TESTING.md) – Test cases and procedures
