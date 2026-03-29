# Kernel Advanced Phase Control - Missing Features

This document outlines features and improvements that were intentionally scoped out of Issue #285 (Kernel Advanced Phase Control) to keep the implementation focused and shippable. These gaps represent future enhancement opportunities that can be addressed in follow-up issues.

## Edge Function CORS Configuration

**Status:** Intentionally deferred to separate issue (#287)  
**Impact:** Non-blocking console errors during development  
**Current Behavior:** Graceful fallback to cached flags works, but CORS blocks remote sync attempts  

**What was not implemented:**
- CORS headers configuration on the `get_feature_flags` Supabase edge function
- Proper `Access-Control-Allow-Origin` headers for localhost and production domains
- Preflight request handling for OPTIONS methods

**Why deferred:**
- Requires Supabase edge function redeployment
- Separate infrastructure concern from kernel phase logic
- Current graceful fallback makes it non-critical for core functionality

**Future implementation:** See [Issue #287: Feature Flags Edge Function CORS](https://github.com/Snowmnason/dnd-toolkit/issues/287) for detailed fix options and implementation plan.

## Advanced Phase Retry Mechanisms

**Status:** Basic retry exists, advanced features deferred  
**Impact:** Limited recovery options for complex phase failures  

**What was not implemented:**
- Phase-specific retry strategies (exponential backoff per phase type)
- Conditional retry based on failure type (network vs. auth vs. storage)
- Retry limits and circuit breaker patterns per phase
- User-initiated phase recovery UI

**Why deferred:**
- Current single retry mechanism sufficient for initial implementation
- Advanced retry logic would add complexity without immediate benefit
- Can be added incrementally as failure patterns emerge

## Phase Dependency Visualization

**Status:** Deferred to future debugging tools  
**Impact:** Developers lack visual phase flow during development  

**What was not implemented:**
- Phase dependency graph visualization in dev tools
- Real-time phase progress monitoring UI
- Phase timing analytics and bottleneck detection
- Interactive phase state inspection

**Why deferred:**
- Core phase control functionality prioritized over debugging tools
- Visualization adds UI complexity not needed for production
- Can be implemented as a separate developer experience feature

## Dynamic Phase Configuration

**Status:** Static phase sequence, dynamic config deferred  
**Impact:** Phase order cannot be modified without code changes  

**What was not implemented:**
- Runtime phase ordering based on feature flags
- Conditional phase skipping based on environment or user state
- Pluggable phase system for third-party extensions
- Phase configuration via config files

**Why deferred:**
- Static sequence sufficient for current kernel requirements
- Dynamic configuration adds complexity and potential for misconfiguration
- Current architecture supports future extension if needed

## Notes

These gaps were identified during implementation and deliberately scoped out to ensure Issue #285 delivered a solid foundation for kernel phase control. Each represents a potential future enhancement that can be implemented independently without breaking the core phase system.

The CORS issue (#287) is the highest priority gap due to its impact on development experience, though it doesn't affect production functionality.