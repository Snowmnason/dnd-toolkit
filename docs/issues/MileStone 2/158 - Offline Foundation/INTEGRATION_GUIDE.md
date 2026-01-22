# Phase 4 Integration Guide

## Quick Start

To enable offline/sync notifications in your app, simply mount the `OfflineSyncNotificationLayer` component in your app root.

### Recommended Location: `app/_layout.tsx`

Add the component after your existing providers:

```tsx
import { OfflineSyncNotificationLayer } from '@/components/offline';

export default function RootLayout() {
  return (
    <AppKernelProvider>
      <ThemeProvider>
        <ScaleProvider>
          {/* ... existing providers ... */}
          <Slot />
          {/* Mount notifications at top level */}
          <OfflineSyncNotificationLayer />
        </ScaleProvider>
      </ThemeProvider>
    </AppKernelProvider>
  );
}
```

## What You Get

✅ **Offline Toast**: Notifies user when going offline/online  
✅ **Sync Status Toast**: Shows when sync starts and completes  
✅ **Sync Failure Snackbar**: Displays failures with Retry button  
✅ **Auto-cleanup**: Subscriptions clean up automatically  
✅ **No Config Needed**: Works out-of-the-box  

## How It Works

1. **`OfflineSyncNotificationLayer`** mounts and initializes two hooks:
   - `useOfflineNotifications()` — listens to `NetworkDetection.subscribe()`
   - `useSyncNotifications()` — listens to `OnlineSyncManager.subscribe()`

2. **Network status changes** trigger offline/online Toasts via `NetworkDetection`

3. **Sync events** trigger Toasts/Snackbars via `OnlineSyncManager.subscribe()`

4. **Retry button** on snackbar calls `OnlineSyncManager.syncAll()` directly

## File Structure

```
lib/offline/
├── use-offline-notifications.ts      ← Network status hook
├── use-sync-notifications.ts         ← Sync status hook
├── sync-manager.ts                   ← Sync manager (Phase 2)
├── mutation-queue.ts                 ← Queue storage (Phase 1)
├── sync-handlers.ts                  ← Handler registry (Phase 2)
└── index.ts                          ← Barrel exports (updated)

components/offline/
├── OfflineSyncNotificationLayer.tsx   ← Main wrapper component
└── index.ts                           ← Barrel export
```

## Exported APIs

All hooks and components are exported from barrels for clean imports:

```tsx
// From lib/offline
export { useOfflineNotifications, useSyncNotifications };

// From components/offline
export { OfflineSyncNotificationLayer };
```

## Advanced Usage (Custom Integration)

If you need to use hooks separately:

```tsx
import { useOfflineNotifications, useSyncNotifications } from '@/lib/offline';
import { AppToast, SnackBar } from '@/components/ui';

export function CustomNotifications() {
  const offlineToast = useOfflineNotifications();
  const { toastProps, snackbarProps } = useSyncNotifications();

  return (
    <>
      <AppToast {...offlineToast} duration={2500} />
      <AppToast {...toastProps} />
      <SnackBar {...snackbarProps} />
    </>
  );
}
```

## What's Next

- **Phase 3** (skipped): Would have created SyncStatusIndicator component
- **Phase 5**: Conflict resolution UI
- **Phase 5+**: Advanced features (settings, manual controls)

## Testing Checklist

- [ ] Mount component in app root
- [ ] Go offline → see offline Toast
- [ ] Go online → see online Toast
- [ ] Queue a mutation offline
- [ ] Go online → see sync started/completed Toasts
- [ ] Force a sync error → see failure Snackbar with Retry
- [ ] Click Retry → sync retries and shows new status
