# Phase 4: UI Notifications

## Overview

Phase 4 provides real-time Toast and Snackbar notifications for offline/online status changes and sync events. The notification system is fully decoupled from the sync infrastructure and uses existing UI components from `components/ui`.

## Components & Hooks

### `OfflineSyncNotificationLayer`
**Location**: `components/offline/OfflineSyncNotificationLayer.tsx`

Aggregates all offline/sync notifications and renders them as Toast/Snackbar components.

**Usage**:
```tsx
import { OfflineSyncNotificationLayer } from '@/components/offline';

// Mount near app root (e.g., in AppKernel provider or top-level layout)
export function App() {
  return (
    <>
      <YourAppContent />
      <OfflineSyncNotificationLayer />
    </>
  );
}
```

### `useOfflineNotifications`
**Location**: `lib/offline/use-offline-notifications.ts`

Subscribes to network status changes and returns Toast state for offline/online transitions.

**Returns**:
```typescript
interface OfflineToastState {
  visible: boolean;
  message: string;
  type: 'info' | 'warning';  // 'warning' for offline, 'info' for online
}
```

**Usage** (if using hooks directly without component wrapper):
```tsx
import { useOfflineNotifications } from '@/lib/offline';
import { AppToast } from '@/components/ui';

export function MyComponent() {
  const offlineToast = useOfflineNotifications();
  return <AppToast {...offlineToast} />;
}
```

### `useSyncNotifications`
**Location**: `lib/offline/use-sync-notifications.ts`

Subscribes to sync manager status and returns both Toast and Snackbar state for sync events.

**Returns**:
```typescript
interface SyncNotificationsReturn {
  toastProps: {
    visible: boolean;
    message: string;
    type: 'info' | 'success';  // success for completed, info for in-progress
    duration: number;
  };
  snackbarProps: {
    visible: boolean;
    message: string;
    tone: 'error' | 'warning';
    actionText: string;        // 'Retry Now' for failures
    onAction: () => void;       // Triggers retry
    duration: number;
  };
}
```

**Usage** (if using hooks directly):
```tsx
import { useSyncNotifications } from '@/lib/offline';
import { AppToast, SnackBar } from '@/components/ui';

export function MyComponent() {
  const { toastProps, snackbarProps } = useSyncNotifications();
  return (
    <>
      <AppToast {...toastProps} />
      <SnackBar {...snackbarProps} />
    </>
  );
}
```

## Notification Types

### 1. Offline Status (Toast - Warning)
Triggered when device goes offline:
```
📡 You are offline. Changes will sync when online.
```

### 2. Online Status (Toast - Info)
Triggered when device comes back online:
```
✓ You are back online.
```

### 3. Sync Started (Toast - Info)
Triggered when sync begins:
```
🔄 Syncing 3 changes...
```

### 4. Sync Completed (Toast - Success)
Triggered when all mutations sync successfully:
```
✓ 3 changes synced.
```

### 5. Sync Failed (Snackbar - Error with Retry)
Triggered when sync has failures:
```
⚠ Failed to sync 1 item. Retrying...
[Retry Now] <- clickable action
```

## Integration Steps

1. **Mount the notification layer** in your app root or top-level layout:
   ```tsx
   // In app/_layout.tsx or AppKernel provider
   import { OfflineSyncNotificationLayer } from '@/components/offline';
   
   export default function RootLayout() {
     return (
       <>
         <YourExistingProviders>
           {/* app content */}
         </YourExistingProviders>
         <OfflineSyncNotificationLayer />
       </>
     );
   }
   ```

2. **No additional setup required**. The hooks automatically:
   - Subscribe to `NetworkDetection.subscribe()` for online/offline changes
   - Subscribe to `OnlineSyncManager.subscribe()` for sync status updates
   - Clean up subscriptions on component unmount
   - Handle Toast auto-dismiss timeouts
   - Display Snackbar with Retry action on failures

## Technical Details

### Network Status Detection
- Powered by `NetworkDetection` singleton from `lib/network`
- Watches real-time `NetworkStatus` changes (isOnline, type, quality)
- Works cross-platform (web, iOS, Android)

### Sync Status Tracking
- Powered by `OnlineSyncManager` singleton from `lib/offline`
- Exposes `isSyncing`, `totalQueued`, `syncedCount`, `failedCount`, `conflicts`
- Listeners receive updates on every status change
- Retry button calls `OnlineSyncManager.syncAll()` for manual sync

### Toast vs Snackbar
- **Toast**: Temporary, auto-dismisses (2.5-3s), non-blocking
  - Offline/online transitions
  - Sync started/completed
- **Snackbar**: Longer duration (6s), has action button, keyboard-aware
  - Sync failures with Retry action
  - Appears above keyboard on mobile

## Priority & Display

If multiple notifications fire simultaneously:
- **Offline toast takes priority** over sync toast (user needs to know they're offline first)
- **Snackbar displays independently** (errors/retries are separate concern)
- Only one notification type visible at a time (Toast XOR Toast, but Snackbar can coexist)

## Customization

To customize messages, durations, or tones, edit the notification hooks:

```tsx
// In useOfflineNotifications or useSyncNotifications:
setToastState({
  visible: true,
  message: 'Custom message here',
  type: 'info',  // or 'warning', 'success', 'error'
  duration: 5000,  // ms
});
```

## Testing

To test notifications manually:

1. **Offline status**: 
   - Dev tools → Network → go offline
   - Should see: "📡 You are offline..." toast
   - Go online → should see "✓ You are back online." toast

2. **Sync started/completed**:
   - Create a queued mutation while offline
   - Go online → should see "🔄 Syncing..." then "✓ synced." toasts

3. **Sync failure with retry**:
   - Force a sync failure (network error in handler)
   - Should see snackbar with "Failed to sync..." and "Retry Now" button
   - Clicking button triggers sync retry

## Known Limitations

- Notifications are not persisted (reload clears them)
- Multiple sync failures only show the most recent (UI queue not implemented yet)
- Conflict notifications deferred to Phase 5
