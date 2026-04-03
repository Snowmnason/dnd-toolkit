# Tier 7 Overview: Kernel & Initialization

This document provides a **high-level orientation** for Tier 7's kernel and initialization system improvements.

It is intentionally concise and primarily points to the existing issue docs for deeper, implementation-level detail.

## What Tier 7 Adds

Tier 7 transforms the app's startup from a "brittle sequential bootstrap" into a **resilient, degradation-aware initialization system**:

- **Advanced phase control**: Explicit dependency mapping, failure classification, and adaptive timeouts
- **Graceful degradation**: Capability-driven failure handling with offline-first behavior
- **Registration phase**: Centralized job and subscription activation with recovery tracking
- **Performance optimization**: Device-aware scaling and network-adaptive timeouts
- **Phase-aware providers**: Context propagation for conditional feature availability

## Mental Model

Think of Tier 7 as three interconnected systems:

1. **Phase Execution Engine** (core control)
   - Source: `system/Kernel/` (app-kernel, phase-executor, dependency-graph)
   - Purpose: Orchestrates 9 startup phases with explicit dependencies and failure handling

2. **Degradation Framework** (failure resilience)
   - Source: `lib/degradation/` (app-degrade, capability tracking)
   - Purpose: Tracks capability availability and enables graceful degradation

3. **Registration System** (activation coordination)
   - Source: `lib/jobs/`, `lib/subscriptions/` (registries, activation)
   - Purpose: Registers background jobs and event listeners with failure tracking

## Phase Control System Overview

**Core runtime entrypoints:**
- Kernel orchestrator: `system/Kernel/app-kernel.ts`
- Phase executor: `system/Kernel/adaptive-phase-executor.ts`
- Dependency graph: `system/Kernel/phase-dependency-graph.ts`

**Bootstrap flow (conceptual):**
1. Config phase loads settings and measures device performance
2. Network phase detects connectivity and speed
3. Remaining phases execute with adaptive timeouts based on device/network conditions
4. Registration phase activates jobs/subscriptions with failure tracking
5. App enters ready state with degradation awareness

**Failure handling (conceptual):**
- Unreachable failures → Skip phase, mark capability unavailable
- Timeout failures → Defer to on-demand retry, enable degraded mode
- Non-recoverable failures → Safe mode or app termination

## Degradation Framework Overview

**Core runtime entrypoints:**
- Degradation manager: `lib/degradation/app-degrade.ts`
- Capability hooks: `hooks/useCapability.ts`, `hooks/useDegradation.ts`

**Capability tracking:**
- Tracks 10 core capabilities: connectivity, database, auth, storage, sync, backgroundJobs, analytics, errorTracking, featureFlags, premiumFeatures
- Each capability has availability state and failure metadata
- UI components can conditionally render based on capability status

**Recovery flow (conceptual):**
1. Capability failure detected during phase execution
2. Degradation state updated with failure details
3. UI adapts to show degraded experience
4. Recovery subscriptions listen for restoration events
5. Failed registrations retry when conditions improve

## Registration Phase Overview

**Core runtime entrypoints:**
- Job registry: `lib/jobs/registry.ts`
- Subscription registry: `lib/subscriptions/registry.ts`
- Registration phase: `system/Kernel/phases/registration-phase.ts`

**Activation flow (conceptual):**
1. All jobs and subscriptions attempt registration
2. Failures are classified by capability and recoverability
3. Results stored for retry logic and safe mode display
4. Degradation state updated based on registration outcomes

**Deferred work:**
- Retry system for failed registrations
- Safe mode UI for displaying unavailable features
- Recovery subscription implementations

## Issues in Tier 7

### 265 - Phase-Aware Providers
**Goal:** Make React providers aware of kernel phase state for conditional rendering
**Impact:** Prevents UI crashes when features aren't ready, enables progressive enhancement

### 283 - Kernel Phase Progress
**Goal:** Add progress tracking and UI feedback during kernel initialization
**Impact:** Better user experience during startup, clear loading states

### 285 - Formalize Feature Flags
**Goal:** Complete the feature flags system integration with kernel phases
**Impact:** Proper flag loading timing, offline flag handling

### 287 - Kernel Phase Control
**Goal:** Implement advanced phase control with degradation and adaptive timeouts
**Impact:** Faster startup, resilient initialization, graceful failure handling

## Architecture Integration Points

### With Lower Tiers
- **Tier 1-2**: Uses job queues and network state from foundation layers
- **Tier 3**: Feature flags load during dedicated phase, respect degradation state
- **Tier 4-6**: Providers become phase-aware, components check capabilities

### With System Layers
- **system/Kernel/**: Core phase execution and timing logic
- **system/storage/**: Secure storage for failure state and retry data
- **system/network/**: Network detection and speed classification
- **system/API/**: Service availability checking

### With Lib Layers
- **lib/degradation/**: Capability tracking and failure reporting
- **lib/feature-flags/**: Phase-aware flag loading and caching
- **lib/jobs/**: Background job registration and lifecycle
- **lib/subscriptions/**: Event listener registration and recovery

## Key Design Decisions

### Phase Dependency Model
- Explicit dependency graph prevents circular references
- Parallel execution where possible (preload + network + storage)
- Sequential enforcement for service-dependent phases

### Failure Classification
- **Unreachable**: Skip entirely, no retry (battery/network preservation)
- **Timeout**: Defer to on-demand, enable degraded mode
- **Non-recoverable**: Critical phases only, triggers safe mode

### Adaptive Scaling
- Device slowdown factor from config phase measurement
- Network multiplier from connectivity detection
- Base timeouts loaded from config (not hardcoded)

### Capability-Driven Design
- 10 core capabilities with clear ownership
- UI reads from centralized state, not direct service checks
- Recovery events trigger automatic retry logic

## Performance Goals

**Startup SLO:** < 12 seconds end-to-end on mid-range mobile (good WiFi/4G)

**Current baseline:** ~15.6 seconds (sequential execution)
- Services phase: 20.8% (3.2s) - Supabase initialization bottleneck
- Registration phase: 20.6% (3.2s) - Job/subscription activation bottleneck

**Optimization strategies:**
- Parallel phase execution where dependencies allow
- Adaptive timeouts prevent false failures on slow devices
- Degradation enables fast startup in poor network conditions

## Testing Strategy

### Unit Testing
- Phase dependency validation
- Failure classification logic
- Adaptive timeout calculations
- Capability state transitions

### Integration Testing
- Full kernel bootstrap with various network conditions
- Degradation state persistence and recovery
- Registration failure handling and retry logic

### Performance Testing
- Startup timing across device types and network speeds
- Memory usage during bootstrap phases
- Battery impact of retry strategies

## Future Considerations

### Deferred Work (Tracked in MISSING_INTEGRATION.md)
- Retry system for failed registrations
- Safe mode UI implementation
- Recovery subscription wiring
- Advanced analytics and monitoring

### Scalability
- Phase modularization for easier testing
- Configuration-driven phase definitions
- Plugin architecture for custom phases

### Monitoring
- Comprehensive bootstrap analytics
- Failure pattern detection
- Performance regression alerts