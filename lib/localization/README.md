# Localization Module

Centralized message and text management for the app. Provides phase-specific messages during kernel bootstrap and supports future localization needs.

## When to Use This Module

**Use this module to:**

- Get random phase messages during kernel bootstrap (`getPhaseMessage()`)
- Add new phase messages (edit `PHASE_MESSAGES` in `phase-messages.ts`)
- Prepare for future localization (message keys, i18n support)

**Do NOT use this module for:**

- General app text (use inline strings for now; localization in future issue)
- Theme-specific logic (messages are app-specific, not theme-aware)
- Real-time text updates (static messages only)

## Architecture & Data Flow

```
Kernel Bootstrap
        ↓
Phase Completes (e.g., 'storageReady')
        ↓
useKernelLoadingSync() calls getPhaseMessage('storage')
        ↓
Random message selected from PHASE_MESSAGES.storage[]
        ↓
Message displayed in LoadingBlocker
```

**Key Principles:**

- **Simple strings, not keys**: Messages are plain strings for now (localization in future issue)
- **Random selection**: Each phase has 5 messages; random one chosen per bootstrap
- **App-specific theming**: D&D themed messages (Cyberpunk deferred to future issue)
- **Bootstrap-only**: Currently only used during kernel initialization

## API Reference

### getPhaseMessage()

```typescript
import { getPhaseMessage } from '@/lib/localization/phase-messages';

const message = getPhaseMessage('storageReady');
// Returns: "Securing the arcane vault..." (random from 5 options)
```

**Parameters:**
- `phaseName`: Kernel phase name ('configReady', 'storageReady', etc.)

**Returns:** Random message string for the phase

## Phase Messages

### Available Phases

| Phase | Description | Example Messages |
| --- | --- | --- |
| `configReady` | App configuration loaded | "Consulting the ancient tomes..." |
| `preloadReady` | Fonts/images preloaded | "Sharpening the wizard's quill..." |
| `networkReady` | Network detection initialized | "Scanning the ethereal plane..." |
| `storageReady` | SecureStorage initialized | "Securing the arcane vault..." |
| `servicesReady` | Auth/Error/Database providers registered | "Summoning the arcane guardians..." |
| `authReady` | User auth state restored | "Verifying the adventurer's identity..." |
| `syncReady` | Offline sync initialized | "Synchronizing with the crystal ball..." |
| `appReady` | All phases complete | "The ritual is complete..." |

### Adding New Messages

To add a new message to a phase:

```typescript
// In lib/localization/phase-messages.ts
export const PHASE_MESSAGES = {
  storageReady: [
    "Securing the arcane vault...",
    "Locking the treasure chest...",
    "Warding the storage runes...",
    "Fortifying the data stronghold...",
    "Sealing the magical archives...",
    // Add your new message here
    "Your new message...",
  ],
  // ... other phases
} as const;
```

### Message Guidelines

- **D&D Theme**: Use fantasy/medieval terminology (vault, runes, arcane, etc.)
- **Action-oriented**: Start with verb ("Securing", "Scanning", "Summoning")
- **Concise**: Keep under 40 characters for mobile display
- **Variety**: Provide 5 different messages per phase for replayability

## Future Extensions

### Localization Support (Issue #47)

When full i18n is added:

```typescript
// Future: Message keys instead of strings
export const PHASE_MESSAGE_KEYS = {
  storageReady: 'phase.storage.message1', // Key instead of string
  // ...
};

// Future: Localized lookup
const message = getLocalizedMessage(getPhaseMessageKey('storageReady'));
```

### Theme Variants (Issue #40)

When visual theming is added:

```typescript
// Future: Theme-specific messages
export const THEMED_PHASE_MESSAGES = {
  dnd: { /* D&D messages */ },
  cyberpunk: { /* Cyberpunk messages */ },
};
```

## Related Modules

- **`hooks/kernel/use-kernel-loading-sync.tsx`** — Calls `getPhaseMessage()` during bootstrap
- **`system/kernel/app-kernel.ts`** — Phase completion triggers message updates
- **`components/SplashScreen`** — Displays the phase messages
- **`lib/kernel`** — Orchestrates phase progression

## File Breakdown

| File | Purpose |
| --- | --- |
| `phase-messages.ts` | Phase message definitions and random selection helper |