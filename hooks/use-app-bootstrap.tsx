import { preloadThemes } from "@/theme";
import * as Font from "expo-font";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { logger } from "../lib/utils/logger";

// Bootstrap configuration
const BOOTSTRAP_LOGS = true; // Enable logs for production debugging - helps diagnose bootstrap issues
const SESSION_RESTORE_TIMEOUT = 5000; // 5 seconds - faster timeout, let app boot even if session is slow
const FONT_LOADING_TIMEOUT = 3000; // 3 seconds - timeout for font loading (non-critical)

const blog = {
  debug: (...args: any[]) => {
    if (BOOTSTRAP_LOGS) logger.debug(...args);
  },
  info: (...args: any[]) => {
    if (BOOTSTRAP_LOGS) logger.info(...args);
  },
  warn: (...args: any[]) => {
    if (BOOTSTRAP_LOGS) logger.warn(...args);
  },
  error: (...args: any[]) => {
    if (BOOTSTRAP_LOGS) logger.error(...args);
  },
};

// Critical fonts only (loaded during bootstrap)
const criticalFonts = {
  GrenzeGotisch: require("../assets/fonts/GrenzeGotisch.ttf"),
};

// Non-critical fonts (loaded on-demand when needed)
export const lazyFonts = {
  Cyberpunk: require("../assets/fonts/Cyberpunk.ttf"),
};

// Images are now loaded lazily on-demand, not during bootstrap

export interface AppBootstrapState {
  assetsLoaded: boolean;
  sessionRestored: boolean;
  isReady: boolean;
  error: Error | null;
}

export function useAppBootstrap() {
  const [state, setState] = useState<AppBootstrapState>({
    assetsLoaded: false,
    sessionRestored: false,
    isReady: false,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      try {
        blog.debug("bootstrap", "🚀 Starting app bootstrap...");
        const bootstrapStartTime = Date.now();
        const metrics = {
          fonts: 0,
          themes: 0,
          platform: 0,
        };

        // Step 1: Load ONLY critical assets (< 500ms target)
        blog.debug("bootstrap", "⏳ Loading critical assets...");
        
        const fontsStart = Date.now();
        await loadFonts();
        metrics.fonts = Date.now() - fontsStart;

        const themesStart = Date.now();
        await preloadThemes();
        metrics.themes = Date.now() - themesStart;

        const platformStart = Date.now();
        await loadPlatformAssets();
        metrics.platform = Date.now() - platformStart;

        const bootstrapTime = Date.now() - bootstrapStartTime;
        
        // ✅ Mark as ready IMMEDIATELY - don't block on session or images
        if (isMounted) {
          setState((prev) => ({
            ...prev,
            assetsLoaded: true,
            isReady: true, // ✨ App is ready to use now
          }));
          blog.info("bootstrap", `✅ Critical bootstrap in ${bootstrapTime}ms`, {
            breakdown: metrics,
          });
        }

        // Step 2: Restore session in background (non-blocking)
        // Auth screens will naturally wait for this via AuthStateManager checks
        restoreSession().then(() => {
          if (isMounted) {
            setState((prev) => ({
              ...prev,
              sessionRestored: true,
            }));
            blog.info("bootstrap", `✅ Session restored in ${Date.now() - bootstrapStartTime}ms`);
          }
        }).catch((err) => {
          blog.warn("bootstrap", "Background session restore failed:", err);
          // Still mark as restored so app doesn't hang waiting
          if (isMounted) {
            setState((prev) => ({
              ...prev,
              sessionRestored: true,
            }));
          }
        });

      } catch (error) {
        blog.error("bootstrap", "❌ Bootstrap error:", error);
        if (isMounted) {
          setState((prev) => ({
            ...prev,
            error: error as Error,
            // Still mark as ready to allow app to continue
            assetsLoaded: true,
            sessionRestored: true,
            isReady: true,
          }));
        }
      }
    }

    bootstrap();

    return () => {
      isMounted = false;
    };
  }, []);

  return state;
}

async function loadFonts() {
  // On web, skip custom font loading during bootstrap - they'll be loaded when needed
  // This prevents CORS/network issues from blocking the app
  if (Platform.OS === "web") {
    blog.debug("bootstrap", "🌐 Skipping font preload on web (loaded on-demand)");
    return;
  }
  
  try {
    const startTime = Date.now();
    
    // Wrap font loading in a timeout to prevent indefinite hanging
    let timedOut = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    
    const fontPromise = Font.loadAsync(criticalFonts); // Only critical fonts
    const timeoutPromise = new Promise<void>((_, reject) => {
      timeoutId = setTimeout(() => {
        timedOut = true;
        reject(new Error(`Font loading timeout after ${FONT_LOADING_TIMEOUT}ms`));
      }, FONT_LOADING_TIMEOUT);
    });

    try {
      await Promise.race([fontPromise, timeoutPromise]);
      if (timeoutId) clearTimeout(timeoutId); // ✅ Clean up the timer
    } catch (e) {
      if (timeoutId) clearTimeout(timeoutId); // ✅ Clean up here too
      if (timedOut) {
        const elapsed = Date.now() - startTime;
        blog.warn("bootstrap", `⏱️ Font loading timed out after ${FONT_LOADING_TIMEOUT}ms (total: ${elapsed}ms)`);
      } else {
        throw e;
      }
    }

    if (!timedOut) {
      const elapsed = Date.now() - startTime;
      blog.debug("bootstrap", `✅ Critical fonts loaded in ${elapsed}ms`);
    }
  } catch (error) {
    blog.warn("bootstrap", "⚠️ Font loading error (non-critical):", error);
    // Continue anyway - fonts are not critical
  }
}

// Lazy load non-critical fonts on-demand
export async function loadCyberpunkFont() {
  try {
    if (await Font.isLoaded('Cyberpunk')) {
      return;
    }
    blog.debug("fonts", "Loading Cyberpunk font on-demand...");
    await Font.loadAsync(lazyFonts);
    blog.debug("fonts", "✅ Cyberpunk font loaded");
  } catch (error) {
    blog.warn("fonts", "Failed to load Cyberpunk font:", error);
  }
}

async function loadPlatformAssets() {
  if (Platform.OS === "web") {
    // Skia is now loaded in index.tsx before React renders
    // No delay needed - let the app boot fast
    blog.debug("bootstrap", "🌐 Web platform ready");
  } else {
    blog.debug("bootstrap", `📱 ${Platform.OS} platform ready`);
  }
}

async function restoreSession() {
  try {
    blog.debug("bootstrap", "Restoring session...");
    const sessionStartTime = Date.now();

    // Import dependencies
    const { supabase, isSupabaseConfigured } = await import(
      "../lib/database/supabase"
    );
    const { AuthStateManager } = await import("../lib/auth/auth-state");

    if (!isSupabaseConfigured()) {
      blog.warn(
        "bootstrap",
        "Supabase not configured, skipping session restore"
      );
      return;
    }

    // ✅ Validate auth cache on startup
    blog.debug("bootstrap", "Validating cached auth state...");
    try {
      const authState = await AuthStateManager.getAuthState();
      blog.debug("bootstrap", "✅ Auth state validation passed", { hasAccount: authState.hasAccount });
    } catch (validationError) {
      blog.warn("bootstrap", "Auth state validation encountered an issue:", validationError);
      // Continue anyway - validation errors are logged but non-fatal
    }

    // ✅ Try cached session first (stale-while-revalidate pattern)
    const authState = await AuthStateManager.getAuthState();
    if (authState.hasAccount) {
      const cacheTime = Date.now() - sessionStartTime;
      blog.info("bootstrap", `✅ Using cached auth state (${cacheTime}ms)`);
      
      // Revalidate in background (don't await)
      validateSessionInBackground(supabase, AuthStateManager, sessionStartTime);
      return;
    }

    // Cache miss - fetch from Supabase with timeout
    let timedOut = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    
    const sessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise<{ data: { session: null }; error: any }>((resolve) => {
      timeoutId = setTimeout(() => {
        timedOut = true;
        const elapsed = Date.now() - sessionStartTime;
        blog.warn("bootstrap", `⏱️ Session restore timed out after ${SESSION_RESTORE_TIMEOUT}ms (total: ${elapsed}ms)`);
        resolve({ data: { session: null }, error: new Error("Session restore timeout") });
      }, SESSION_RESTORE_TIMEOUT);
    });

    // Race between session restore and timeout
    const {
      data: { session },
      error,
    } = await Promise.race([sessionPromise, timeoutPromise]);

    if (timeoutId) clearTimeout(timeoutId); // ✅ Clean up timer
    const totalTime = Date.now() - sessionStartTime;

    // If we timed out, ignore late session restoration results
    if (timedOut) {
      blog.warn("bootstrap", `Skipping session restoration - timed out after ${totalTime}ms`);
      setupAuthListener(supabase);
      return;
    }

    if (error) {
      blog.warn("bootstrap", `Session restore error (${totalTime}ms):`, error);
      setupAuthListener(supabase);
      return;
    }

    if (session) {
      blog.info("bootstrap", `✅ Session restored successfully in ${totalTime}ms`);
      await AuthStateManager.setSession(session);
    } else {
      blog.info("bootstrap", `⚠️ No stored session found (checked in ${totalTime}ms)`);
    }

    setupAuthListener(supabase);
  } catch (error) {
    blog.error("bootstrap", "Session restore error:", error);
    // Don't throw - app can still function without session
  }
}

// Background session revalidation (stale-while-revalidate)
async function validateSessionInBackground(
  supabase: any,
  AuthStateManager: any,
  startTime: number
) {
  try {
    blog.debug("bootstrap", "Revalidating cached session in background...");
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      blog.warn("bootstrap", "Background session validation failed:", error);
      return;
    }

    if (session) {
      await AuthStateManager.setSession(session);
      const totalTime = Date.now() - startTime;
      blog.debug("bootstrap", `✅ Session revalidated in background (${totalTime}ms)`);
    } else {
      // Session expired, clear cache
      await AuthStateManager.clearAuthState();
      blog.info("bootstrap", "Session expired, cleared cache");
    }

    setupAuthListener(supabase);
  } catch (error) {
    blog.warn("bootstrap", "Background session validation error:", error);
  }
}

// Set up auth state change listener
function setupAuthListener(supabase: any) {
  supabase.auth.onAuthStateChange(async (event: string, session: any) => {
    blog.debug("bootstrap", "Auth state changed:", event);

    const { AuthStateManager } = await import("../lib/auth/auth-state");

    if (session) {
      await AuthStateManager.setSession(session);
    } else {
      await AuthStateManager.clearAuthState();
    }
  });
}
