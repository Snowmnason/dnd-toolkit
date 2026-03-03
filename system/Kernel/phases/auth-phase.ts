/**
 * Phase 5: Auth Phase (BLOCKING)
 *
 * Responsibility:
 * Restore persisted authentication session from storage.
 * Determines if user was previously authenticated and re-establishes session.
 *
 * Input: Storage initialization from Phase 3, Services from Phase 4
 * Output: void (does not throw; failure is non-critical)
 *
 * Timing: 50-200ms expected, max 500ms timeout
 * Critical: BLOCKING — Blocks appReady to prevent race conditions
 * Failure mode: Logged as warning; app continues as unauthenticated
 *
 * What gets initialized:
 * - Session restoration from SecureStorage (if previously logged in)
 * - Auth state check (authenticated vs. guest)
 * - Session validation (still valid, not expired)
 * - Auth metadata (user ID, world access)
 *
 * Deferred to Runtime (app/_layout.tsx + background jobs):
 * - Auth strategy registration (routing layer concern)
 * - Auth health monitoring (background periodic checks)
 * - Session refresh/refresh-token logic (handled on demand)
 *
 * Depends on: SERVICES_PHASE (auth provider), STORAGE_PHASE (persisted session)
 * Enables: UI rendering with correct auth state, offline mutation handling
 *
 * Used by: system/Kernel/app-kernel.ts (Phase 5, blocking)
 * Also: lib/auth/auth-manager, lib/auth/auth-state, hooks/auth
 */

/**
 * Execute auth phase
 *
 * Restores auth session from encrypted storage to reestablish authentication.
 * Non-critical: failures won't block app startup — user continues in guest mode.
 * The orchestrator (app-kernel) marks authReady via runPhase.
 */
export async function authPhase(): Promise<void> {
  const { logger } = await import("@/lib/utils");

  try {
    // ─── Restore Auth Session ───────────────────────────────────────
    // On web, session persistence is disabled for security, so we manually restore it
    // This MUST happen BEFORE any authenticated requests
    const { SessionAdapter } = await import("@/system/Services");
    const { authRestoreSession } = await import(
      "@/lib/middleware/services/auth-service"
    );

    logger.category("bootstrap").debug("Restoring auth session from storage...");
    const sessionData = await SessionAdapter.restoreSession();

    if (sessionData) {
      // Restore session with auth provider via middleware
      const restored = await authRestoreSession(sessionData);
      logger
        .category("bootstrap")
        .info("✅ Auth session check complete", { authenticated: restored });
    } else {
      logger
        .category("bootstrap")
        .debug("No persisted session found, continuing as guest");
    }
  } catch (error) {
    logger
      .category("bootstrap")
      .warn("Auth session restore failed (non-critical, guest mode)", {
        error: (error as Error).message,
      });
    // Don't throw — auth failure is non-critical, user continues in guest mode
  }
}

