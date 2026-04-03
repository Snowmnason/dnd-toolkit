# Implementation Guide: Registration Phase Bootstrap

## Overview

The registration phase is the final bootstrap phase that registers all jobs and subscriptions with their respective systems. This phase runs after all core phases (config, network, preload, storage, services, auth, jobSetup, featureFlags) have completed, ensuring the app has a stable foundation before activating background processes and event listeners.

**Key Principles:**
- Always attempt to register all items (no skipping based on degradation)
- Track failures by required capability for future retry logic
- Never crash the app - collect failures in result object
- Silent during bootstrap (logging only, no UI interruptions)
- Enable graceful degradation through capability-driven failure tracking

## Architecture

### Phase Dependencies
```
registration
├── Depends on: services, jobSetup, auth, featureFlags
├── Runs after: All core bootstrap phases complete
└── Before: ready phase (app startup)
```

### Registration Items

**Jobs (Background Processing):**
- `sync-orchestrator` - Handles periodic data synchronization
- `network-recovery-retry` - Retries failed operations when network recovers
- `storage-health-check` - Validates storage integrity
- `feature-flags-refresh` - Updates feature flag snapshots

**Subscriptions (Event Listeners):**
- `network-recovery-subscription` - Listens for network recovery events
- `sync-recovery-subscription` - Listens for sync completion events
- `job-recovery-subscription` - Listens for job retry success events
- `service-health-subscription` - Monitors service health (placeholder)

## Implementation

### Core Logic

```typescript
async function registrationPhase(): Promise<RegistrationResult> {
  const degradation = appDegrade.getState();
  const result: RegistrationResult = {
    success: true,
    registered: [],
    failed: [],
    failuresSummary: '',
    durationMs: 0
  };

  const startTime = Date.now();

  try {
    // Always attempt to register all jobs and subscriptions
    const allItems = [
      ...Object.values(jobRegistry),
      ...Object.values(subscriptionRegistry)
    ];

    for (const item of allItems) {
      try {
        await item.register();
        result.registered.push({
          name: item.name,
          type: item.type,
          requiredCapability: item.requiredCapability
        });
      } catch (error) {
        const failure: RegistrationFailure = {
          name: item.name,
          type: item.type,
          error: error instanceof Error ? error.message : String(error),
          requiredCapability: item.requiredCapability,
          recoverable: isRecoverableError(error, item.requiredCapability)
        };
        result.failed.push(failure);

        // Log but don't throw - continue with other registrations
        logger.category('kernel').error(
          `Registration failed for ${item.name}`,
          { error: failure.error, capability: failure.requiredCapability }
        );
      }
    }

    // Build human-readable summary for safe mode display
    result.failuresSummary = buildFailuresSummary(result.failed);

  } catch (criticalError) {
    // This should never happen - individual failures should be caught above
    result.success = false;
    logger.category('kernel').error('Critical registration phase error', { error: criticalError });
  }

  result.durationMs = Date.now() - startTime;
  return result;
}
```

### Error Classification

```typescript
function isRecoverableError(error: unknown, capability: DegradeCapability): boolean {
  // Network-related failures are recoverable
  if (capability === 'connectivity') {
    return true;
  }

  // Service failures may be recoverable depending on error type
  if (capability === 'database' || capability === 'auth' || capability === 'storage') {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // Check for specific non-recoverable error patterns
    return !errorMessage.includes('corruption') && !errorMessage.includes('invalid');
  }

  // Sync and background jobs are generally recoverable
  if (capability === 'sync' || capability === 'backgroundJobs') {
    return true;
  }

  // Feature flags and analytics failures are recoverable
  return capability === 'featureFlags' || capability === 'analytics' || capability === 'errorTracking';
}
```

### Failure Summary Builder

```typescript
function buildFailuresSummary(failed: RegistrationFailure[]): string {
  if (failed.length === 0) return '';

  const grouped = new Map<string, string[]>();

  // Group failures by capability
  for (const failure of failed) {
    const cap = failure.requiredCapability;
    if (!grouped.has(cap)) {
      grouped.set(cap, []);
    }
    grouped.get(cap)!.push(humanReadableName(failure.name));
  }

  // Build summary strings
  const summaries: string[] = [];
  for (const [capability, names] of grouped) {
    const capName = humanReadableCapability(capability);
    const items = names.join(', ');
    summaries.push(`${capName}: ${items}`);
  }

  return summaries.join('; ');
}

function humanReadableName(itemName: string): string {
  const map: Record<string, string> = {
    'sync-orchestrator': 'Auto-save',
    'network-recovery-retry': 'Network Retry',
    'storage-health-check': 'Storage Health',
    'feature-flags-refresh': 'Feature Updates',
    'network-recovery-subscription': 'Network Recovery',
    'sync-recovery-subscription': 'Sync Recovery',
    'job-recovery-subscription': 'Job Recovery',
    'service-health-subscription': 'Service Health'
  };
  return map[itemName] || itemName;
}

function humanReadableCapability(capability: DegradeCapability): string {
  const map: Record<DegradeCapability, string> = {
    connectivity: 'Network',
    database: 'Database',
    auth: 'Authentication',
    storage: 'Storage',
    sync: 'Sync',
    backgroundJobs: 'Background Tasks',
    analytics: 'Analytics',
    errorTracking: 'Error Tracking',
    featureFlags: 'Features',
    premiumFeatures: 'Premium Features'
  };
  return map[capability] || capability;
}
```

## Integration Points

### App Kernel Integration

```typescript
// In system/Kernel/app-kernel.ts
async function executeRegistrationPhase(): Promise<PhaseResult> {
  const result = await registrationPhase();

  // Store failures for retry logic (future implementation)
  if (result.failed.length > 0) {
    await SecureStorage.set(
      STORAGE_KEYS.registrationFailures,
      result.failed.filter(f => f.recoverable)
    );
  }

  // Update degradation state based on failures
  for (const failure of result.failed) {
    appDegrade.reportFailure(failure.requiredCapability, {
      source: 'registration',
      error: failure.error,
      recoverable: failure.recoverable
    });
  }

  return {
    phase: 'registration',
    success: result.success,
    durationMs: result.durationMs,
    failures: result.failed.length,
    metadata: {
      registeredCount: result.registered.length,
      failedCount: result.failed.length,
      failuresSummary: result.failuresSummary
    }
  };
}
```

### Registry Interfaces

```typescript
// lib/jobs/registry.ts
interface JobRegistration {
  name: string;
  type: 'job';
  requiredCapability: DegradeCapability;
  register(): Promise<void>;
}

// lib/subscriptions/registry.ts
interface SubscriptionRegistration {
  name: string;
  type: 'subscription';
  requiredCapability: DegradeCapability;
  register(): Promise<void>;
}
```

## Testing Strategy

### Unit Tests
- Test individual job/subscription registration
- Test error classification logic
- Test failure summary building
- Mock degradation state

### Integration Tests
- Test full registration phase execution
- Test with various degradation states
- Verify storage of retryable failures
- Test app kernel integration

### Manual Testing
- Test with network disabled
- Test with services unavailable
- Verify safe mode displays correct failure summaries
- Test recovery scenarios

## Acceptance Criteria

- ✅ Registration phase checks degradation state at start
- ✅ All jobs and subscriptions attempt to register (no skipping)
- ✅ Failures are caught and tracked with: name, error, requiredCapability, recoverable flag
- ✅ No throwing/crashing — result object captures everything
- ✅ Recovery listeners log critical errors but don't crash if they fail
- ✅ Result includes `failuresSummary` for safe mode screen display
- ✅ Silent during bootstrap (no toasts/modals, just logging)
- ✅ TypeScript strict mode
- ✅ Link to MISSING_INTEGRATION.md for deferred items

## Future Enhancements

See `MISSING_INTEGRATION.md` for deferred work including:
- Retry logic system for failed registrations
- Safe mode screen integration
- Recovery subscription implementations
- Enhanced error classification