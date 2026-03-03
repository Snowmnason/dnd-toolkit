/**
 * Session Adapter — System-level session persistence
 *
 * Generic, app-agnostic session storage for bootstrap and runtime.
 * Handles saving, restoring, and clearing auth sessions from encrypted storage.
 *
 * This adapter is INFRASTRUCTURE ONLY:
 * - Reads/writes session tokens to SecureStorage
 * - Validates session schema version
 * - Platform-aware (web manual restore vs native built-in)
 * - Does NOT contain domain logic (no user accounts, no routing, no flags)
 *
 * Used by:
 * - system/Kernel/phases/auth-phase.ts (bootstrap: restore session)
 * - lib/middleware/services/auth-service.ts (runtime: save/clear on sign-in/sign-out)
 */

import { logger } from "@/lib/utils/logger";
import { STORAGE_KEYS } from "@/maps";
import { SecureStorage } from "@/system/Storage";

// ─── Session Schema ────────────────────────────────────────────────

/**
 * Schema version for stored session data.
 * Increment when breaking changes are made to PersistedSessionData shape.
 */
const SESSION_SCHEMA_VERSION = 1;

/**
 * Minimal session data persisted to storage.
 * Only serializable tokens needed to restore a provider session.
 */
export interface PersistedSessionData {
  version: number;
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  expires_in?: number;
  token_type?: string;
  user?: {
    id: string;
    email?: string;
  };
}

// ─── Session Adapter ───────────────────────────────────────────────

export const SessionAdapter = {
  /**
   * Save session tokens to encrypted storage.
   *
   * Extracts only serializable fields needed for restoration.
   * Called after successful sign-in to persist the session.
   *
   * @param session - Raw session from auth provider (any shape)
   */
  async saveSession(session: any): Promise<void> {
    try {
      if (!session) {
        logger.category("auth").debug("saveSession: null session, clearing");
        await this.clearSession();
        return;
      }

      // Extract only essential, serializable fields
      const persistedData: PersistedSessionData = {
        version: SESSION_SCHEMA_VERSION,
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
        expires_in: session.expires_in,
        token_type: session.token_type,
        user: session.user
          ? { id: session.user.id, email: session.user.email }
          : undefined,
      };

      await SecureStorage.setJSON(STORAGE_KEYS.AUTH_SESSION, persistedData);

      logger.category("auth").info("Session saved to encrypted storage", {
        userId: session.user?.id,
        hasAccessToken: !!session.access_token,
        hasRefreshToken: !!session.refresh_token,
      });
    } catch (error) {
      logger.category("auth").error("Failed to save session", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  /**
   * Restore session data from encrypted storage.
   *
   * Reads persisted tokens, validates schema version, and returns
   * the raw data for the auth provider to restore from.
   *
   * Platform-aware:
   * - Web: manual restore required (persistSession=false for security)
   * - Native: skips (mobile uses provider's built-in storage)
   *
   * @returns Persisted session data, or null if no valid session found
   */
  async restoreSession(): Promise<PersistedSessionData | null> {
    try {
      // Only restore on web (mobile uses provider's built-in async storage)
      if (typeof window === "undefined") {
        logger
          .category("auth")
          .debug("Skipping session restore on native (uses platform storage)");
        return null;
      }

      const sessionData =
        await SecureStorage.getJSON<PersistedSessionData>(
          STORAGE_KEYS.AUTH_SESSION,
        );

      if (!sessionData) {
        logger.category("auth").debug("No persisted session found in storage");
        return null;
      }

      // Validate schema version
      const storedVersion = sessionData.version || 0;
      if (storedVersion !== SESSION_SCHEMA_VERSION) {
        logger.category("auth").warn(
          `Session schema mismatch (stored: ${storedVersion}, current: ${SESSION_SCHEMA_VERSION}). Clearing stale session.`,
        );
        await this.clearSession();
        return null;
      }

      // Validate minimum required fields
      if (!sessionData.access_token) {
        logger
          .category("auth")
          .warn("Persisted session missing access_token, clearing");
        await this.clearSession();
        return null;
      }

      logger.category("auth").info("Session restored from storage", {
        userId: sessionData.user?.id,
        hasRefreshToken: !!sessionData.refresh_token,
      });

      return sessionData;
    } catch (error) {
      logger.category("auth").error("Failed to restore session", {
        error: error instanceof Error ? error.message : String(error),
      });

      // Clear corrupted data
      try {
        await this.clearSession();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_cleanupError) {
        // Ignore cleanup errors
      }

      return null;
    }
  },

  /**
   * Clear persisted session from storage.
   *
   * Called on sign-out, session expiry, or schema mismatch.
   */
  async clearSession(): Promise<void> {
    try {
      await SecureStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
      logger.category("auth").debug("Session cleared from storage");
    } catch (error) {
      logger.category("auth").error("Failed to clear session", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  /**
   * Check if a persisted session exists without fully loading it.
   * Lightweight check for bootstrap decisions.
   *
   * @returns true if a session key exists in storage
   */
  async hasPersistedSession(): Promise<boolean> {
    try {
      // On native, assume provider handles persistence
      if (typeof window === "undefined") {
        return false;
      }

      const data = await SecureStorage.getItem(STORAGE_KEYS.AUTH_SESSION);
      return data !== null && data !== undefined;
    } catch {
      return false;
    }
  },
};
