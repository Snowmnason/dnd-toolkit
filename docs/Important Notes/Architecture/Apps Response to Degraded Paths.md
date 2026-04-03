# Degradation Architecture

Comprehensive framework for handling system failures and degraded states across the application. Defines how the app responds to various failure scenarios while maintaining user experience and data integrity.

## Overview

The degradation system provides graceful handling of system failures through:

- **Capability Flags**: Boolean states tracking system availability (database, network, auth, etc.)
- **Priority Queue**: Error prioritization ensuring critical failures are handled first
- **Recovery Mechanisms**: Automatic and manual recovery paths for degraded systems
- **UI Adaptation**: Components that adapt behavior based on system capabilities

## Degradation Manager

Centralized system for tracking and managing application degradation states.

### Architecture

```
System Components → Degrade Manager → UI Components
       ↓                    ↓              ↓
   Report faults      Queue by priority   Subscribe to flags
   (network down,     (network > auth >   (show offline banner,
    DB unavailable)    storage > sync)     disable features)
```

### Core Components

#### `appDegrade` Singleton
- **Location**: `system/Degrade/app-degrade.ts`
- **Purpose**: Central state store for all degradation flags
- **API**:
  - `set(capability, value, { source, reason })` — Update capability flag
  - `subscribe(callback)` — React to state changes
  - `getState()` — Synchronous state snapshot
  - `isCapable(capability)` — Check if capability is available

#### Error Priority Queue
Manages multiple simultaneous failures with proper precedence:

| Priority | Capability | Reason | Cascades To |
|----------|------------|--------|-------------|
| 0 | `connectivity` | Network is foundation | database, sync, analytics |
| 1 | `auth` | Critical for data sync | database, sync, premium |
| 2 | `storage` | Blocks all persistence | database |
| 3 | `sync` | Transient data issues | analytics |
| 4 | `backgroundJobs` | Degradable operations | analytics |
| 5 | `analytics` | Optional telemetry | N/A |
| 6 | `errorTracking` | Optional reporting | N/A |
| 99 | `premiumFeatures` | Optional features | N/A |

**Queue Logic**:
- Lower number = higher priority (processed first)
- Automatic cascading (network failure affects dependent systems)
- Recovery unblocks dependent systems
- UI shows highest-priority error only

### Integration Points

#### Phase Failure Handling
```typescript
// In system/Kernel/phases/*.ts
try {
  await initializeDatabase();
} catch (error) {
  appDegrade.set('database', false, {
    source: 'services-phase',
    reason: error.message
  });
  // Continue with fallback behavior
}
```

#### UI Adaptation
```typescript
// In components/hooks
const { capabilities } = useDegradation();
const canQuery = capabilities.database.value;

if (!canQuery) {
  return <OfflineMessage />;
}
```

## Degradation Paths

### Status Legend
| Status | Meaning |
|--------|---------|
| ✅ Built | Fully implemented end-to-end |
| ⚠️ Partial | Core logic exists, missing UI/integration |
| ❌ Missing | Needs design and implementation |

### Path Index

| # | Path Name | Trigger | Severity | Status |
|---|-----------|---------|----------|--------|
| 1 | [FULL_OFFLINE](#1-full_offline) | Network completely unavailable | High | ⚠️ Partial |
| 2 | [PARTIAL_OFFLINE_DATABASE](#2-partial_offline_database) | Database down, network up | High | ⚠️ Partial |
| 3 | [PARTIAL_OFFLINE_CONNECTIVITY](#3-partial_offline_connectivity) | Network down, database cached | High | ⚠️ Partial |
| 4 | [DEGRADED_SLOW_NETWORK](#4-degraded_slow_network) | Poor connection quality | Medium | ⚠️ Partial |
| 5 | [DEGRADED_AUTH_EXPIRED](#5-degraded_auth_expired) | Session expired | High | ✅ Built |
| 6 | [DEGRADED_AUTH_MISSING](#6-degraded_auth_missing) | Auth provider unavailable | High | ⚠️ Partial |
| 7 | [DEGRADED_SYNC_PAUSED](#7-degraded_sync_paused) | Sync failures cascade | Medium | ⚠️ Partial |
| 8 | [DEGRADED_BACKGROUND_JOBS](#8-degraded_background_jobs) | Job queue init fails | Low | ⚠️ Partial |
| 9 | [PARTIAL_DEGRADED_JOBS](#9-partial_degraded_jobs) | Selective job failures | Low | ❌ Missing |
| 10 | [CRASH_JOBS_RUNTIME](#10-crash_jobs_runtime) | Critical job fails | Medium | ❌ Missing |
| 11 | [DEGRADED_NO_EFFECT_ANALYTICS](#11-degraded_no_effect_analytics) | Analytics unavailable | None | ✅ Built |
| 12 | [DEGRADED_NO_EFFECT_ERROR_TRACKING](#12-degraded_no_effect_error_tracking) | Error tracking unavailable | None | ✅ Built |
| 13 | [DEGRADED_PREMIUM_LOCKED](#13-degraded_premium_locked) | Feature flags fail | Medium | ⚠️ Partial |
| 14 | [DEGRADED_FEATURE_FLAGS_CACHED](#14-degraded_feature_flags_cached) | Remote flags unavailable | Low | ✅ Built |
| 15 | [DEGRADED_FEATURE_FLAGS_HARDCODED](#15-degraded_feature_flags_hardcoded) | Cache + remote unavailable | Medium | ✅ Built |
| 16 | [DEGRADED_REALTIME](#16-degraded_realtime) | Real-time subscriptions unavailable | Low | ❌ Missing |
| 17 | [CRASH_STORAGE_CACHE](#17-crash_storage_cache) | Cache storage unavailable | Critical | ⚠️ Partial |
| 18 | [CRASH_STORAGE_DISK](#18-crash_storage_disk) | Disk storage unavailable | Medium | ❌ Missing |
| 19 | [CRASH_CONFIG](#19-crash_config) | Config phase fails | Critical | ⚠️ Partial |
| 20 | [CRASH_PRELOAD](#20-crash_preload) | Preload phase fails | Critical | ⚠️ Partial |
| 21 | [CRASH_KERNEL_TIMEOUT](#21-crash_kernel_timeout) | Bootstrap timeout exceeded | Critical | ✅ Built |
| 22 | [CRASH_UI](#22-crash_ui) | UI component crashes | Medium | ❌ Missing |
| 23 | [SOFT_CRASH_RECOVERY](#23-soft_crash_recovery) | Data corruption detected | High | ❌ Missing |

---

## Degradation Paths (Detailed)

### 1. FULL_OFFLINE

**Trigger**: Network completely unavailable  
**Capabilities affected**: `connectivity`, `database`, `sync`  
**Severity**: High | **Status**: ⚠️ Partial

**Behavior**:
- Queue all mutations locally with encrypted persistence
- Serve reads from cache with offline indicators
- Disable network-dependent features (maps, search, uploads)
- Auto-sync on reconnection with debouncing and backoff

**Built**: Network detection, offline queue, sync manager, notification system  
**Missing**: Centralized offline mode UI, feature disabling, stale data warnings

### 2. PARTIAL_OFFLINE_DATABASE

**Trigger**: Database provider fails while network available  
**Capabilities affected**: `database`  
**Severity**: High | **Status**: ⚠️ Partial

**Behavior**:
- Queue mutations locally (same as offline)
- Show "Database unavailable" indicator (distinct from network issues)
- Continue with cached data and local-only features
- Disable fresh database reads and real-time features

**Built**: NoOp database provider, status tracking, fault reporting  
**Missing**: Runtime status subscriptions, UI indicators, graceful error handling

### 3. PARTIAL_OFFLINE_CONNECTIVITY

**Trigger**: Network down with cached database data available  
**Capabilities affected**: `connectivity`  
**Severity**: High | **Status**: ⚠️ Partial

**Behavior**:
- Same as FULL_OFFLINE but with higher cache confidence
- Serve reads from fresher QueryCache data
- Show offline banner with "cached data available" messaging
- Queue mutations for sync on reconnection

**Built**: All offline infrastructure, QueryCache, stale-while-revalidate  
**Missing**: Cache state differentiation, age indicators, persistent banners

### 4. DEGRADED_SLOW_NETWORK

**Trigger**: Poor connection quality (2G/3G, high latency)  
**Capabilities affected**: `connectivity` (partial)  
**Severity**: Medium | **Status**: ⚠️ Partial

**Behavior**:
- Reduce image quality and payload sizes
- Extend API timeouts and cache validity
- Disable heavy features (large downloads, previews)
- Show "slow connection" indicator

**Built**: Adaptive payload system, connection quality detection, timeout calculator  
**Missing**: Server-side quality support, UI indicators, automatic cache extension

### 5. DEGRADED_AUTH_EXPIRED

**Trigger**: User session expires or token becomes invalid  
**Capabilities affected**: `auth`  
**Severity**: High | **Status**: ✅ Built

**Behavior**:
- Attempt single token refresh
- Redirect to login on failure
- Allow read-only cached access during transition
- Clear sensitive session data

**Built**: Auth guard, token refresh, route protection, error handling

### 6. DEGRADED_AUTH_MISSING

**Trigger**: Auth provider unavailable during bootstrap  
**Capabilities affected**: `auth`, `database`, `sync`  
**Severity**: High | **Status**: ⚠️ Partial

**Behavior**:
- Allow anonymous usage of local-only features
- Disable authenticated features and data sync
- Show appropriate UI for anonymous state
- Graceful fallback for backend-dependent features

**Built**: Provider abstraction, anonymous mode support  
**Missing**: Complete anonymous feature set definition, UI state management

### 7. DEGRADED_SYNC_PAUSED

**Trigger**: Multiple consecutive sync failures  
**Capabilities affected**: `sync`  
**Severity**: Medium | **Status**: ⚠️ Partial

**Behavior**:
- Pause automatic sync operations
- Queue mutations locally
- Show sync status indicators
- Attempt recovery on network/auth restoration

**Built**: Cascade detection, sync status tracking  
**Missing**: Recovery automation, user-initiated sync retry

### 8. DEGRADED_BACKGROUND_JOBS

**Trigger**: Job queue initialization fails  
**Capabilities affected**: `backgroundJobs`  
**Severity**: Low | **Status**: ⚠️ Partial

**Behavior**:
- Disable automatic background operations
- Continue with user-initiated actions
- Show reduced functionality indicators
- Allow manual job triggering where possible

**Built**: Job system architecture, failure detection  
**Missing**: Graceful degradation UI, manual job interfaces

### 9. PARTIAL_DEGRADED_JOBS

**Trigger**: Selective job types fail at runtime  
**Capabilities affected**: `backgroundJobs` (partial)  
**Severity**: Low | **Status**: ❌ Missing

**Required**: Per-job-type failure handling and recovery mechanisms

### 10. CRASH_JOBS_RUNTIME

**Trigger**: Critical job fails with defensive behavior needed  
**Capabilities affected**: Core functionality  
**Severity**: Medium | **Status**: ❌ Missing

**Required**: Job failure impact assessment and defensive UI patterns

### 11. DEGRADED_NO_EFFECT_ANALYTICS

**Trigger**: Analytics exporter unavailable  
**Capabilities affected**: `analytics`  
**Severity**: None | **Status**: ✅ Built

**Behavior**: Silent failure with no user impact

### 12. DEGRADED_NO_EFFECT_ERROR_TRACKING

**Trigger**: Error tracker unavailable  
**Capabilities affected**: `errorTracking`  
**Severity**: None | **Status**: ✅ Built

**Behavior**: Silent failure with no user impact

### 13. DEGRADED_PREMIUM_LOCKED

**Trigger**: Feature flags or entitlements unverifiable  
**Capabilities affected**: `premiumFeatures`  
**Severity**: Medium | **Status**: ⚠️ Partial

**Behavior**:
- Lock premium features
- Show upgrade prompts or limited functionality
- Continue with free features
- Attempt entitlement recovery on auth restoration

**Built**: Feature flag system, entitlement checking  
**Missing**: Premium UI states, recovery flows

### 14. DEGRADED_FEATURE_FLAGS_CACHED

**Trigger**: Remote flags unavailable, cache available  
**Capabilities affected**: None (graceful)  
**Severity**: Low | **Status**: ✅ Built

**Behavior**: Serve cached flags with background refresh attempts

### 15. DEGRADED_FEATURE_FLAGS_HARDCODED

**Trigger**: Both remote and cache unavailable  
**Capabilities affected**: None (graceful)  
**Severity**: Medium | **Status**: ✅ Built

**Behavior**: Use hardcoded defaults, clear companion caches

### 16. DEGRADED_REALTIME

**Trigger**: Real-time subscriptions unavailable  
**Capabilities affected**: Real-time features  
**Severity**: Low | **Status**: ❌ Missing

**Required**: Real-time fallback patterns and offline indicators

### 17. CRASH_STORAGE_CACHE

**Trigger**: Cache storage unavailable  
**Capabilities affected**: `storage`  
**Severity**: Critical | **Status**: ⚠️ Partial

**Behavior**:
- Trigger safe mode for data protection
- Prevent data loss scenarios
- Show recovery UI
- Require app restart for storage recovery

**Built**: Storage failure detection, safe mode triggers  
**Missing**: Recovery UI, restart coordination

### 18. CRASH_STORAGE_DISK

**Trigger**: Disk storage unavailable  
**Capabilities affected**: `storage`  
**Severity**: Medium | **Status**: ❌ Missing

**Required**: Disk-specific failure handling and user communication

### 19. CRASH_CONFIG

**Trigger**: Configuration phase fails during bootstrap  
**Capabilities affected**: All systems  
**Severity**: Critical | **Status**: ⚠️ Partial

**Behavior**:
- Use fallback configuration
- Continue with reduced functionality
- Show configuration error indicators

**Built**: Config fallback system  
**Missing**: Error communication, functionality reduction UI

### 20. CRASH_PRELOAD

**Trigger**: Asset preload fails  
**Capabilities affected**: UI rendering  
**Severity**: Critical | **Status**: ⚠️ Partial

**Behavior**:
- Continue with fallback assets
- Show loading states for missing resources
- Degrade visual quality gracefully

**Built**: Asset fallback system  
**Missing**: Loading state management, quality degradation UI

### 21. CRASH_KERNEL_TIMEOUT

**Trigger**: Bootstrap exceeds global timeout  
**Capabilities affected**: All systems  
**Severity**: Critical | **Status**: ✅ Built

**Behavior**: Trigger safe mode with timeout error

### 22. CRASH_UI

**Trigger**: UI component crashes  
**Capabilities affected**: User interface  
**Severity**: Medium | **Status**: ❌ Missing

**Required**: Error boundaries and component failure recovery

### 23. SOFT_CRASH_RECOVERY

**Trigger**: Data corruption detected  
**Capabilities affected**: Data integrity  
**Severity**: High | **Status**: ❌ Missing

**Required**: Corruption detection, recovery mechanisms, and user communication

---

## Error Sources

The degradation system responds to failures across multiple system layers:

### Bootstrap Phase Failures
- **Configuration**: Missing or invalid app settings
- **Preload**: Asset loading failures (fonts, images)
- **Network**: Connectivity initialization issues
- **Storage**: SecureStorage setup failures
- **Services**: Provider initialization (database, auth, analytics)
- **Jobs**: Background job queue setup
- **Auth**: Authentication provider configuration
- **Feature Flags**: Remote flag loading failures

### Runtime System Failures
- **Connectivity**: Network status changes (online/offline)
- **Database**: Provider unavailability or connection issues
- **Auth**: Session expiration or provider failures
- **Storage**: Read/write failures or corruption
- **Sync**: Repeated synchronization failures
- **Background Jobs**: Queue failures or critical job errors
- **Analytics**: Telemetry system unavailability
- **Error Tracking**: Reporting system failures

### User-Initiated Triggers
- **Manual Recovery**: User-triggered system resets
- **Configuration Changes**: Runtime config updates
- **Consent Updates**: Privacy setting modifications
- **Feature Flag Overrides**: Administrative controls

## Implementation Patterns

### Error Reporting
```typescript
// Phase failure reporting
appDegrade.set('database', false, {
  source: 'services-phase',
  reason: 'Connection timeout'
});
```

### UI Adaptation
```typescript
// Component capability checking
const canSync = useCapability('sync');
return canSync ? <SyncButton /> : <OfflineIndicator />;
```

### Recovery Handling
```typescript
// Automatic recovery on network restoration
appDegrade.set('connectivity', true, {
  source: 'network-detection',
  reason: 'Connection restored'
});
// Queue automatically processes dependent system recovery
```

## Future Considerations

- **Recovery Automation**: Automatic retry mechanisms for transient failures
- **User Control**: Manual recovery triggers and status displays
- **Progressive Enhancement**: Feature availability based on capability combinations
- **Monitoring**: Degradation metrics and recovery success rates
