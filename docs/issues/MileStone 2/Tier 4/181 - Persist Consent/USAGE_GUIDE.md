# USAGE_GUIDE.md - Issue #181: Persist Analytics Consent Level Across App Restarts

## Overview

This feature provides GDPR-compliant analytics consent management that persists across app restarts. Users can choose between 'none', 'basic', and 'full' tracking levels, with consent automatically saved to encrypted storage and optionally synced to the database for cross-device consistency.

## Bootstrap Integration

Consent is initialized early during app startup via AppKernel:

```ts
// AppKernel automatically calls this during bootstrap
await AnalyticsConsent.initialize();
```

This restores the user's previous consent choice from SecureStorage (or database if available) before any analytics events are sent.

## Using the Hook: `useAnalyticsConsent()`

The primary way to manage consent in React components:

```tsx
import { useAnalyticsConsent } from '@/hooks';

function SettingsPage() {
  const { level, setLevel, isLoading, isInitialized } = useAnalyticsConsent();

  if (!isInitialized) {
    return <LoadingSpinner />;
  }

  return (
    <View>
      <Text>Current consent: {level}</Text>
      <Button
        onPress={() => setLevel('full')}
        disabled={isLoading}
      >
        Enable Full Tracking
      </Button>
      <Button
        onPress={() => setLevel('basic')}
        disabled={isLoading}
      >
        Basic Tracking Only
      </Button>
    </View>
  );
}
```

### Hook Options

```tsx
// Force fresh database check (bypass 4-hour cache)
const { level } = useAnalyticsConsent({ forceRefresh: true });

// Custom cache age (check database if cache older than 1 hour)
const { level } = useAnalyticsConsent({ maxAgeMs: 60 * 60 * 1000 });
```

## Settings UI Toggle

A simple toggle switch is available in app settings:

```tsx
// From Screens/settings/AppSettings.tsx
const { level, setLevel, isLoading } = useAnalyticsConsent();

<Switch
  checked={level === 'full'}
  onChange={async (isFull) => {
    await setLevel(isFull ? 'full' : 'basic');
  }}
  leftLabel="Basic"
  rightLabel="Full"
  disabled={isLoading}
/>
```

## Handling Consent Changes in Analytics Dispatch

All analytics events automatically check consent before sending:

```ts
// Automatic consent checking - no manual code needed
Analytics.track('screen_view', { screen: 'Home' }); // Only sent if allowed
Analytics.trackComponentUsage({ component: 'Button', action: 'click' }); // Usage events require 'full'
```

### Manual Consent Checks

For custom analytics logic:

```ts
import { AnalyticsConsent } from '@/lib/analytics';

if (AnalyticsConsent.isAllowed('performance')) {
  // Send performance metrics
}

if (AnalyticsConsent.isAllowed('usage')) {
  // Send usage analytics
}

// 'essential' category always allowed (errors, auth, session)
if (AnalyticsConsent.isAllowed('essential')) {
  // Send error reports, auth events, etc.
}
```

## GDPR Compliance Checklist

- ✅ **Default 'basic'**: App starts with GDPR-safe minimum tracking
- ✅ **Explicit opt-in**: Users must actively choose 'full' tracking
- ✅ **Persistent consent**: Consent survives app restarts
- ✅ **Consent withdrawal**: Downgrading clears existing analytics buffer
- ✅ **Data minimization**: Only essential data sent at 'basic' level
- ✅ **Audit logging**: Consent changes logged for compliance records

## Troubleshooting

### Consent Not Persisting

**Problem**: Consent resets to 'basic' after app restart.

**Solutions**:
- Verify SecureStorage is working (check device storage permissions)
- Check logs for storage errors: `logger.category('analytics')`

### Hook Not Updating UI

**Problem**: `useAnalyticsConsent` doesn't reflect consent changes.

**Solutions**:
- Ensure component re-renders after `setLevel()` calls
- Check `isInitialized` before rendering consent-dependent UI
- Verify hook is called at component root level (not in conditions/loops)

### Database Sync Issues

**Problem**: Consent changes not syncing across devices.

**Solutions**:
- Check network connectivity for database sync
- Verify user authentication (sync only works when logged in)
- Check `ConsentSyncQueue` status: `ConsentSyncQueue.size()`

### Storage Errors

**Problem**: Consent persistence fails with storage errors.

**Solutions**:
- Check device storage quota
- Verify platform-specific storage permissions
- App falls back to in-memory consent (non-fatal)

## Platform-Specific Notes

### Web
- Uses encrypted localStorage via SecureStorage
- Consent persists across browser sessions
- Database sync requires active session

### iOS/Android
- Uses platform Keychain/SharedPreferences via Expo SecureStore
- Consent survives app deletion/reinstallation
- Database sync works offline (queued)

### Desktop
- Uses OS-specific secure storage
- Consent persists across app restarts
- Database sync requires network connectivity

## Testing Consent Behavior

### Manual Test Scenarios

1. **First Launch Default**:
   - Fresh install → consent should be 'basic'
   - Check logs: "consent_initialized" with level 'basic'

2. **Persistence Across Restarts**:
   - Set consent to 'full' → restart app → should still be 'full'
   - Verify via settings UI and `AnalyticsConsent.getLevel()`

3. **UI Toggle**:
   - Toggle in settings → should update immediately
   - Restart app → toggle should reflect saved state

4. **Consent Gating**:
   - Set to 'basic' → usage events should not send
   - Set to 'full' → all events should send

### Debug Commands

```ts
// Check current consent
console.log('Consent level:', AnalyticsConsent.getLevel());

// Check stored consent
AnalyticsConsent.getStoredConsent().then(level => console.log('Stored:', level));

// Check sync queue status
console.log('Pending syncs:', ConsentSyncQueue.size());
ConsentSyncQueue.getAll().forEach(item => console.log(item));

// Force queue processing
ConsentSyncQueue.processQueue();
```

## Migration Notes

### From In-Memory Only
- Previous versions stored consent in-memory only
- First upgrade will initialize from default 'basic'
- Users need to re-set consent preferences

### Storage Key Changes
- Consent stored under `STORAGE_KEYS.ANALYTICS_CONSENT`
- Previous data (if any) not migrated automatically

## Future Enhancements

- **Granular consent**: Per-category toggles (performance, usage, marketing)
- **Consent history**: Audit trail of consent changes
- **Expiration**: Time-based consent refresh requirements
- **Cross-device sync**: Conflict resolution for simultaneous changes</content>
<parameter name="filePath">p:\CodingProjects\dnd-toolkit\docs\issues\MileStone 2\Tier 4\181 - Persist Consent\USAGE_GUIDE.md