# Kernel Advanced Phase Control - Usage Guide

Provides advanced monitoring, control, and recovery capabilities for the application kernel initialization phases. Enables real-time tracking of startup progress, phase-specific error handling, and initialization recovery mechanisms.

## Overview

**Use this for:**
- Monitoring kernel phase progress during app startup
- Debugging initialization failures and phase-specific issues
- Implementing custom loading UI based on phase state
- Handling recoverable kernel errors with targeted recovery

**Do NOT use for:**
- Normal application flow (use standard kernel hooks instead)
- Business logic that depends on phase completion (use phase-aware providers)
- Replacing the core kernel initialization system

## How It Works

### Phase Lifecycle

The kernel executes 8 sequential phases with advanced control capabilities:

```
CONFIG → PRELOAD → NETWORK → STORAGE → SERVICES → JOB_SETUP → AUTH → FEATURE_FLAGS → READY
```

Each phase has:
- **Progress tracking**: Real-time state updates
- **Error handling**: Phase-specific failure recovery
- **Timeout management**: Configurable timeouts with graceful degradation
- **Recovery options**: Targeted rerun capabilities

### Control Architecture

```
Kernel Manager (lib/kernel/kernel-manager.ts)
    ↓
Phase Control (lib/kernel/advanced-phase-control.ts)
    ↓
System Phases (system/Kernel/phases/*.ts)
    ↓
React Hooks (hooks/kernel/usePhaseProgress.ts)
```

## Basic Usage

### Monitoring Phase Progress

```typescript
import { usePhaseProgress } from '@/hooks/kernel/usePhaseProgress';

function AppLoader() {
  const { currentPhase, progress, phases, timing } = usePhaseProgress();

  return (
    <div>
      <p>Current phase: {currentPhase}</p>
      <p>Progress: {progress}%</p>
      <p>Time elapsed: {timing.total}ms</p>
    </div>
  );
}
```

### Handling Kernel Errors

```typescript
import { AppKernel } from '@/lib/kernel/kernel-manager';

function ErrorHandler({ kernel }) {
  if (kernel.error?.recoverable) {
    return (
      <button onClick={() => AppKernel.retry()}>
        Retry Initialization
      </button>
    );
  }

  return <div>Critical error: {kernel.error.message}</div>;
}
```

### Phase-Specific Recovery

```typescript
import { AppKernel } from '@/lib/kernel/kernel-manager';

// Rerun a specific failed phase
await AppKernel.rerunPhase('network');

// Check if a phase can be rerun
const canRerun = AppKernel.canRerunPhase('storage');
```

## Phase Progress Hook

### `usePhaseProgress(): PhaseProgressState`

Returns real-time kernel initialization progress.

```typescript
interface PhaseProgressState {
  currentPhase: KernelPhase;
  progress: number; // 0-100
  phases: Record<KernelPhase, boolean>; // readiness flags
  timing: Record<KernelPhase, number>; // phase durations in ms
  error?: KernelError;
}
```

**Example:**
```typescript
const { currentPhase, progress } = usePhaseProgress();

if (progress < 100) {
  return <LoadingSpinner phase={currentPhase} />;
}
```

## Kernel Manager API

### `AppKernel.getState(): AppKernelState`

Returns complete kernel state snapshot.

```typescript
const state = AppKernel.getState();
console.log(state.currentPhase); // "AUTH"
console.log(state.phases.appReady); // false
console.log(state.capabilities.network); // true
```

### `AppKernel.retry(): Promise<void>`

Retries kernel initialization after a recoverable error.

```typescript
if (kernel.error?.recoverable) {
  await AppKernel.retry();
}
```

### `AppKernel.rerunPhase(phase: KernelPhase): Promise<void>`

Reruns a specific phase (useful for recovery).

```typescript
await AppKernel.rerunPhase('network');
```

### `AppKernel.canRerunPhase(phase: KernelPhase): boolean`

Checks if a phase can be safely rerun.

```typescript
if (AppKernel.canRerunPhase('storage')) {
  await AppKernel.rerunPhase('storage');
}
```

## Configuration

Configure advanced phase control in `config/appsettings.json`:

```json
{
  "kernel": {
    "phaseTimeoutMs": 10000,
    "maxRetries": 3,
    "enableProgressTracking": true,
    "enablePhaseRecovery": true
  }
}
```

## Troubleshooting

### Phase Stuck in Loading
- Check network connectivity for network/storage phases
- Verify Supabase configuration for auth/feature_flags phases
- Use `AppKernel.rerunPhase()` to retry stuck phases

### Recovery Not Working
- Ensure the error is marked as `recoverable`
- Check phase dependencies (can't rerun auth before network)
- Verify configuration settings

### Performance Issues
- Phase timing is tracked automatically
- Use `timing` from `usePhaseProgress()` to identify slow phases
- Consider increasing `phaseTimeoutMs` for slow networks

## Integration Examples

### Custom Loading Screen

```typescript
import { usePhaseProgress } from '@/hooks/kernel/usePhaseProgress';

function CustomLoader() {
  const { currentPhase, progress, timing } = usePhaseProgress();

  const phaseMessages = {
    config: "Loading configuration...",
    network: "Connecting to services...",
    auth: "Authenticating...",
    feature_flags: "Loading features...",
  };

  return (
    <div className="loader">
      <div className="progress-bar" style={{ width: `${progress}%` }} />
      <p>{phaseMessages[currentPhase] || "Initializing..."}</p>
      <small>{timing.total}ms elapsed</small>
    </div>
  );
}
```

### Error Boundary with Recovery

```typescript
import { AppKernel } from '@/lib/kernel/kernel-manager';

class KernelErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  handleRetry = async () => {
    try {
      await AppKernel.retry();
      this.setState({ hasError: false });
    } catch (error) {
      console.error('Retry failed:', error);
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div>
          <p>Initialization failed</p>
          <button onClick={this.handleRetry}>Retry</button>
        </div>
      );
    }

    return this.props.children;
  }
}
```