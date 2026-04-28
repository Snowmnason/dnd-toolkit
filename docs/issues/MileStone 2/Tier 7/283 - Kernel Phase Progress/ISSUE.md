# Issue #283: Kernel Phase Progress & App-Themed Messages

## Status
**Proposed** (Tier 7: Kernel & Initialization)

## Impact
**MEDIUM** — Provides visible phase progress to user during bootstrap; improves perceived performance on slow devices; establishes pattern for theme-aware messaging; prepares for i18n foundation.

## Depends on
- **#265** (Kernel Phase-Aware Provider Pattern) — LoadingContext + LoadingBlocker infrastructure

## Integrates with
- #37 (Phase-aware providers) — Uses phase timing data
- #40 (Kernel Advanced Messages & Theming) — Future: Theme-specific message variants
- #47 (Internationalization) — Future: Message key translation

---

## Problem Statement

**Current Issue:** During app bootstrap, users see a blank or generic splash screen with no indication of progress. On slow devices or networks:
- Bootstrap may take 2-5 seconds
- User sees no feedback → feels hung/broken
- No message explaining what's happening
- Same generic splash across all platforms/themes

**Root Cause:** Kernel phases complete; UI blocks correctly (from #265). But:
- ✅ Phases tracked internally
- ❌ No visible progress to user
- ❌ No phase-specific messages
- ❌ No messaging system (messages are inline strings scattered in code)

**Better Approach:** Display real-time phase progress + D&D themed messages, with messages sourced from centralized localization system for reusability across apps.

---

## Codebase Status

### Currently Implemented
- ✅ LoadingContext + LoadingBlocker (from #265) — Renders blocker UI when open
- ✅ LoadingContext.setLoading() accepts `{ message, decorativeElement }` (from #265)
- ✅ SplashScreen component accepts optional props (from #265)
- ✅ AppKernelProvider + 8 kernel phases (CONFIG, PRELOAD, NETWORK, STORAGE, SERVICES, JOB_SETUP, AUTH, READY)
- ✅ Phase timing data available internally (`kernel.phases.*`)
- ✅ Phases executed sequentially; each has predictable duration (50-2000ms)

### Gap Analysis
- ⚠️ **No progress bar component** — Need to create real progress bar UI
- ⚠️ **No phase progress tracking** — Kernel tracks phases internally; no exposed progress percentage
- ⚠️ **No message system** — Messages would be hardcoded inline (violates #266 pattern)
- ⚠️ **No min display time** — Messages disappear instantly on fast phases; feels jarring
- ⚠️ **No themed messages** — Every app gets same generic messages; no brand personality
- ⚠️ **No current phase indicator** — User doesn't know which phase is executing

---

## Solution

Create a **phase progress system with themed, localized messages** that:

1. **Tracks real progress** — % complete based on phase sequence (not fake progress)
2. **Shows phase messages** — D&D themed message pool per phase; random selection
3. **Respects readability** — Min display time (100ms) ensures message visibility
4. **Centralizes messages** — Messages sourced from `lib/localization/phase-messages.ts` (app-specific)
5. **Future-proof** — Designed for easy Cyberpunk/other theme additions in Issue #40
6. **Defers theming complexity** — Only D&D messages for this issue; visual theming deferred

**Key Trade-offs:**
- Only D&D themed messages (deferred: Cyberpunk, generic fallback) — Keeps scope tight; app-agnostic kernel has no theme access
- Real progress (not fake) — Requires minimal kernel tracking; no animated fake fills
- Min display time is UX only (not performance) — 100ms ensures readability; independent of actual phase duration
- Configurable per-phase (future-proofing) — Simple inline numbers; enables Issue #39 tuning without refactor

---

## Implementation Tracks

### Track A: Create ProgressBar Component

**Goal:** Build a reusable progress bar component that displays real progress (0-100%) with optional label. This component will be used by InitializationSplashScreen to show phase progress.

**Scope:**
- [ ] Create `components/ui/ProgressBar.tsx`:
  ```tsx
  interface ProgressBarProps {
    progress: number; // 0-100
    label?: string;   // Optional: "2/8" or "Initializing..."
    animated?: boolean; // Smooth animate between values
    height?: number; // Default: 4
    highlightColor?: string; // Default: theme.accent
    trackColor?: string; // Default: theme.border
  }

  export function ProgressBar({
    progress,
    label,
    animated = true,
    height = 4,
    highlightColor,
    trackColor,
  }: ProgressBarProps) {
    // Real progress animation; smoothly update width
    // Label rendered above bar (if provided)
    // Smooth transition from 0 to 100%
  }
  ```
- [ ] Export from `components/ui/index.ts`
- [ ] Add theme token integration (`UseTheme()` for colors)
- [ ] Support web + iOS + Android platforms
- [ ] No animation library needed — use CSS/RN animated value
- [ ] add to StyleDesktop for tracking

**Files Changed:**
- `components/ui/ProgressBar.tsx` (new)
- `components/ui/index.ts` (add export)
- `app\settings\StyleDesktop.tsx`

✅ Exit: ProgressBar component renders real progress (0-100), smooth animations, optional labels. `npm run lint` passes. TypeScript clean.

---

### Track B: Add Phase Progress State to Kernel

**Goal:** Extend kernel state to track current phase and progress percentage. Kernel updates progress as phases complete; UI consumes via hook.

**Scope:**
- [ ] Update `type-definitions/kernel-types.ts`:
  - Add to `AppKernelState`:
    ```tsx
    phaseProgress: {
      currentPhaseIndex: number;        // 0-7 (8 phases total)
      currentPhaseName: keyof AppKernelState['phases'];
      progressPercent: number;          // 0-100
      phaseLabel: string;               // "2/8 Initializing network..."
    };
    ```
- [ ] Update `system/Kernel/app-kernel.ts`:
  - Before each phase starts: Calculate phase index and set `currentPhaseIndex`
  - While phase runs: Keep `progressPercent` at phase start % (e.g., CONFIG=0%, PRELOAD=12.5%, etc.)
  - When phase completes: Increment `currentPhaseIndex`; update `progressPercent`
  - Phase % calculation: `(phaseIndex / 8) * 100` rounded to nearest whole number
    ```tsx
    // Phase mapping
    const phaseSequence = [
      'configReady',     // 0
      'preloadReady',    // 1
      'networkReady',    // 2
      'storageReady',    // 3
      'servicesReady',   // 4
      'jobSetupReady',   // 5
      'authReady',       // 6
      'syncReady',       // 7
    ];

    // On phase completion:
    const phaseIndex = phaseSequence.indexOf(completedPhase);
    const progressPercent = Math.round((phaseIndex / 8) * 100);
    ```
- [ ] Create hook `usePhaseProgress()`:
  ```tsx
  export function usePhaseProgress() {
    const kernel = useAppKernel();
    return kernel.phaseProgress; // Returns { currentPhaseIndex, currentPhaseName, progressPercent, phaseLabel }
  }
  ```
- [ ] Update `hooks/kernel/index.ts` to export `usePhaseProgress`

**Files Changed:**
- `type-definitions/kernel-types.ts`
- `system/Kernel/app-kernel.ts`
- `hooks/kernel/use-app-kernel.tsx` (add usePhaseProgress hook)
- `hooks/kernel/index.ts` (add export)

✅ Exit: Kernel tracks phase progress (0-100%) in real-time. Hook exports progress data. TypeScript types updated. `npm run lint` passes.

---

### Track C: Create Phase Messages System (D&D Theme)

**Goal:** Extract phase messages from app-kernel into a separate file so they're not inline. Messages are simple strings, randomly selected per phase.

**Scope:**
- [ ] Create `lib/localization/phase-messages.ts`:
  ```tsx
  /**
   * Phase-specific messages for kernel bootstrap.
   * 
   * Simple string arrays (one per phase, 5 messages each).
   * App-kernel imports and randomly selects from these.
   * 
   * Purpose: Remove inline strings from app-kernel code.
   * Future: Can be extended with keys/localization in Issue #47.
   */

  export const PHASE_MESSAGES = {
    config: [
      "Preparing the campaign...",
      "Shuffling the deck...",
      "Consulting the spell book...",
      "Marking the map...",
      "Rolling for initiative..."
    ],
    preload: [
      "Loading character sheets...",
      "Gathering miniatures...",
      "Inscribing runes...",
      "Infusing with magic...",
      "Binding artifacts..."
    ],
    network: [
      "Connecting to the scrying crystal...",
      "Opening the arcane portal...",
      "Sending messenger ravens...",
      "Establishing the ritual circle...",
      "Tuning the sending stone..."
    ],
    storage: [
      "Organizing the bag of holding...",
      "Cataloging the treasury...",
      "Arranging the library...",
      "Tallying the loot...",
      "Restocking the provisions..."
    ],
    services: [
      "Awakening the spirits...",
      "Summoning the servants...",
      "Preparing the shrine...",
      "Lighting the eternal flame...",
      "Invoking the ancient ones..."
    ],
    jobSetup: [
      "Setting tasks for the day...",
      "Drafting the scroll of duties...",
      "Assigning the quest log...",
      "Organizing the workbench...",
      "Scheduling the routines..."
    ],
    auth: [
      "Verifying your bloodline...",
      "Consulting the oracle...",
      "Checking the sacred tome...",
      "Validating the sigil...",
      "Confirming your identity with the council..."
    ],
    sync: [
      "Synchronizing the tapestry...",
      "Aligning the constellations...",
      "Harmonizing the threads...",
      "Settling into the realm...",
      "The adventure awaits..."
    ],
  } as const;

  /**
   * Get random message for a phase.
   * 
   * @param phaseName - Phase key (e.g., 'config', 'network', 'auth')
   * @returns Random message string from that phase
   */
  export function getPhaseMessage(
    phaseName: keyof typeof PHASE_MESSAGES,
  ): string {
    const messages = PHASE_MESSAGES[phaseName];
    const randomIndex = Math.floor(Math.random() * messages.length);
    return messages[randomIndex];
  }
  ```

**Files Changed:**
- `lib/localization/phase-messages.ts` (new)

✅ Exit: Phase messages extracted from kernel into separate file. Simple strings, no keys, no config. Helper function to randomly select. `npm run lint` passes.

---

### Track D: Add Min Display Time Logic

**Goal:** Enforce minimum display time (100ms default) so messages are readable even on fast phases. Configure per-phase to support future tuning.

**Scope:**
- [ ] Update `system/Kernel/app-kernel.ts`:
  ```tsx
  // Per-phase min display time (milliseconds)
  const PHASE_MIN_DISPLAY_MS = {
    configReady: 100,      // Default; can be adjusted per app
    preloadReady: 100,
    networkReady: 100,
    storageReady: 100,
    servicesReady: 100,
    jobSetupReady: 100,
    authReady: 100,
    syncReady: 100,
  } as const;

  // On phase completion:
  async function completePhase(phaseName: PhaseKey) {
    const phaseStartTime = performance.now();
    
    // ... phase logic ...
    
    const phaseActualDuration = performance.now() - phaseStartTime;
    const minDisplay = PHASE_MIN_DISPLAY_MS[phaseName];
    const enforceDelay = Math.max(0, minDisplay - phaseActualDuration);
    
    if (enforceDelay > 0) {
      await delay(enforceDelay); // Pauses before moving to next phase
    }
    
    // Mark phase ready + update progress
    setState((prev) => ({
      ...prev,
      phases: { ...prev.phases, [phaseName]: true },
      phaseProgress: { /* update */ },
    }));
  }
  ```
- [ ] Rationale comment:
  ```tsx
  /**
   * Min display time (100ms default per phase)
   * 
   * Purpose: UX readability only — ensures user has time to read message
   * even if phase completes in 10-50ms.
   * 
   * This is NOT performance optimization; adds small artificial delay
   * on fast devices. Improves perceived performance on slow devices.
   * 
   * Configurable: Each phase can override if needed (Issue #39).
   * Example: Config phase takes 30ms; wait 70ms extra = 100ms total.
   *          Network phase takes 50ms; wait 50ms extra = 100ms total.
   *          Storage phase takes 300ms; no wait = 300ms total.
   */
  ```

**Files Changed:**
- `system/Kernel/app-kernel.ts`

✅ Exit: Each phase enforces min 100ms display time. Delay calculated per-phase. Configurable; ready for Issue #39. `npm run lint` passes.

---

### Track E: Wire Phase Progress to UIBlockerLayer via Existing Sync Hook

**Goal:** Extend the existing `useKernelLoadingSync()` hook (from #265) to include phase progress and messages. The hook already controls UIBlocker state; just add phase data.

**Assessment of Existing Architecture:**

✅ **UIBlockerLayer** (`components/UIBlockerLayer.tsx`):
- Already accepts `progress?: number` (0-100) in state
- Already accepts `message?: string` in state
- Already passes both to SplashScreen component
- No changes needed

✅ **SplashScreen** (`components/SplashScreen/SplashScreen.tsx`):
- Already renders `progress` as a progress bar (theme-colored)
- Already renders `message` as footer text (italicized, secondary color)
- No changes needed

✅ **useKernelLoadingSync()** (`hooks/kernel/use-kernel-loading-sync.tsx`):
- Already syncs kernel state to UIBlocker
- Already calls `setLoading()` when kernel phases change
- Just needs to include phase name → message mapping + progress percentage

**What's Required:**

Extend existing `useKernelLoadingSync()` hook to map phase data:

```tsx
// In hooks/kernel/use-kernel-loading-sync.tsx (update existing):
import { useUIBlocker } from '@/components/UIBlockerContext';
import { useAppKernel } from '@/hooks/kernel/use-app-kernel';
import { usePhaseProgress } from '@/hooks/kernel';
import { getPhaseMessage } from '@/lib/localization/phase-messages';

export function useKernelLoadingSync() {
  const { setLoading } = useUIBlocker();
  const kernel = useAppKernel();
  const { progressPercent, currentPhaseName } = usePhaseProgress();

  useEffect(() => {
    if (kernel.phases.appReady) {
      // Kernel bootstrap complete, hide splash
      setLoading(false);
      return;
    }

    if (!kernel.phases.configReady) {
      // Kernel not started yet, skip
      return;
    }

    // Kernel is initializing: sync phase progress + message
    const message = getPhaseMessage(currentPhaseName as any);
    setLoading({
      message,
      progress: progressPercent,
      showProgress: true,
    });
  }, [kernel.phases.appReady, kernel.phases.configReady, progressPercent, currentPhaseName, setLoading]);
}
```

**Scope:**
- [ ] Update `hooks/kernel/use-kernel-loading-sync.tsx` to include phase progress data
- [ ] Hook reads `usePhaseProgress()` data (from Track B)
- [ ] Hook maps phase name to message via `getPhaseMessage()` (from Track C)
- [ ] Hook calls `setLoading()` with `message + progress + showProgress`
- [ ] No component or manager changes needed

**Files Changed:**
- `hooks/kernel/use-kernel-loading-sync.tsx` (update to include phase data)

✅ Exit: Existing kernel sync hook extended to show phase progress + messages. Zero new files. `npm run lint` passes.

---

### Track F: Testing & Metrics (Determine What Actually Displays)

**Goal:** Verify which phases show the LoadingBlocker and establish metrics baseline. Inform future tuning (Issue #39).

**Scope:**
- [ ] **Step-through testing** (if possible on device):
  - Start app on web; open DevTools → Network tab (slow 3G throttle)
  - Monitor when LoadingBlocker first appears
  - Record which phase message shows first (likely NETWORK or STORAGE based on #265)
  - Document actual phase durations
  - Verify min display time works (no message flashing)
- [ ] **Console logging** (temporary):
  - Log phase start/end + duration in `system/Kernel/app-kernel.ts`:
    ```tsx
    console.log(`[Bootstrap] ${phaseName} started`);
    console.log(`[Bootstrap] ${phaseName} completed (${duration}ms, forced to ${minDisplay}ms)`);
    console.log(`[Bootstrap] Progress: ${progressPercent}%`);
    ```
  - Remove "noisy" logs after testing (reduce console spam)
  - Verify LoadingBlocker visibility timing
- [ ] **Document findings**:
  - [ ] Which phases show messages (e.g., "Network → Storage → Auth")
  - [ ] Actual phase durations on web/iOS/Android
  - [ ] Whether 100ms min is appropriate (or needs tuning)
  - [ ] Whether progress animation is smooth
  - [ ] Any UX issues found
  - [ ] Create doc: `docs/issues/MileStone 2/Tier 7/38 - Phase Progress Metrics/TESTING_RESULTS.md`
- [ ] **Acceptance criteria**:
  - [ ] At least one phase shows message (likely NETWORK or later)
  - [ ] Progress bar animates smoothly from 0-100%
  - [ ] No message flickering (min display time working)
  - [ ] Phase labels update correctly (2/8 → 3/8 → etc.)
  - [ ] All platforms (web, iOS, Android): verified loading
  - [ ] No console errors during bootstrap
  - [ ] `npm run lint` passes; TypeScript clean

**Files Changed:**
- `system/Kernel/app-kernel.ts` (add temporary logging)
- `docs/issues/MileStone 2/Tier 7/38 - Phase Progress Metrics/TESTING_RESULTS.md` (new)

✅ Exit: Testing complete; metrics documented. Know which phases display messages. Baseline recorded for Issue #39 tuning. `npm run lint` passes.

---

## Acceptance Criteria

**Phase 1 (Implementation):**
- [ ] Track A: ProgressBar component created
  - [ ] Props: progress (0-100), label, animated, height, colors
  - [ ] Smooth animation between progress values
  - [ ] Theme integration (UseTheme for colors)
  - [ ] Web + iOS + Android support
  - [ ] Exported from `components/ui/index.ts`
  - [ ] `npm run lint` passes; TypeScript clean
- [ ] Track B: Kernel phase progress state added
  - [ ] `AppKernelState.phaseProgress` tracks currentPhaseIndex, progressPercent, phaseLabel
  - [ ] Phase % calculated correctly (0/8 → 12.5% → 25% → ... → 100%)
  - [ ] `usePhaseProgress()` hook created and exported
  - [ ] Phase updates in real-time as phases complete
  - [ ] `npm run lint` passes; TypeScript clean
- [ ] Track C: Phase messages system created
  - [ ] `lib/localization/phase-messages.ts` has 8 phases × 5 messages
  - [ ] D&D themed messages (config, network, storage, auth, etc.)
  - [ ] Random message selection per phase
  - [ ] Messages in `config/appsettings.json`
  - [ ] `getLocalizedPhaseMessage()` helper works
  - [ ] `npm run lint` passes; TypeScript clean
- [ ] Track D: Min display time logic implemented
  - [ ] Each phase has `PHASE_MIN_DISPLAY_MS` (default 100ms)
  - [ ] Delay enforced: `actual_duration < min_display` → wait extra
  - [ ] Configurable per-phase (inline numbers)
  - [ ] Comments explain UX purpose (readability, not perf)
  - [ ] `npm run lint` passes; TypeScript clean
- [ ] Track E: Phase progress wired via existing sync hook
  - [ ] `useKernelLoadingSync()` hook updated to include phase progress
  - [ ] Hook reads phase progress from `usePhaseProgress()`
  - [ ] Hook maps phase name → message via `getPhaseMessage()`
  - [ ] Hook calls `setLoading()` with message + progress + showProgress
  - [ ] UIBlocker displays progress bar + message during bootstrap
  - [ ] `npm run lint` passes; TypeScript clean
- [ ] Track F: Testing complete
  - [ ] At least one phase message displays during bootstrap
  - [ ] Progress bar animates smoothly 0-100%
  - [ ] No message flickering (min display time working)
  - [ ] Phase labels update correctly
  - [ ] Web + iOS + Android tested
  - [ ] Testing results documented
  - [ ] `npm run lint` passes; TypeScript clean

**Phase 2 (README):**
- [ ] `lib/localization/README.md` includes section on phase messages:
  - When phase messages are shown (during kernel bootstrap)
  - How to add a new message (add to PHASE_MESSAGES)
  - Theming note: D&D only for this issue; Cyberpunk deferred
  - Example: How navigation/other systems can use similar pattern (future)
- [ ] `components/ui/README.md` includes ProgressBar:
  - Component API (props, when to use)
  - Example: Used in InitializationSplashScreen
  - Styling: Theme integration

**Phase 3 (Guides):**
- [ ] `docs/issues/MileStone 2/Tier 7/283 - Kernel Phase Progress/USAGE_GUIDE.md`:
  - How the phase progress system works
  - Seeing phase messages during startup
  - Understanding progress bar (real, not fake)
  - Min display time explanation (UX, not perf)
  - Configuring per-phase delays (for Issue #39)
- [ ] `docs/issues/MileStone 2/Tier 7/283 - Kernel Phase Progress/Implimentation.md`:
  - How to add more messages to a phase (easy: edit PHASE_MESSAGES in phase-messages.ts)
  - How to customize for different themes (add new message set in future issue)
  - How future apps can customize (fork phase-messages.ts with different messages)
  - Simple string format (no keys needed for this issue)

**Phase 4 (Tests):**
- [ ] `docs/A Testing Guide/Kernel Phase Progress Testing.md`:
  - Manual test: Start app on web with DevTools throttling (slow 3G)
  - Observe: Phase message appears (e.g., "Connecting to the scrying crystal...")
  - Verify: Progress bar moves from 0% → 100%
  - Verify: Message stays visible ≥100ms (no flashing)
  - Verify: Phase counter increments (2/8 → 3/8 → 4/8...)
  - Test on iOS + Android
  - Screenshot: progress bar in action
  - Console capture: No bootstrap errors
- [ ] Unit tests for `ProgressBar`:
  - Test: progress prop updates width correctly
  - Test: label renders if provided
  - Test: animation smooth (values transition, not jump)
  - Test: colors from theme applied
- [ ] Unit tests for phase messages:
  - Test: `getPhaseMessageKey()` returns one of 5 messages for each phase
  - Test: `getLocalizedPhaseMessage()` retrieves message from localization
  - Test: All 8 phases have messages defined
- [ ] Integration test:
  - Test: InitializationSplashScreen displays + updates as phases progress
  - Test: Min display time enforced (phase doesn't advance before 100ms)
  - Test: Message changes as phase changes
  - Test: Progress bar reaches 100% when last phase ready
- [ ] `npm run lint` and `npm run typecheck` passing

---

## Dependencies & Notes

### Depends On
- **#265** (Kernel Phase-Aware Provider Pattern) — LoadingContext + LoadingBlocker
- **#266** (Text Keying & Message Centralization) — Message key system (phase.config.msg1, etc.)

### Deferred (Issue #40+)
- ❌ Visual theming (colors, gradients, animations for D&D vs Cyberpunk)
- ❌ Cyberpunk message variants (would need theme loaded earlier; skipping for now)
- ❌ Message localization/keys (simple strings for this issue; keys in Issue #47 if needed)
- ❌ Additional theme support (Pathfinder, generic) — Variant of #40

### Architecture Notes
- **Simple strings, not keys**: Messages are plain strings in `phase-messages.ts`. No key system yet; can be added in Issue #47 if needed.
- **App-agnostic kernel, app-specific messages**: Kernel system code (`system/Kernel/`) has no theme logic. Messages live in app (`lib/localization/`). Easy to fork for different app.
- **Real progress, not fake**: Progress = `(phaseIndex / 8) * 100`. No fake 0→90 fill. More honest; less animation overhead.
- **Min display time is UX only**: Not performance optimization. 100ms for readability; configurable if app needs tuning (Issue #39).
- **Random per phase, not per bootstrap**: Users see variety if app restarts, but same pool of 5 per phase. Prevents "getting old" while still having diversity.

### Performance Impact
- **Bootstrap slowdown**: +0 to 800ms (sum of min display times if all phases show).
  - Worst case: All 8 phases × 100ms = 800ms extra
  - Typical case: Phases 3-8 show (~600ms extra)
  - Fast devices: Barely noticeable (artificial delay on top of actual duration)
- **Message lookup**: O(1) — just random selection from phase messages array
- **Progress calculation**: O(1) — single division + rounding

### Testing Strategy
- **Step-through**: Manually start app; observe which phases display
- **Devices**: Test on web (dev tools throttle), iOS simulator, Android emulator
- **Metrics**: Record actual phase durations; baseline for Issue #39
- **No hidden tests**: Keep it simple; manual verification sufficient for this phase

### Future Enhancement (Issue #40)
- Load user theme preference earlier in bootstrap (before STORAGE phase)
- Enable Cyberpunk + D&D message variants
- Visual theming: colors, animations, background
- Settings: allow user to switch theme mid-app and see next bootstrap with new theme

---

## Summary

This issue delivers **phase progress visibility + D&D themed messages** to improve bootstrap UX on slow devices. It's:

✅ **Scoped tight** — 6 focused tracks; no theme switching complexity  
✅ **Reusable** — Centralized message system; easy for future apps  
✅ **Future-proof** — Min display time configurable; theme prepped for Issue #40  
✅ **Understandable** — Real progress (not fake); min display is UX (not perf)  
✅ **Small commits** — Each track is independently testable + committable  

After this issue:
- Users see phase messages during bootstrap (improves perceived performance)
- Loading experience is more branded (D&D personality)
- Message system ready for translation (Issue #47)
- Pattern established for Issue #40 (theming) + Issue #39 (phase tuning)

---

## Implementation Notes

**SplashScreen Display (Implemented):**
- **Title**: "D&D Toolkit" (static)
- **Subtitle**: "Initializing App" (static, entire bootstrap duration)
- **Progress bar**: 0-100% animated (real progress based on phaseIndex)
- **Footer message**: Currently shows phase label via`phaseLabel` prop
  - Will be replaced with D&D themed messages in Track C
  - One random message per phase; changes as phases progress
  - Shown in the "subtle status message" at bottom of screen

**Architecture Pattern:**
- Signal that bootstrap is happening → clear, simple subtitle ("Initializing App")
- Show what's happening right now → fun, themed message in footer (per phase)
- Progress indicator → animated bar from 0-100%

This keeps the UX uncluttered (one simple message) while adding personality (D&D flavor text).

**Future Polish (Post-MVP):**
- Track C will introduce D&D themed messages replacing current phase labels
- Consider toast/snackbar for phase transitions if detailed feedback needed
- Defer full UX review until track C completion
