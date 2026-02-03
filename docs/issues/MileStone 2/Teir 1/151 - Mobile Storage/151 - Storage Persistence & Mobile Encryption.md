**Storage Persistence & Mobile Encryption (Milestone 2)**

**Summary**

- **Problem:** HMAC verification failures and missing persisted data on mobile (Expo Go) after app reloads; inconsistent behavior across web, mobile, and desktop.
- **Scope:** Affects encrypted storage and query cache persistence. Primary impact: auto-login and worlds list persistence on mobile/dev workflows.

**Symptoms**

- **HMAC failures:** Logs showing HMAC verification failed for stored items after refresh.
- **Missing key:** Encryption key disappears in Expo Go during hot reload, causing data encrypted by previous key to be unreadable.
- **Desktop behavior:** Desktop uses the web build (Electron) and persists via localStorage (leveldb). Worlds list should persist but may not if cache handling or invalidation clears it.

**Root Cause**

- **Expo Go limitation:** `expo-secure-store` (Keychain/Keystore) is unreliable in Expo Go and may not persist across reloads. That made the encryption key effectively ephemeral during development, causing HMAC mismatches on reload.
- **AsyncStorage string handling:** On some mobile environments AsyncStorage can mangle base64 strings unless wrapped; this was causing corruption of encrypted payloads.
- **Aggressive clearing logic:** Earlier code cleared AsyncStorage when the key was missing, which destroyed existing data and caused repeated HMAC failures.

**Fixes Implemented (Milestone 2)**

- **Simplified storage strategy:** Use `localStorage` on web/desktop and `AsyncStorage` on mobile for both encryption key and encrypted items; on mobile values are JSON-wrapped (stringified) to prevent AsyncStorage string corruption.
- **Removed destructive auto-clear:** No longer clear AsyncStorage automatically if key missing; instead create a new key and allow old data to gracefully fail HMAC checks.
- **HMAC handling:** HMAC mismatches now emit a single warning for the key and the item is cleared silently; decryption failures return empty values to avoid spamming logs.
- **Logging cleanup:** Reduced verbose storage logs to only warnings/errors and concise stored-item debug entries.

**Implementation Notes**

- Primary implementation lives in: [lib/auth/encrypted-storage.ts](lib/auth/encrypted-storage.ts)
- Query cache persists via `FastCache` -> [lib/storage/FastCache.ts](lib/storage/FastCache.ts) which maps to `localStorage` on web/desktop and `AsyncStorage` on mobile.
- Cache keys for worlds are defined in: [lib/cache/keys.ts](lib/cache/keys.ts) and used by `useWorldsQuery()` ([hooks/use-worlds-query.tsx](hooks/use-worlds-query.tsx)).

**What the code SHOULD do now**

- Mobile (Expo Go): encryption key and encrypted items persist in `AsyncStorage` (JSON-wrapped) and survive reloads in Expo Go.
- Desktop: Electron runs the web build and persists cache/data in the OS app data dir via Chromium's leveldb-backed localStorage.
- On key mismatch / old data: HMAC warnings are logged once per affected key and items are removed gracefully.

**How to verify (developer steps)**

- Run desktop dev: `npm run desktop:dev` (exports dist and starts Electron dev).
- On mobile (Expo Go): start dev server (`npm start`) and test sign-in, then reload Expo Go — verify the encryption key remains in `AsyncStorage` and no HMAC spam appears.
- Inspect desktop storage in DevTools: Application → Local Storage → look for `query_cache_worlds:*` keys.

**Limitations & Next Steps**

- For production mobile (standalone builds) prefer `expo-secure-store` or `react-native-keychain` for the encryption key; current `AsyncStorage` approach is pragmatic for Expo Go and development.
- Investigate and add optional migration logic that re-encrypts persisted data when keys rotate.
- Add a short integration test that simulates key loss and verifies graceful behavior (HMAC warnings, no destructive clears).

**Files touched in Milestone 2**

- [lib/auth/encrypted-storage.ts](lib/auth/encrypted-storage.ts)
- [lib/storage/FastCache.ts](lib/storage/FastCache.ts)
- [lib/cache/query-cache.ts](lib/cache/query-cache.ts)

**Quick references**

- Use `useWorldsQuery()` ([hooks/use-worlds-query.tsx](hooks/use-worlds-query.tsx)) to check worlds cache behavior.
- FastCache persists to platform storage; desktop storage files are located in the OS app data directories (Electron `Local Storage/leveldb`).

---

If you want, I can add a one-page migration plan (how to smoothly rotate keys and re-encrypt data) or create a short test harness to validate persistence across reloads.
