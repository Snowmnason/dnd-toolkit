# lib/settings

User account and authentication state management operations.

## When to Use This Module

**Use this module for:**

- **Account Deletion**: Permanent account removal with password re-authentication and full data cleanup
- **Sign Out**: Complete user session termination with local cache/storage cleanup
- **Profile Updates**: User-facing profile modifications (e.g., username changes) with validation
- **Server-Side State Sync**: Account operations requiring [lib/database](../database/README.md) coordination

**Do NOT use this module for:**

- Changing internal system settings (use [lib/feature-flags](../feature-flags/README.md) or [lib/config](../config/README.md))
- Temporary user preferences (use [lib/storage's SecureStorage](../storage/README.md) directly)
- Batch operations on multiple users (single-user only)
- Authentication state changes (use [lib/auth's AuthStateManager](../auth/README.md))
- Real-time settings synchronization (use [lib/cache's QueryCache](../cache/README.md))

## Architecture & Data Flow

```
User Action (Delete/SignOut/Update)
    ↓
Client-side Validation (Zod schemas)
    ↓
Server Operation (Supabase edge function or direct DB update)
    ↓
State Cleanup (AuthStateManager, QueryCache, caches)
    ↓
Result with Validation Warning Tracking
```

**Key Pattern**: Validation warning system distinguishes client validation failure (error immediately) from client pass + server failure (returns `validationWarning` + `error`). This detects backend security issues or edge cases.

**Security-Critical Operations**: Account deletion uses password re-authentication, server-side edge function (not just DB delete), and comprehensive cleanup.

**Graceful Degradation**: Sign out continues with local cleanup even if Supabase logout fails (network issue).

## API Reference

### `deleteUserAccount(password: string): Promise<DeleteAccountResult>`

Permanently deletes the current user's account after password verification.

**Behavior:**
1. Validates password client-side (SQL injection, control characters)
2. Fetches current authenticated user (fresh, no cache)
3. Re-authenticates with password via Supabase
4. Calls edge function to delete account and related data
5. Clears all auth state and caches
6. Returns `{ success: true }` on completion

**Returns:**
```typescript
interface DeleteAccountResult {
  success: boolean;
  error?: string;
  validationWarning?: string; // Server validation failure hint
}
```

**Example:**
```typescript
import { deleteUserAccount } from "@/lib/settings";

const result = await deleteUserAccount(userPassword);
if (!result.success) {
  showError(result.error);
  if (result.validationWarning) {
    logSecurityIssue(result.validationWarning);
  }
}
```

---

### `signOutUser(): Promise<void>`

Terminates the current user session and clears all user-specific data.

**Behavior:**
1. Signs out from Supabase (if configured)
2. Clears AuthStateManager (auth keys, QueryCache, world access verification)
3. **Preserves** user preferences (theme, scale, language)

**Error Handling:** If Supabase logout fails, continues with local cleanup. Always attempts AuthStateManager cleanup.

**Example:**
```typescript
import { signOutUser } from "@/lib/settings";

try {
  await signOutUser();
  navigateTo("/login");
} catch (error) {
  console.error("Logout failed:", error);
  navigateTo("/login"); // Attempt navigation anyway
}
```

---

### `updateUsername(newUsername: string): Promise<UpdateUsernameResult>`

Updates the current user's username with validation.

**Validation Rules:**
- 3-20 characters
- Must start with letter
- Alphanumeric + underscores only
- No leading/trailing spaces

**Returns:**
```typescript
interface UpdateUsernameResult {
  success: boolean;
  error?: string;
  validationWarning?: string;
}
```

**Error Cases:**
- Empty string: `error: 'Username is required'`
- Starts with number: `error: 'Username must start with a letter'`
- Duplicate on server: `error: 'Username already taken...'`
- Server validation mismatch: `validationWarning` + `error`

**Example:**
```typescript
import { updateUsername } from "@/lib/settings";

const result = await updateUsername("newName_123");
if (!result.success) {
  showError(result.error);
} else {
  showSuccess("Username updated!");
  await refreshUserProfile();
}
```

## Interfaces

```typescript
interface DeleteAccountResult {
  success: boolean;
  error?: string;
  validationWarning?: string;
}

interface UpdateUsernameResult {
  success: boolean;
  error?: string;
  validationWarning?: string;
}
```

## Dependencies

### Internal

- `lib/auth/auth-state.ts` – AuthStateManager (state cleanup)
- `lib/auth/validation.ts` – validatePassword, validateUsername (Zod schemas)
- `lib/database/common.ts` – validateCurrentUser (server-side user lookup)
- `lib/database/users.ts` – usersDB (user operations)
- `lib/database/supabase-lazy.ts` – Supabase client (dynamic import)
- `lib/utils/logger.ts` – Logging (categorized)

### External

- `@supabase/supabase-js` – Supabase auth client

## Error Handling & Edge Cases

### Known Limitations

1. **Password Re-Authentication**: deleteUserAccount requires fresh password entry (cannot use existing session). Intentional security design but may frustrate users immediately after login.

2. **Network Failures**:
   - Account deletion fails entirely (no partial deletion)
   - Sign out continues with local cleanup (graceful)
   - Username update fails and should be retried

3. **Duplicate Username**: Server returns PostgreSQL error code 23505 (unique constraint). Client detects "duplicate" in message or code 23505 for friendly error.

4. **Backend Validation Mismatch**: Client validation passes but server rejects → function returns `validationWarning` to indicate potential security issue or schema mismatch.

5. **No Offline Support**: Account-level operations require server confirmation. No offline queue or retry mechanism exists.

### Security Considerations

- **SQL Injection Protection**: All inputs validated before sending to server (validatePassword, validateUsername from lib/auth/validation)
- **Password Re-Auth**: Account deletion re-authenticates rather than trusting session token
- **Cascading Cleanup**: Deletion clears auth state, QueryCache, and world access verification
- **Supabase Configuration Guard**: Functions check `isSupabaseConfiguredLazy()` before auth operations (supports GH Pages fallback)

## Performance Notes

- **Password Re-Authentication**: ~500ms-1s (Supabase auth check)
- **Account Deletion**: ~1-3s (edge function execution, cache clearing)
- **Username Update**: ~500-800ms (DB write only)
- **Sign Out**: ~200-400ms (localStorage/SecureStorage clearing, no server call)

No caching used for these operations (intentional for security-critical flows).

## Related Modules

- **lib/auth** – Authentication state, validation schemas
- **lib/database/users** – User DB operations (deleteCurrentUser, updateCurrentUser)
- **lib/storage** – SecureStorage for persistent user preferences (preserved during sign out)
- **lib/cache** – QueryCache (cleared during sign out/delete)

## File Breakdown

| File              | Purpose                                                | Lines |
| ----------------- | ------------------------------------------------------ | ----- |
| deleteAccount.ts  | Account deletion with password re-auth and cleanup     | ~100  |
| signOut.ts        | Session termination with graceful error handling       | ~45   |
| updateUsername.ts | Username update with duplicate/validation error handle | ~65   |
| index.ts          | Barrel export (public API)                             | 3     |
