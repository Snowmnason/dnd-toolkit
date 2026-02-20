# IMPLEMENTATION_GUIDE.md - Issue #181: Persist Analytics Consent Level Across App Restarts

## Files Created

### Core Consent Management
- **`lib/analytics/consent.ts`**: Main `AnalyticsConsentManager` class with persistence logic
- **`lib/analytics/consent-sync-queue.ts`**: Database sync queue for cross-device consent
- **`hooks/analytics/use-analytics-consent.ts`**: React hook for UI integration

### Storage Integration
- **`lib/storage/index.ts`**: Added `ANALYTICS_CONSENT` and `CONSENT_SYNC_QUEUE` storage keys

### Database Schema
- **`supabase/migrations/001_schema.sql`**: Added `analytics_consent_level` column to `public.user_settings`
- **`supabase/migrations/patch_2026-02-19_analytics_consent.sql`**: Patch migration for existing databases

### UI Integration
- **`Screens/settings/AppSettings.tsx`**: Added consent toggle switch
- **`lib/database/users.ts`**: Added `updateAnalyticsConsentLevel()` and `fetchCurrentUserSettings()` methods

### Bootstrap Integration
- **`lib/kernel/app-kernel.ts`**: Added consent initialization during `READY` phase

## Files Edited

### Bootstrap
- **`lib/kernel/app-kernel.ts`**: Added `AnalyticsConsent.initialize()` call in storage phase

### Database Layer
- **`lib/database/users.ts`**: Enhanced with consent read/write methods following RequestManager patterns

### Storage Keys
- **`lib/storage/index.ts`**: Added new storage keys for consent persistence

### Settings UI
- **`Screens/settings/AppSettings.tsx`**: Added consent toggle with loading states

### Barrel Exports
- **`lib/analytics/index.ts`**: Exported `AnalyticsConsent` and `ConsentSyncQueue`

## Key Implementation Details

### Consent Initialization Strategy

**Read Priority (in order):**
1. **Database** (if authenticated and Supabase configured)
2. **SecureStorage cache** (if fresh, <4 hours old)
3. **Default 'basic'** (GDPR safe fallback)

**Cache Management:**
- Database results cached to SecureStorage with timestamp
- Cache freshness checked on each initialization
- Stale cache triggers background database refresh

### Storage Architecture

**SecureStorage Keys:**
- `STORAGE_KEYS.ANALYTICS_CONSENT`: Current consent level
- `STORAGE_KEYS.ANALYTICS_CONSENT + '_meta'`: Cache metadata (timestamp, source)
- `STORAGE_KEYS.CONSENT_SYNC_QUEUE`: Pending database sync items

**Encryption:** All data encrypted via AES-256-CTR across all platforms.

### Database Sync Queue

**Queue Item Structure:**
```ts
interface PendingConsentSync {
  id: string;
  level: ConsentLevel;
  createdAt: number;
  retryCount: number;
  nextRetryAt: number;
  lastError?: string;
}
```

**Retry Logic:**
- Exponential backoff: 2s → 4s → 8s → 16s → 30s max
- Max 3 retries per item
- Failed items kept for manual inspection

**Network Awareness:**
- Queue processes automatically on network recovery
- Fire-and-forget design (non-blocking)

### React Hook Architecture

**State Management:**
```ts
const [level, setLevelState] = useState<ConsentLevel>(AnalyticsConsent.getLevel());
const [isLoading, setIsLoading] = useState(false);
const [isInitialized, setIsInitialized] = useState(false);
```

**Initialization Flow:**
1. Mount → Call `AnalyticsConsent.initialize()`
2. Set `isInitialized` after successful load
3. Update local state with loaded consent level

**Update Flow:**
1. `setLevel()` called → Set loading state
2. Call `AnalyticsConsent.setLevel()` (persists + queues sync)
3. Update local state → Clear loading state

### UI Integration

**Settings Toggle:**
```tsx
<Switch
  checked={level === 'full'}
  onChange={async (isFull) => {
    await setLevel(isFull ? 'full' : 'basic');
  }}
  disabled={consentLoading}
/>
```

**Loading States:** Toggle disabled during consent changes to prevent race conditions.

## Integration Points

### Analytics Buffer (#70)
- Respects consent when queueing events
- Buffer cleared on consent downgrade (privacy protection)

### Custom Exporters (#178)
- Events gated by consent before export
- Only allowed categories sent to external services

### App Kernel Bootstrap
- Consent initialized in `STORAGE` phase (after storage ready, before analytics)
- Non-critical: failures logged but don't block app startup

### Network Detection
- Consent sync queue processes on network recovery
- Works with existing offline queue infrastructure

## Error Handling Patterns

### Storage Failures
- Logged as warnings (non-fatal)
- Fall back to in-memory state
- App continues with default consent

### Database Sync Failures
- Queued for retry with exponential backoff
- Logged for monitoring
- Local consent always takes precedence

### Initialization Failures
- Hook sets `isInitialized` even on failure
- Uses current in-memory level
- Logs errors for debugging

## Testing Strategy

### Unit Tests (`lib/analytics/consent.test.ts`)
- Initialization from storage/database/default
- Consent level validation and persistence
- Category permission checking
- Storage error handling

### Integration Tests
- Hook initialization and state updates
- Settings UI toggle functionality
- Bootstrap integration (AppKernel)
- Database sync queue processing

### E2E Tests
- Consent persistence across app restarts
- UI toggle saves and restores correctly
- Consent gates analytics events properly

### Manual Test Scenarios
- First launch defaults to 'basic'
- Consent survives app kill/restart
- Database sync works when online
- Offline changes queue properly

## Performance Considerations

### Initialization
- Consent loaded once per app launch
- Cached database results minimize API calls
- Non-blocking: doesn't delay app startup

### Storage Operations
- Async writes don't block UI
- Minimal data stored (just consent level + metadata)
- Encryption overhead negligible

### Hook Re-renders
- Hook returns stable references
- Only re-renders when consent actually changes
- Loading states prevent UI flicker

## Security & Privacy

### Data Minimization
- Only consent level stored (no PII)
- Encrypted at rest on all platforms
- Database sync requires authentication

### GDPR Compliance
- Default 'basic' ensures compliance out-of-the-box
- Explicit user opt-in required for 'full' tracking
- Consent withdrawal clears buffered analytics

### Platform Security
- **Web**: Encrypted localStorage (secure context required)
- **iOS**: Keychain storage (device-level protection)
- **Android**: Encrypted SharedPreferences
- **Desktop**: OS-specific secure storage

## Migration Path

### From In-Memory Only
- No migration needed (fresh start with defaults)
- Users re-set preferences via UI
- Previous behavior (in-memory) replaced seamlessly

### Database Schema
- New `analytics_consent_level` column defaults to 'basic'
- Existing users get default on first database sync
- Patch migration applies to live databases

### Storage Keys
- New keys added to `STORAGE_KEYS`
- No conflicts with existing keys
- Clean separation from other analytics data

## Future Extension Points

### Granular Consent
- Hook can be extended for per-category toggles
- Database schema supports additional consent fields
- UI can add more toggle switches

### Audit Trail
- Database can track consent change history
- Timestamps and user IDs for compliance
- Queryable consent change log

### Consent Expiration
- Add `expiresAt` field to consent data
- Automatic refresh prompts for users
- Configurable expiration periods

## Debugging & Monitoring

### Log Categories
- `logger.category('analytics')` for consent operations
- Initialization, persistence, sync events logged
- Errors captured for monitoring

### Debug APIs
- `AnalyticsConsent.getStoredConsent()` for storage inspection
- `ConsentSyncQueue.getAll()` for queue status
- Hook loading states for UI debugging

### Health Checks
- Consent initialization success/failure
- Storage availability and quota
- Database sync queue health

## Rollback Plan

### Data Cleanup
- `AnalyticsConsent.resetToDefault()` for testing
- `ConsentSyncQueue.clear()` removes pending syncs
- Storage keys can be manually cleared

### Compatibility
- Non-breaking API changes
- Existing analytics code continues working
- Hook is additive (opt-in usage)</content>
<parameter name="filePath">p:\CodingProjects\dnd-toolkit\docs\issues\MileStone 2\Tier 4\181 - Persist Consent\IMPLEMENTATION_GUIDE.md