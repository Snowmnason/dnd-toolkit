# Navigation Hooks (`hooks/navigation/`)

## Overview

The navigation hooks layer bridges screen-level navigation requests to the centralized navigation manager (`lib/navigation/`). This module provides React hooks for user-triggered navigation, route observation, and modal UI handling.

**Key Principle:** This layer is for **user-triggered navigation only** (button taps, link clicks). Internal redirects from auth/jobs systems call managers directly and bypass this hook layer.

---

## When to Use These Hooks

### ✅ `useNavigation()` — Primary Hook
Use in **screens and components** when a user directly triggers navigation:
- Button taps → route transition
- Link clicks → external links
- Menu selections → screen changes
- Back button coordination

**NOT for:**
- Internal auth redirects (use `executeInternalRedirectNavigation()` from lib)
- Programmatic redirects from effects that run independently of user action
- Job system or background task triggers (use lib managers directly)

### ✅ `useRouteChangeObserver()` — Root-Only Effect Hook
Use **once in `app/_layout.tsx`** to catch navigation that bypasses the `useNavigation()` hook:
- Deep links from OS (notifications, browser QR codes, etc.)
- URL bar edits (web platform)
- Back button/gesture navigation (mobile)
- Third-party navigation code

**NOT for:**
- Component-level routing (use `useNavigation()`)
- Conditional rendering based on route (use `useSegments()`)

### ✅ `useNavigationUiModals()` — Internal, Adapter Hook
Used internally by `useNavigation()` to interpret navigation outcomes and render modals. **Rarely imported directly; primarily for framework integration.**

---

## When NOT to Use These Hooks

### ❌ Internal Auth Redirects
When auth/session state changes trigger a route change:
```typescript
// ❌ WRONG: Don't call useNavigation() from auth effects
useEffect(() => {
  if (isExpired) {
    const nav = useNavigation();
    await nav.to('/login');  // ❌ This bypasses auth manager coordination
  }
}, [isExpired]);

// ✅ CORRECT: Auth manager handles this
AuthStateManager.onSessionExpire(() => {
  executeInternalRedirectNavigation('/login', 'session-expired');
});
```

### ❌ Programmatic Job Triggers
When background jobs need to trigger navigation:
```typescript
// ❌ WRONG: Don't use useNavigation() from job machinery
async function syncJob() {
  const nav = useNavigation();  // ❌ Wrong context
  await nav.to('/main');
}

// ✅ CORRECT: Job system calls lib manager
async function syncJob() {
  await executeInternalRedirectNavigation('/main', 'sync-complete');
}
```

---

## API Reference

### `useNavigation()`

Primary hook for user-triggered navigation with built-in duplicate-call throttling (300ms default).

#### Signature
```typescript
const navigate = useNavigation();
```

#### Methods

#### Transition Family (Async, Guarded)
Full guard pipeline: canonicalization → metadata → policy checks → execution.

**`to(route, params?, options?): Promise<void>`**
Push a new route onto the stack.
```typescript
// Basic push
await navigate.to('/main/characters', { worldId: 'world-123' });

// Disable throttling for this call
await navigate.to('/debug/logs', undefined, { throttleMs: false });

// Extend throttle window for a slow route
await navigate.to('/heavy-page', { id: '1' }, { throttleMs: 500 });
```

**`replace(route, params?, options?): Promise<void>`**
Replace the current route without pushing to history.
```typescript
await navigate.replace('/select/world-selection');
```

#### History Family (Fire-and-Forget)
Synchronous stack manipulation, no guards.

**`back(options?): void`**
Navigate to the previous route in the stack.
```typescript
navigate.back();
navigate.back({ throttleMs: false });  // Never throttle back
```

**`dismiss(options?): void`**
Close the current modal or stack level.
```typescript
navigate.dismiss();
```

**`dismissAll(target?, options?): void`**
Close all modals/screens back to a target or the root.
```typescript
// Dismiss all modals
navigate.dismissAll();

// Dismiss back to a specific route
navigate.dismissAll('/main/characters', { throttleMs: 0 });
```

#### External Family (Trust-Gated)
**`openWeb(url, options?): void`**
Open an external URL with optional trust verification.
- Internally trusted origins → open immediately
- Unknown origins → show trust consent modal (3-option decision)

```typescript
// Open a known-trusted URL
navigate.openWeb('https://example.com');

// Disable throttle for manual retry after cancellation
navigate.openWeb('https://example.com', { throttleMs: false });
```

#### Return Types
- **Async methods** (`to`, `replace`): `Promise<void>`
  - Await to know when navigation completes
  - Failures are captured internally and shown via modal; promises do NOT reject
- **Fire-and-forget** (`back`, `dismiss`, `dismissAll`, `openWeb`): `void`
  - Return immediately; side effects happen asynchronously

#### Options Object
```typescript
interface NavigationCallOptions {
  throttleMs?: number | false;
}

// Resolved as:
- throttleMs: 300 (default) = suppress identical calls within 300ms
- throttleMs: 500 = suppress identical calls within 500ms
- throttleMs: 0 or false = disable throttling for this call
```

#### Built-In Throttling
Every navigation method deduplicates rapid identical calls within a default 300ms window. This is useful for buttons that might be tapped multiple times in quick succession.

- Same route + same params = same call
- Throttle window is per-call, not global
- Override per-call via the trailing options object
- Automatically cleared when the component unmounts (no stale state)

#### Failure Handling
When navigation fails (policy denial, permission denied, transport unavailable):
- `to()` and `replace()` do NOT throw or reject
- Failures are captured and shown via `NavModal` automatically
- No explicit error state to check; just await and proceed

#### Usage Examples

**Screen with Multiple Navigation Points**
```typescript
import { useNavigation } from '@/hooks/navigation';

export function CharacterListScreen() {
  const navigate = useNavigation();

  const handleSelectCharacter = async (characterId: string) => {
    await navigate.to('/main/character-sheet', { characterId });
  };

  const handleGameSettings = async () => {
    await navigate.to('/main/game-settings');
  };

  const handleLogout = async () => {
    await navigate.replace('/select/world-selection');
  };

  return (
    <View>
      {/* Render list */}
      <Button onPress={() => handleSelectCharacter(charId)} />
      <Button onPress={handleGameSettings} />
      <Button onPress={handleLogout} />
    </View>
  );
}
```

**Handling Route Params**
```typescript
const navigate = useNavigation();

// With URL params
await navigate.to('/main/characters', {
  worldId: 'w1',
  tab: 'spells',
});

// This creates route: /main/characters?worldId=w1&tab=spells
// Consumed in screen via useLocalSearchParams()
```

**External Links with Trust**
```typescript
const navigate = useNavigation();

// User clicks a link in the app
const handleDocumentationLink = () => {
  navigate.openWeb('https://docs.example.com');
  // If origin is untrusted, TrustedUrlConsentModal appears
};

// Three-option consent:
// 1. "Don't open" → dismissed, no action
// 2. "Open anyway" → opens once, doesn't persist trust
// 3. "Trust & open" → opens and remembers this origin for future
```

**High-Frequency Button (Preventing Double-Tap)**
```typescript
const navigate = useNavigation();

// Most buttons automatically throttle (default 300ms)
const handleFrequentButton = async () => {
  await navigate.to('/route1');  // Throttled automatically
};

// If you need a different window:
const handleSlowPageLoad = async () => {
  await navigate.to('/heavy-page', params, { throttleMs: 500 });
};

// If you need to disable throttling (e.g., debug):
const handleDebugJump = async () => {
  await navigate.to('/debug', undefined, { throttleMs: false });
};
```

---

### `useRouteChangeObserver()`

Effect hook mounted in `app/_layout.tsx` to validate post-hoc route changes (deep links, URL edits, back button).

#### Signature
```typescript
useRouteChangeObserver(): void
```

#### Behavior
1. Watches route segments via `useSegments()`
2. On route change, calls `evaluateObservedRouteChange()` from lib
3. Policy check happens inside that function; if denied, it executes a redirect
4. If redirect happens, `NavModal` is shown automatically
5. No return value; all side effects are internal

#### Usage (Root Layout Only)
```typescript
// In app/_layout.tsx, mount unconditionally at root level:
export default function RootLayout() {
  useAppKernel();
  useRouteChangeObserver();  // ← Detects deep links, URL edits, back button
  
  return <Stack>{/* ... */}</Stack>;
}
```

#### What It Catches
- **Deep links** — OS launches app with URL (notification, browser link)
- **URL bar edits** — User types in address bar (web only)
- **Back button** — User taps back button or gesture (mobile)
- **Third-party navigation** — Any code that bypasses `useNavigation()`

#### What It Does NOT Catch
- Regular screen-initiated navigation via `useNavigation()` (already guarded)
- Browser history back/forward (standard browser behavior)

---

### `useNavigationUiModals()`

**Internal adapter hook.** Rarely used directly; primarily for framework integration with modal rendering.

#### Signature
```typescript
const { showNavModal, dismissNavModal, showTrustModal, dismissTrustModal } = useNavigationUiModals();
```

#### Methods
- `showNavModal(type, heading?, body?, canGoBack?, primaryAction?, secondaryAction?)` — Open generic navigation feedback modal
- `dismissNavModal()` — Close generic modal
- `showTrustModal(url, onDismiss, onOpenAnyway, onTrustAndOpen)` — Open trust consent modal
- `dismissTrustModal()` — Close trust modal

#### When to Use
Only when implementing custom navigation flows that need to display feedback or trust prompts. Screens should use `useNavigation()` instead.

---

## Architecture & Data Flow

### User-Triggered Navigation
```
Screen
  ↓ (user action: tap button)
useNavigation() hook
  ↓ (call to(route, params, options))
ExecutionContext built, throttle checked
  ↓
NavigationManager (lib/navigation/)
  ↓ (validates, applies metadata, runs guards)
lib/middleware/services/ (network ready, normalize)
  ↓
system/API/ (HTTP, storage, retry)
  ↓
NavServiceResult returned
  ↓
Hook receives result
  ↓
Use ModalProvider to show feedback if needed
```

### Post-Route Observation
```
OS/Browser
  ↓ (deep link, URL edit, back button)
Route change detected
  ↓
useRouteChangeObserver() fires
  ↓
evaluateObservedRouteChange(currentRoute, previousRoute)
  ↓
Policy check (is new route allowed?)
  ↓
If denied: redirect executed, NavModal shown
If allowed: route proceeds normally
```

---

## Dependencies

**Imports From:**
- `@/lib/navigation` — Route execution functions (`executeRouteNavigation`, `executeHistoryNavigation`, `executeExternalNavigation`)
- `@/lib/utils` — Logger
- `react` — Hooks (`useCallback`, `useEffect`, `useRef`, `useState`)
- `expo-router` — `useRouter`, `useSegments`

**Used By:**
- Screens in `app/` and `Screens/`
- Components that trigger navigation
- App root layout (`app/_layout.tsx`)

**Does NOT Import From:**
- `lib/middleware/services/` (goes through manager)
- `system/` (goes through manager)
- Concrete providers (Supabase, etc.)

---

## Error Handling & Edge Cases

### Throttling Edge Cases
- **Same route, different params** → Different keys, both execute
- **Rapid back() calls** → Throttled as a single "back" action
- **Route change after fail** → Throttle state resets on successful navigation (component lifecycle)

### Failure Modes
- **Transport unavailable** → NavModal shown, "Go home" and "Go back" buttons offered
- **Permission denied** → NavModal shown with reason
- **Timeout during guard** → NavModal shown, navigation cancelled
- **External link untrusted** → TrustedUrlConsentModal shown (not an error per se)

### No Error Throwing
The hooks do NOT throw or reject on failures. Instead:
1. Failures are captured internally
2. UI modals appear to inform the user
3. The promise resolves normally (or void methods return)

This means screens do NOT need try/catch around navigation calls.

---

## Performance Notes

### Throttling Overhead
- Per-call cost: `~0.1ms` (`Date.now()` + string comparison)
- Memory: `~100 bytes` per hook instance (cleared on unmount)
- **Impact:** Negligible compared to network latency of actual navigation (100-500ms)

### Observer Overhead
- Watches segment changes (React dependency)
- Policy evaluation only on actual route change (not on re-renders)
- **Impact:** Minimal, one effect at root level

### Recommended Optimizations
- Use granular selector hooks (`useWorldId()`, `useUserId()`) instead of full context in screens
- Lazy-load route components via dynamic imports
- Consider `useMemo` for expensive computations before calling navigate

---

## Related Modules

- **`lib/navigation/`** — Manager layer, orchestration, guard pipeline
- **`lib/middleware/services/`** — Normalized execution (network checks, provider calls)
- **`system/API/`** — Raw HTTP/storage transport
- **`components/modals/`** — NavModal and TrustedUrlConsentModal components
- **`contexts/ModalContext`** — Global modal state provider

---

## Testing

### Manual Testing
1. **Simple Push** — Button tap triggers `navigate.to()`, screen transitions
2. **Back Navigation** — Tap back button or call `navigate.back()`, previous screen returns
3. **Deep Link** — Tap notification or URL, observer detects and validates
4. **Trust Modal** — Tap external link to unknown origin, consent modal appears
5. **Throttle** — Rapidly tap the same button, only one navigation executes
6. **Failure** — Attempt to navigate to restricted route, NavModal shows reason

### Unit Testing (If Tests Exist)
- Mock `executeRouteNavigation` to return policy denial
- Verify throttle deduplication logic
- Verify options object resolution
- Verify ref cleanup on unmount

---

## Future Enhancements

1. **Prefetch API** — `navigate.prefetch(route)` to warm cache before transition
2. **Conditional Guards** — Feature flags on guards (e.g., "enable strict age check on beta")
3. **Navigation Analytics** — Formalize per-route telemetry in manager
4. **Back-Button Customization** — Per-route back behavior (dismiss, pop, replace)
5. **Route Stacks** — Named stacks for side-by-side navigation (e.g., split panes on tablet)

---

## FAQ

**Q: Can I use `useNavigation()` in a non-screen component?**
A: Yes, any component can call `useNavigation()`. Just remember: it's for **user-triggered actions** only. Don't call it from effects that run on mount or from background tasks.

**Q: What happens if I call `navigate.to()` twice rapidly?**
A: The second call is throttled (suppressed) by default if it's identical to the first. If you need both to execute, use `{ throttleMs: false }` on the second call.

**Q: Can I navigate from a global state change (Redux, Zustand, etc.)?**
A: Not via this hook. Global state changes should call lib managers directly: `executeInternalRedirectNavigation(route, reason)`. It's more explicit and doesn't tie global state to React component context.

**Q: How do I know if navigation failed?**
A: You don't need to—failures are shown via modal automatically. The promise resolves normally even on failure. Just await and continue; the UI handles the feedback.

**Q: Can I customize the NavModal appearance?**
A: The modal is registered globally and styled centrally. To customize, edit `components/modals/NavModal.tsx`. Per-route customizations would require a more complex modal system (future enhancement).
