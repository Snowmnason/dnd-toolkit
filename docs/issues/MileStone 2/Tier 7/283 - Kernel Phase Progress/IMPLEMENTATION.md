# Kernel Phase Progress: Message Customization Guide

## Overview

This guide explains how to customize phase messages for your app or fork the system for different themes.

## Adding Messages to a Phase

### Simple: Add to Existing Phase Pool

Each phase has 5 messages. To add a 6th:

1. Open `lib/localization/phase-messages.ts`
2. Find the phase you want to customize (e.g., `PHASE_MESSAGES.storageReady`)
3. Add your new message to the array:

```typescript
export const PHASE_MESSAGES = {
  // ...
  storageReady: [
    "Securing the arcane vault...",
    "Locking the treasure chest...",
    "Warding the storage runes...",
    "Fortifying the data stronghold...",
    "Sealing the magical archives...",
    "Encrypting the sacred tomes...",  // ← NEW MESSAGE
  ],
  // ...
} as const;
```

4. No other code changes needed; messages automatically included in random rotation
5. Run `npm run lint` to verify

### Guidelines for New Messages

- **Theme**: D&D medieval fantasy terminology
- **Length**: Keep under 40 characters for mobile
- **Action**: Start with verb ("Securing", "Scanning", "Summoning")
- **Variety**: Avoid repeating exact words from other messages

### Example: Adding Network Messages

```typescript
networkReady: [
  "Scanning the ethereal plane...",
  "Reaching out to the astral realm...",
  "Tuning to the cosmic frequency...",
  "Hailing the distant tower...",
  "Listening to the otherworldly whispers...",
  "Seeking the network spirits...",        // ← NEW
  "Engaging the communication stones...",  // ← NEW
],
```

## Customizing for Different Themes

### Current Status (This Issue)

- ✅ D&D themed messages included
- ❌ Cyberpunk messages deferred (Issue #40)
- ❌ Other theme support deferred

### Future: Theme-Specific Messages (Issue #40)

When visual theming is added, the system will look like:

```typescript
export const THEMED_PHASE_MESSAGES = {
  dnd: {
    config: ["Consulting the ancient tomes...", ...],
    storage: ["Securing the arcane vault...", ...],
    // ...
  },
  cyberpunk: {
    config: ["Initializing neural net...", ...],
    storage: ["Encrypting local cache...", ...],
    // ...
  },
  pathfinder: {
    // ... Pathfinder-specific messages
  },
};

// Load theme preference early in bootstrap
const currentTheme = loadUserTheme(); // Returns 'dnd' | 'cyberpunk' | 'pathfinder'
const messages = THEMED_PHASE_MESSAGES[currentTheme];
```

For now, **all apps use D&D messages**.

## Forking for Your Own App

If you're forking dnd-toolkit for your own app:

### Step 1: Replace the Message File

Edit `lib/localization/phase-messages.ts` with your own theme:

```typescript
// Your app: "TechVault" (futuristic tech theme)
export const PHASE_MESSAGES = {
  configReady: [
    "Loading system configuration...",
    "Accessing the mainframe...",
    "Initializing boot sequence...",
    "Reading deployment config...",
    "Syncing system parameters...",
  ],
  preloadReady: [
    "Caching critical assets...",
    "Pre-loading interface toolkit...",
    "Buffering visual resources...",
    "Staging media library...",
    "Preparing graphics pipeline...",
  ],
  networkReady: [
    "Establishing network connection...",
    "Initializing TCP handshake...",
    "Pinging remote servers...",
    "Establishing secure channel...",
    "Verifying network connectivity...",
  ],
  // ... continue for all 8 phases
};
```

### Step 2: Keep the Function Signature

Don't change `getPhaseMessage()` function:

```typescript
// ✅ Keep this the same
export function getPhaseMessage(
  phaseName: keyof typeof PHASE_MESSAGES,
): string {
  const messages = PHASE_MESSAGES[phaseName];
  const randomIndex = Math.floor(Math.random() * messages.length);
  return messages[randomIndex];
}
```

### Step 3: Test

```bash
# Verify lint passes
npm run lint

# Launch app and observe bootstrap messages
npm run web

# Check DevTools throttle to slow network for better visibility
```

## Message System Architecture

### Current (This Issue)

```
lib/localization/phase-messages.ts
  ├─ PHASE_MESSAGES (8 phases × 5 messages)
  ├─ getPhaseMessage(phaseName) → random string
  └─ Used by: useKernelLoadingSync() hook
```

### Future (Issue #47 — Localization)

```
lib/localization/
  ├─ phase-messages.ts       (message strings)
  ├─ phase-messages.keys.ts  (i18n keys)
  └─ phase-messages.i18n.json (translations)

getLocalizedPhaseMessage(phaseName, locale) → translated string
```

### How Messages Flow

```
1. Kernel completes a phase
   ↓
2. Kernel notifies subscribers (via kernel.subscribe())
   ↓
3. useKernelLoadingSync() hook triggers
   ↓
4. Hook calls getPhaseMessage(currentPhaseName)
   ↓
5. phase-messages.ts randomly selects a message
   ↓
6. Hook passes message to setLoading({ message, progress, ... })
   ↓
7. UIBlocker re-renders with new message
   ↓
8. User sees the message for 100ms+ (min display time)
```

## Adding Messages to Other Phases

### All 8 Phases

| Phase | File Location | Purpose |
| --- | --- | --- |
| CONFIG | `storageReady[0]` | Configuration loaded |
| PRELOAD | `preloadReady[1]` | Fonts/images loaded |
| NETWORK | `networkReady[2]` | Network detection ready |
| STORAGE | `storageReady[3]` | SecureStorage initialized |
| SERVICES | `servicesReady[4]` | Auth/Error/Database ready |
| JOB_SETUP | `jobSetupReady[5]` | Job queue initialized |
| AUTH | `authReady[6]` | User session restored |
| READY | `appReady[7]` | All systems ready |

### Example: Adding to CONFIG Phase

```typescript
export const PHASE_MESSAGES = {
  configReady: [
    "Consulting the ancient tomes...",
    "Reading the sacred scrolls...",
    "Deciphering the wizard's notes...",
    "Studying the spell tome...",
    "Preparing the ritual...",
    "Flipping through grimoires...",       // ← NEW
    "Indexing the spell library...",       // ← NEW
  ],
};
```

## Performance Considerations

### Message Lookup

- **Time**: O(1) — constant time (random array index)
- **Memory**: ~1KB for all messages combined
- **CPU**: Negligible (single Math.random() call per phase)

### No Impact on Bootstrap Time

Messages are read-only strings; no performance overhead:

```typescript
// Fast: Just a random selection
const messages = PHASE_MESSAGES[phaseName];           // O(1)
const randomIndex = Math.floor(Math.random() * len);  // O(1)
return messages[randomIndex];                         // O(1)
```

## Validation

### Checking Your Changes

After editing `phase-messages.ts`:

```bash
# 1. Lint check
npm run lint

# 2. Type check
npm run typecheck

# 3. Test on device/simulator
npm run web  # Watch bootstrap and verify messages appear
```

### Common Issues

**Error: "Type 'typeof PHASE_MESSAGES' has no matching overload"**
- Cause: Added a phase name that doesn't exist
- Fix: Only use existing phase names (config, preload, network, storage, services, jobSetup, auth, ready)

**Error: "String not assignable to type 'string | undefined'"**
- Cause: Message is null or undefined
- Fix: Ensure all messages are non-empty strings

**Message not appearing**
- Cause: Phase too fast to display (fast device, fast network)
- Fix: Check with network throttling (DevTools Slow 3G)
- Or: Increase `PHASE_MIN_DISPLAY_MS` to verify

## Best Practices

1. **Keep messages short**: Under 40 characters fits mobile screens
2. **Match your theme**: Use terminology consistent with your app
3. **Vary the verbs**: Don't start all messages with the same verb
4. **Test on slow networks**: DevTools > Network > Slow 3G
5. **Keep the function signature**: Don't change `getPhaseMessage()`
6. **Document your fork**: If customizing, leave comments explaining theme choices

## Example: Complete Custom Message File

```typescript
// lib/localization/phase-messages.ts
// Customized for "MagicQuest" app

export const PHASE_MESSAGES = {
  configReady: [
    "Opening the spell grimoire...",
    "Unfurling the enchanted scroll...",
    "Consulting the magical codex...",
    "Awakening the ancient text...",
    "Decoding the rune symbols...",
  ],
  preloadReady: [
    "Sharpening the quest tools...",
    "Polishing the magic compass...",
    "Readying the adventure gear...",
    "Preparing the wizard's staff...",
    "Oiling the adventure supplies...",
  ],
  networkReady: [
    "Contacting the oracle...",
    "Reaching out to distant portals...",
    "Channeling the astral network...",
    "Pinging the realm servers...",
    "Tuning the planar frequencies...",
  ],
  storageReady: [
    "Locking the treasure vault...",
    "Sealing the item storage...",
    "Warding the loot chamber...",
    "Securing the quest log...",
    "Protecting the inventory...",
  ],
  servicesReady: [
    "Summoning the quest guides...",
    "Awakening the helper spirits...",
    "Calling the magical assistants...",
    "Invoking the enchanted butler...",
    "Manifesting the support golems...",
  ],
  jobSetupReady: [
    "Setting up background tasks...",
    "Scheduling the quest updates...",
    "Configuring the timer runes...",
    "Preparing background rituals...",
    "Initializing automated triggers...",
  ],
  authReady: [
    "Verifying your adventurer status...",
    "Checking your guild credentials...",
    "Authenticating your quest license...",
    "Validating your hero registration...",
    "Confirming your played status...",
  ],
  appReady: [
    "Your quest awaits, adventurer...",
    "The trials begin...",
    "Welcome back to MagicQuest...",
    "The world is ready...",
    "Your adventure continues...",
  ],
} as const;

export function getPhaseMessage(
  phaseName: keyof typeof PHASE_MESSAGES,
): string {
  const messages = PHASE_MESSAGES[phaseName];
  const randomIndex = Math.floor(Math.random() * messages.length);
  return messages[randomIndex];
}
```

## Testing Your Messages

### Manual Testing

1. **On Web (Easy)**
   ```bash
   npm run web
   # Open DevTools → Network → Slow 3G
   # Reload page
   # Observe messages during bootstrap
   ```

2. **On iOS**
   ```bash
   npm run ios
   # Watch simulator startup
   # Messages appear during phases 6-8 (typically)
   ```

3. **On Android**
   ```bash
   npm run android
   # Watch emulator startup
   # Messages appear earlier than iOS (phases 4-8)
   ```

### Console Logging (Temporary)

Add logging to verify message selection:

```typescript
export function getPhaseMessage(
  phaseName: keyof typeof PHASE_MESSAGES,
): string {
  const messages = PHASE_MESSAGES[phaseName];
  const randomIndex = Math.floor(Math.random() * messages.length);
  const message = messages[randomIndex];
  console.log(`[Phase] ${phaseName} → "${message}"`);
  return message;
}
```

Then remove after testing.

## Related Documentation

- [Localization Module README](../../../../lib/localization/README.md) — System architecture
- [Usage Guide](USAGE_GUIDE.md) — How users experience phase progress
- [ProgressBar Component](../../../../components/ui/README.md#progressbar) — Display component