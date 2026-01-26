# Privacy & Data-Lifecycle Policy

Comprehensive policy governing data classification, storage backends, encryption, and user data deletion workflows across all platforms.

## Data Classification

We classify all user data by **sensitivity level** to determine storage backend, encryption, logging, and retention handling.

### PUBLIC Data

**Definition:** Non-sensitive, application metadata with no PII.

**Examples:**

- App version
- Feature flags (non-user-specific)
- Theme preferences
- Public game content

**Storage Backend:** FastCache (unencrypted, fast)  
**Retention:** No expiry; can be cleared on app update  
**Logging:** Safe to log directly  
**Encryption:** No

### NON_SENSITIVE Data

**Definition:** App data that is not user-specific or personal.

**Examples:**

- World metadata (names, descriptions)
- Character templates
- Cached list of public worlds
- Game rules/content

**Storage Backend:** FastCache (unencrypted, fast)  
**Retention:** Can be cleared on app update  
**Logging:** Safe to log (no user IDs embedded)  
**Encryption:** No

### SENSITIVE Data

**Definition:** User-scoped data that requires protection but is not highly personal.

**Examples:**

- User's world list
- Character sheet data
- Game state/progress
- Premium entitlements
- User role in worlds

**Storage Backend:** SecureStorage (encrypted, all platforms)  
**Retention:** Cleared on logout  
**Logging:** Redact user IDs, world names → `[REDACTED]`  
**Encryption:** Yes (AES-256)

### PII (Personally Identifiable Information)

**Definition:** Highly sensitive user identity and authentication data.

**Examples:**

- Email address
- Password hash / session token
- Authentication tokens (JWT)
- User UUID
- Session ID

**Storage Backend:** SecureStorage (encrypted, all platforms)  
**Retention:** Cleared immediately on logout  
**Logging:** Never log; completely redacted  
**Encryption:** Yes (AES-256)

---

## Storage Backends

### FastCache

- **Encryption:** No (unencrypted, plain text)
- **Speed:** Fast (in-memory or local read)
- **Persistence:** Survives app refresh; cleared on app update
- **Use For:** PUBLIC and NON_SENSITIVE data
- **Platform:** Web localStorage, mobile disk cache
- **Cleanup:** On app update or manual purge

### SecureStorage

- **Encryption:** Yes (AES-256 on all platforms)
- **Speed:** Medium (encrypted I/O)
- **Persistence:** Survives app updates; persists until app uninstall
- **Use For:** SENSITIVE and PII data
- **Platform-Specific:**
  - **iOS:** Keychain (OS-level encryption)
  - **Android:** EncryptedSharedPreferences (AES encryption)
  - **Web:** AES-256 encryption stored in encrypted localStorage
- **Cleanup:** Manual via API or on account deletion

---

## Data Lifecycle

### On App Launch

1. **Not Authenticated:** FastCache and SecureStorage are available but empty
2. **Authenticated:** SecureStorage is unlocked; user session restored

### On Logout

**Automatically cleared (best-effort):**

- All SENSITIVE data keys
- All PII data keys
- Session tokens
- World access info
- Entitlements

**Retained:**

- PUBLIC and NON_SENSITIVE (app version, theme, flags)

### On Account Deletion (via API)

1. **Server-side:** User records deleted from database
2. **Client-side:**
   - Call `clearAllUserData()` to wipe SENSITIVE and PII
   - Keep PUBLIC and NON_SENSITIVE for next login
3. **Result:** App is in "logged out" state; user can log in with different account

### On App Uninstall

- **FastCache:** Automatically cleared by OS (app sandbox)
- **SecureStorage:** Automatically cleared by OS (Keychain/EncryptedSharedPreferences/localStorage)
- **Result:** Complete data wipe

---

## Logging & Telemetry

### PII Data

**Rule:** Never logged, even in error traces.

**Redaction:**

- Email addresses → `[REDACTED]`
- Tokens → `[REDACTED]`
- Session IDs → `[REDACTED]`
- User UUIDs → `[REDACTED]`

**Example:**

```typescript
import { redactForLogs } from "@/lib/storage";

logger.error("auth", redactForLogs({ email, token, userId }));
// Output: "auth { email: '[REDACTED]', token: '[REDACTED]', userId: '[REDACTED]' }"
```

### SENSITIVE Data

**Rule:** Redact identifiers; don't log raw values.

**Redaction:**

- User names → `[REDACTED]`
- World names → `[REDACTED]`
- World IDs → `[REDACTED]`

**Example:**

```typescript
logger.info("world", redactForLogs({ worldId, worldName }));
// Output: "world { worldId: '[REDACTED]', worldName: '[REDACTED]' }"
```

### NON_SENSITIVE & PUBLIC Data

**Rule:** Safe to log directly.

**Example:**

```typescript
logger.debug("feature", { version: "1.0.0", theme: "dark" });
// Output: "feature { version: '1.0.0', theme: 'dark' }"
```

---

## Data Requests (GDPR / CCPA)

Users can request data handling as follows:

### Data Export

**What:** User receives all SENSITIVE data stored locally.

**Implementation:**

```typescript
import { getSensitiveKeys } from "@/lib/storage";

async function exportUserData() {
  const keys = getSensitiveKeys();
  const data = {};
  for (const key of keys) {
    data[key] = await SecureStorage.getItem(key);
  }
  return data; // Send to user
}
```

### Data Deletion

**What:** User's account and all associated data deleted.

**Implementation:**

1. **Server-side:** Call Supabase RPC to delete user records
2. **Client-side:** Call `clearAllUserData()` to wipe local SENSITIVE/PII

```typescript
import { clearAllUserData } from "@/lib/storage";

async function deleteAccount() {
  await rpc("delete_account"); // Server-side deletion
  await clearAllUserData(); // Client-side cleanup
}
```

### Consent Management

**What:** Stored in SENSITIVE backend; cleared on logout/deletion.

**Storage:** SecureStorage key (e.g., `secure:consent_preferences`)

---

## Security Notes

### Encryption Standards

- **Algorithm:** AES-256-GCM (authenticated encryption)
- **Key Derivation:** Platform-specific (iOS Keychain, Android EncryptedSharedPreferences, Web PBKDF2)
- **Initialization Vector (IV):** Random per encryption
- **Authentication Tag:** Prevents tampering

### Key Management

- **Keys never stored in code** (OS-managed)
- **Keys never exposed in error messages** (redacted)
- **Keys never transmitted to server** (client-side only)
- **Encryption transparent to app code** (handled by SecureStorage)

### Error Handling

- **Encryption failures:** Logged with redaction; fail safe (no data leak)
- **Decryption failures:** Treated as data loss; triggers recovery
- **Storage unavailable:** Graceful fallback; non-blocking

---

## Implementation Guide

### For Developers

When adding new storage keys:

1. **Classify the data:** Is it PUBLIC, NON_SENSITIVE, SENSITIVE, or PII?
2. **Register in `DATA_CLASSIFICATIONS`:** Add entry with sensitivity level and TTL
3. **Use correct backend:** Let `getStorageBackend(key)` route automatically
4. **Redact in logs:** Use `redactForLogs(data, key)` when logging

**Example:**

```typescript
import { DATA_CLASSIFICATIONS, DataSensitivity } from "@/lib/storage";

// Register
export const DATA_CLASSIFICATIONS = {
  "secure:my_data": {
    key: "secure:my_data",
    sensitivity: DataSensitivity.SENSITIVE,
    description: "User-scoped game data",
    ttl: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
};

// Use
import { getStorageBackend, redactForLogs } from "@/lib/storage";

const backend = getStorageBackend("secure:my_data"); // Returns SecureStorage
await backend.setItem("secure:my_data", userData);

logger.info("game", redactForLogs(userData, "secure:my_data"));
```

### For Compliance Teams

**Data Inventory:**

Run `getSensitiveKeys()` to get all keys that contain user data and will be cleared on logout/deletion.

**Retention Policy:**

Check `getRetentionInfo(key)` for TTL and clear-on-logout status for each key.

**Audit Trail:**

All data access is logged with redaction applied (via logger categories in `appsettings.json`).

---

## Related Files

- [lib/storage/data-classification.ts](../../../../lib/storage/data-classification.ts) – Data sensitivity registry
- [lib/storage/privacy.ts](../../../../lib/storage/privacy.ts) – Privacy helpers (classify, redact, clear)
- [lib/storage/README.md](../../../../lib/storage/README.md) – Storage module architecture
- [lib/logger.ts](../../../../lib/logger.ts) – Logger with category-based filtering
