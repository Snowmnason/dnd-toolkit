# Kernel Phase Progress: Usage Guide

## Overview

The phase progress system displays real bootstrap progress (0-100%) with D&D themed messages during app initialization. Instead of a silent loading screen, users see which phase is currently running and watch progress animate from CONFIG → PRELOAD → NETWORK → STORAGE → SERVICES → JOB_SETUP → AUTH → READY.

## How It Works

### The 8 Bootstrap Phases

1. **CONFIG** (12.5%) — Load app configuration and environment variables
2. **PRELOAD** (25%) — Load critical fonts and images
3. **NETWORK** (37.5%) — Initialize network detection
4. **STORAGE** (50%) — Initialize SecureStorage and migrations
5. **SERVICES** (62.5%) — Register auth, error, and database providers
6. **JOB_SETUP** (75%) — Initialize background job queues
7. **AUTH** (87.5%) — Restore user authentication state
8. **READY** (100%) — All systems initialized; main UI renders

### Real Progress, Not Fake

The progress bar shows **actual phase progress**, not artificial 0→90% fill:

```
Progress % = (Current Phase Index / 8) × 100

Example:
- Phase 1 (CONFIG): 12.5% ✅
- Phase 3 (NETWORK): 37.5% ✅
- Phase 8 (READY): 100% ✅
```

### Phase Messages

Each phase has 5 random D&D-themed messages:

```
CONFIG:
  "Consulting the ancient tomes..."
  "Reading the sacred scrolls..."
  "Deciphering the wizard's notes..."
  "Studying the spell tome..."
  "Preparing the ritual..."

NETWORK:
  "Scanning the ethereal plane..."
  "Reaching out to the astral realm..."
  "Tuning to the cosmic frequency..."
  "Hailing the distant tower..."
  "Listening to the otherworldly whispers..."

STORAGE:
  "Securing the arcane vault..."
  "Locking the treasure chest..."
  "Warding the storage runes..."
  "Fortifying the data stronghold..."
  "Sealing the magical archives..."

AUTH:
  "Verifying the adventurer's identity..."
  "Checking the guild roster..."
  "Consulting the ancient ledger..."
  "Validating your credentials..."
  "Reviewing your adventurer's license..."

SERVICES:
  "Summoning the arcane guardians..."
  "Awakening the service spirits..."
  "Invoking the helper spirits..."
  "Calling forth the assistants..."
  "Manifesting the support runes..."

READY:
  "The ritual is complete..."
  "The spell has been cast..."
  "Your journey begins..."
  "Welcome, adventurer..."
  "All systems operational..."
```

### Min Display Time (UX, Not Performance)

Each phase is guaranteed **minimum 100ms display time** so users have time to read the message:

```
If a phase completes in 30ms:
  - Actual duration: 30ms
  - Min display: 100ms
  - Wait extra: 70ms
  - Total displayed: 100ms

If a phase takes 300ms:
  - Actual duration: 300ms
  - Min display: 100ms
  - No extra wait needed
  - Total displayed: 300ms
```

**This is UX optimization (readability), NOT performance optimization.** On fast devices, adding artificial delays is intentional to ensure messages are readable.

## Seeing Phase Progress

### On App Startup

1. App launches → LoadingBlocker appears
2. Phase 1 (CONFIG) starts → Message shows (e.g., "Consulting the ancient tomes...")
3. Progress bar animates 0% → 12.5%
4. After 100ms+ → Phase 2 (PRELOAD) starts
5. Message changes (e.g., "Sharpening the wizard's quill...")
6. Progress animates 12.5% → 25%
7. ... repeats for all 8 phases ...
8. Phase 8 (READY) completes → Progress hits 100%
9. LoadingBlocker disappears → Main UI renders

### What You'll See on Web (With Slow Network)

With DevTools throttling (Slow 3G):

```
Timeline:
  0ms    — LoadingBlocker mounts
  50ms   — CONFIG phase completes, message appears
  150ms  — PRELOAD phase completes, progress 25%
  400ms  — NETWORK phase completes, progress animates 37.5%
  500ms  — STORAGE phase completes, progress 50%
  600ms  — SERVICES phase completes, message changes
  650ms  — JOB_SETUP phase completes, progress 75%
  1000ms — AUTH phase completes, progress 87.5%
  1100ms — READY phase completes, progress 100%
  1150ms — LoadingBlocker fades out, main UI renders
```

### What You'll See on iOS/Android

Native apps typically bootstrap faster, so progress may jump multiple phases quickly:
- Phase 1-5 complete in background (fast storage, services)
- User sees messages starting at Phase 6-7 (AUTH phase)
- Total bootstrap: 600-800ms

## Understanding the Progress Bar

### Component

The `ProgressBar` component renders a themed progress bar:

```typescript
import { ProgressBar } from '@/components/ui';

<ProgressBar 
  initialProgress={progressPercent}    // 0-100
  label={phaseLabel}                   // "Phase 1/8"
  animated                             // Smooth animation
/>
```

### Styling

- **Fill color**: Theme accent color (changes with theme)
- **Track color**: Theme border subtle color
- **Height**: Responsive (S.space.sm default)
- **Animation**: Spring-based smooth transitions

### Example: Custom Progress Display

```typescript
import { ProgressBar } from '@/components/ui';
import { usePhaseProgress } from '@/hooks/kernel';

function BootstrapProgress() {
  const { progressPercent, phaseLabel, currentPhaseName } = usePhaseProgress();

  return (
    <View>
      <Title>D&D Toolkit</Title>
      <Subtitle>Initializing App</Subtitle>
      
      {/* Progress bar automatically animates */}
      <ProgressBar 
        initialProgress={progressPercent}
        label={phaseLabel}  // "Phase 4/8"
        animated
      />
      
      {/* Phase message shown below */}
      <Caption>{phaseMessage}</Caption>
    </View>
  );
}
```

## Min Display Time Configuration

### Where to Find It

`system/kernel/app-kernel.ts`:

```typescript
const PHASE_MIN_DISPLAY_MS = {
  configReady: 100,      // Phase 1
  preloadReady: 100,     // Phase 2
  networkReady: 100,     // Phase 3
  storageReady: 100,     // Phase 4
  servicesReady: 100,    // Phase 5
  jobSetupReady: 100,    // Phase 6
  authReady: 100,        // Phase 7
  syncReady: 100,        // Phase 8
} as const;
```

### Adjusting for Your App

If 100ms feels too long (users complain about slow loading):

```typescript
// Reduce to 50ms for snappier feel
const PHASE_MIN_DISPLAY_MS = {
  configReady: 50,
  preloadReady: 50,
  networkReady: 50,
  storageReady: 50,
  // ... etc
};
```

If messages are flickering (too fast to read):

```typescript
// Increase to 200ms for slow networks
const PHASE_MIN_DISPLAY_MS = {
  configReady: 200,
  preloadReady: 200,
  networkReady: 200,
  storageReady: 200,
  // ... etc
};
```

### Per-Phase Tuning (Advanced)

Some phases may need different times:

```typescript
const PHASE_MIN_DISPLAY_MS = {
  configReady: 100,      // Quick message
  preloadReady: 150,     // Font loading, needs longer
  networkReady: 100,
  storageReady: 150,     // Multiple file reads, needs longer
  servicesReady: 100,
  jobSetupReady: 100,
  authReady: 200,        // Auth messages are important
  syncReady: 100,
};
```

## Performance Notes

### Bootstrap Timeline Impact

**Without min display time:**
- All phases complete in: ~500-600ms total
- Some messages flash (10-30ms) and disappear

**With min display time (100ms per phase):**
- Added delay: Up to 800ms (8 phases × 100ms)
- But on slow networks: Actual duration often > 100ms anyway
- Net impact: Typically +100-200ms on slow devices, +0 on fast devices

### What Affects Phase Duration

1. **Network** — Phase takes longer on slow connections (you see the message!)
2. **Device** — Faster devices finish phases quickly (100ms enforced min helps)
3. **Cold start** — First app launch takes longer (typical: 1-1.5s total)
4. **Warm start** — Subsequent launches faster (typical: 600-800ms total)

## Troubleshooting

### Message Not Showing

1. Check that `useKernelLoadingSync()` is mounted early in `app/_layout.tsx`
2. Verify `LoadingBlocker` is rendering (check DevTools)
3. Test with network throttling (DevTools Slow 3G)
4. Check browser console for errors

### Progress Bar Not Animating

1. Verify `usePhaseProgress()` hook is providing correct values
2. Check that `animated={true}` prop is set on ProgressBar
3. Verify theme colors are loading (check theme tokens)

### Progress Stuck at 0%

1. Check that kernel phases are actually progressing
2. Add console logging: `console.log(kernel.phases)`
3. Verify `usePhaseProgress()` is calculating correctly

### Message Changes Too Fast

1. Increase `PHASE_MIN_DISPLAY_MS` values
2. Test on slow network (DevTools throttle)
3. Messages display normally on slow networks

## Tips for Users

### Best UX

- **First app launch**: 1-1.5 seconds (pre-fills caches)
- **Subsequent launches**: 600-800ms
- **With slow network (3G)**: 1-2+ seconds

### What to Avoid

- Don't set min display time to 0 (messages flash)
- Don't make min display time > 300ms per phase (feels slow even on real delays)
- Don't skip the LoadingBlocker (users think app is frozen)

## Future Enhancements (Not This Issue)

### Issue #39 — Phase Duration Tuning
- Collect metrics for each phase on different devices
- Optimize min display times per device
- Allow user-configurable bootstrap speed

### Issue #40 — Visual Theming
- Load theme preference earlier in bootstrap
- Enable Cyberpunk message variants
- Add colors, animations, gradients to loading screen

### Issue #47 — Message Localization
- Translate messages to other languages
- Support i18n key system
- Regional customization

## Related Documentation

- [ProgressBar Component](../../../../components/ui/README.md#progressbar) — Component API and examples
- [Localization Module](../../../../lib/localization/README.md) — How messages are managed
- [Kernel Bootstrap](../../../../lib/kernel/README.md) — Phase system overview
- [Phase-Aware Provider Pattern](../265%20-%20Phase-Aware%20Providers/README.md) — How to wait for phases in your own providers