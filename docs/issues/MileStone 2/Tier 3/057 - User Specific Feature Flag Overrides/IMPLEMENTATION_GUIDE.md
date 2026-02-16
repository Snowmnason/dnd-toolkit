# Feature Flag Remote Overrides - Implementation Guide

## Issue Summary

**Problem**: Remote feature flags weren't working - `debugLogs: false` in Supabase still showed console logs. Two independent feature flag systems existed but didn't communicate.

**Root Cause**: Logger read static config at construction time and never updated from server. FeatureFlagsManager fetched from Supabase but didn't bridge back to legacy system.

**Solution**: Implemented per-user remote overrides with proper priority system and system bridging.

## Architecture Overview

### Dual System Design
1. **Legacy System** (`FeatureFlags`): Config-driven toggles from `appsettings.*.json`
2. **Server System** (`FeatureFlagsManager`): Runtime flags synced from Supabase with overrides

### Priority Resolution (Highest → Lowest)
1. **Remote Override** (per-user, admin-controlled)
2. **Local Override** (admin testing/debugging)
3. **Server Flag** (global feature flag)
4. **Hardcoded Fallback** (from config)

## Implementation Details

### Core Components

#### 1. FeatureFlagsManager (`lib/feature-flags/server-sync.ts`)
- **Purpose**: Server-driven feature flags with override support
- **Key Methods**:
  - `bootstrapFlags()`: One-time server fetch + override loading
  - `getFlag()`: Priority-based flag resolution
  - `loadCachedRemoteOverrides()`: Offline override support

#### 2. Legacy Bridge (`lib/feature-flags/feature-flags.ts`)
- **Purpose**: Sync server values to legacy config system
- **Key Method**: `syncFromServer()`: Bulk updates legacy flags + notifies listeners

#### 3. Logger Integration (`lib/utils/logger.ts`)
- **Purpose**: Runtime logging control via feature flags
- **Key Method**: `reconfigure()`: Updates logging config after server bootstrap

#### 4. Kernel Integration (`lib/kernel/app-kernel.ts`)
- **Purpose**: Orchestrates bootstrap sequence
- **Key Logic**: Bridge phase after `bootstrapFlags()` syncs systems and reconfigures logger

### Database Schema

```sql
-- Global feature flags
CREATE TABLE feature_flags (
  flag_name TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL,
  kind TEXT NOT NULL, -- 'free', 'premium', 'beta'
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Per-user overrides
CREATE TABLE feature_flag_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  flag_name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL,
  expires_at TIMESTAMPTZ, -- null = never expires
  revoked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Bootstrap Flow

```
App Start
    ↓
FeatureFlagsManager.initialize(supabaseClient, userId)
    ↓
FeatureFlagsManager.bootstrapFlags()
    ├── Fetch server flags (production only)
    ├── Fetch user overrides (production only)
    └── Load hardcoded config (dev only)
    ↓
Kernel Bridge Phase
    ├── FeatureFlags.syncFromServer(serverFlags)
    └── logger.reconfigure(debugLogsEnabled)
    ↓
Runtime Ready
```

### Environment Handling

#### Development Mode
- **Source**: `appsettings.dev.json` only
- **Remote Fetch**: Disabled (no server calls)
- **Overrides**: Not applicable (dev has no QA testers)

#### Production Mode
- **Source**: Server feature flags
- **Remote Fetch**: Enabled
- **Overrides**: Per-user admin controls

### Storage Strategy

#### SecureStorage Keys
- `dnd:feature_flags`: Server flags + metadata
- `dnd:feature_flags:overrides:{userId}`: Cached user overrides
- `dnd:entitlements`: Premium entitlements

#### Caching Logic
- **Freshness**: Overrides cached for offline use
- **Invalidation**: New login clears old user caches
- **Fallback**: Last known values when offline

## Key Implementation Patterns

### Override Resolution Logic
```typescript
getFlag(name: string): boolean {
  // 1. Remote override (highest priority)
  const remoteOverride = this.remoteOverrides.get(name);
  if (remoteOverride && !remoteOverride.revoked &&
      (!remoteOverride.expires_at || new Date(remoteOverride.expires_at) > Date.now())) {
    return remoteOverride.enabled;
  }

  // 2. Local override
  if (this.userOverrides.has(name)) {
    return this.userOverrides.get(name);
  }

  // 3. Server/current state
  const flagState = this.currentFlags.get(name);
  if (flagState) {
    return flagState.enabled;
  }

  // 4. Hardcoded fallback
  return this.getHardcodedFallback(name);
}
```

### Bridge Pattern
```typescript
// In AppKernel after bootstrap
const serverFlags = await FeatureFlagsManager.bootstrapFlags();
FeatureFlags.syncFromServer(serverFlags);
logger.reconfigure(FeatureFlagsManager.getFlag('debugLogs', false));
```

### Defensive Filtering
- **Expiry Checks**: Client-side validation of override expiration
- **Revocation**: Respect server-side revocation flags
- **User ID Validation**: Only fetch overrides for authenticated users

## Testing Strategy

### Test Coverage
- **25 feature flag tests**: Core functionality
- **12 override tests**: Priority, expiry, caching
- **Integration tests**: Kernel bootstrap flow

### Key Test Scenarios
- Override precedence over server flags
- Expired/revoked override filtering
- Offline cached override usage
- Bridge sync to legacy system
- Logger reconfiguration after bootstrap

## Future Considerations

### Planned Extensions
- **Admin UI**: Web interface for override management
- **Bulk Operations**: Apply overrides to user groups
- **Audit Logging**: Track override changes
- **A/B Testing**: Statistical override distribution

### Known Limitations
- **No Real-time Updates**: Overrides require app restart
- **Cache Invalidation**: Manual cache clearing needed
- **Admin Access**: Currently requires direct DB access

## Migration Notes

### Breaking Changes
- Logger config now updates at runtime (not just startup)
- Legacy FeatureFlags now sync from server values
- Development mode skips all remote fetching

### Backward Compatibility
- Existing flag usage unchanged
- Config files still respected as fallbacks
- Local overrides still work for debugging

## Troubleshooting

### Common Issues
1. **Overrides not applying**: Check expiry/revocation status
2. **Logger not updating**: Verify bridge phase in kernel
3. **Cache stale**: Clear SecureStorage and restart
4. **Dev mode issues**: Confirm `isDevelopment()` logic

### Debug Commands
```typescript
// Check current flag state
console.log(FeatureFlagsManager.getAllFlags());

// View remote overrides
console.log(FeatureFlagsManager.remoteOverrides);

// Force rebootstrap
await FeatureFlagsManager.bootstrapFlags();
```