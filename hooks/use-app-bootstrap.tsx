import { preloadThemes } from "@/theme";
import { Asset } from "expo-asset";
import * as Font from "expo-font";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { logger } from "../lib/utils/logger";

// Bootstrap configuration
const BOOTSTRAP_LOGS = true; // Enable logs for production debugging - helps diagnose bootstrap issues
const SESSION_RESTORE_TIMEOUT = 5000; // 5 seconds - timeout for Supabase session restoration

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

// Put all shared fonts here
// Note: Eurostile is only loaded on-demand when Cyberpunk theme is selected
// to avoid unnecessary font download warnings on web
const customFonts = {
  GrenzeGotisch: require("../assets/fonts/GrenzeGotisch.ttf"),
  Cyberpunk: require("../assets/fonts/Cyberpunk.ttf"),
};

// Put all shared images here
const preloadImages = [
  require("../assets/images/Miku.png"),
  require("../assets/images/load.gif"),
];

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

        // Step 1: Load assets in parallel
        const assetPromises = [
          loadFonts(),
          loadImages(),
          loadPlatformAssets(),
          preloadThemes(),
        ];

        // Step 2: Restore Supabase session in parallel with assets
        const sessionPromise = restoreSession();

        // Wait for both assets and session
        blog.debug("bootstrap", "⏳ Waiting for assets and session restoration...");
        await Promise.all([Promise.all(assetPromises), sessionPromise]);

        const bootstrapTime = Date.now() - bootstrapStartTime;
        if (isMounted) {
          setState((prev) => ({
            ...prev,
            assetsLoaded: true,
            sessionRestored: true,
            isReady: true,
          }));
          blog.info("bootstrap", `✅ App bootstrap completed successfully in ${bootstrapTime}ms`);
        }
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
  try {
    const startTime = Date.now();
    await Font.loadAsync(customFonts);
    const elapsed = Date.now() - startTime;
    blog.debug("bootstrap", `✅ Fonts loaded in ${elapsed}ms`);
  } catch (error) {
    blog.warn("bootstrap", "Font loading error (non-critical):", error);
    // Continue anyway - fonts are not critical
  }
}

async function loadImages() {
  try {
    const startTime = Date.now();
    await Asset.loadAsync(preloadImages);
    const elapsed = Date.now() - startTime;
    blog.debug("bootstrap", `✅ Images loaded in ${elapsed}ms`);
  } catch (error) {
    blog.warn("bootstrap", "Image loading error (non-critical):", error);
    // Continue anyway - these images are not critical
  }
}

async function loadPlatformAssets() {
  if (Platform.OS === "web") {
    // Skia is now loaded in index.tsx before React renders
    // Just add a small delay for web stability
    await new Promise((resolve) => setTimeout(resolve, 200));
    blog.debug("bootstrap", "🌐 Web platform assets ready (200ms)");
  } else {
    blog.debug("bootstrap", `📱 ${Platform.OS} platform ready`);
  }
}

async function restoreSession() {
  try {
    blog.debug("bootstrap", "Restoring Supabase session...");
    const sessionStartTime = Date.now();

    // Import supabase dynamically to avoid circular dependencies
    const { supabase, isSupabaseConfigured } = await import(
      "../lib/database/supabase"
    );

    if (!isSupabaseConfigured()) {
      blog.warn(
        "bootstrap",
        "Supabase not configured, skipping session restore"
      );
      return;
    }

    // Wrap session restoration in a timeout to prevent indefinite hanging
    // If token refresh fails or hangs, we still let the app boot
    let timedOut = false;
    
    const sessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise<{ data: { session: null }; error: any }>((resolve) =>
      setTimeout(() => {
        timedOut = true;
        const elapsed = Date.now() - sessionStartTime;
        blog.warn("bootstrap", `⏱️ Session restore timed out after ${SESSION_RESTORE_TIMEOUT}ms (total: ${elapsed}ms)`);
        resolve({ data: { session: null }, error: new Error("Session restore timeout") });
      }, SESSION_RESTORE_TIMEOUT)
    );

    // Race between session restore and timeout
    const {
      data: { session },
      error,
    } = await Promise.race([sessionPromise, timeoutPromise]);

    const totalTime = Date.now() - sessionStartTime;

    // If we timed out, ignore late session restoration results
    if (timedOut) {
      blog.warn("bootstrap", `Skipping session restoration - timed out after ${totalTime}ms`);
      // Set up listener anyway for future auth changes
      supabase.auth.onAuthStateChange(async (event: string, session: any) => {
        blog.debug("bootstrap", "Auth state changed:", event);
        const { AuthStateManager } = await import("../lib/auth/auth-state");
        if (session) {
          await AuthStateManager.setSession(session);
        } else {
          await AuthStateManager.clearAuthState();
        }
      });
      return;
    }

    if (error) {
      blog.warn("bootstrap", `Session restore error (${totalTime}ms):`, error);
      return;
    }

    if (session) {
      blog.info("bootstrap", `✅ Session restored successfully in ${totalTime}ms`);

      // Update local auth state to match
      const { AuthStateManager } = await import("../lib/auth/auth-state");
      await AuthStateManager.setSession(session);
    } else {
      blog.info("bootstrap", `⚠️ No stored session found (checked in ${totalTime}ms)`);
    }

    // Set up auth state change listener for future changes
    supabase.auth.onAuthStateChange(async (event: string, session: any) => {
      blog.debug("bootstrap", "Auth state changed:", event);

      const { AuthStateManager } = await import("../lib/auth/auth-state");

      if (session) {
        await AuthStateManager.setSession(session);
      } else {
        await AuthStateManager.clearAuthState();
      }
    });
  } catch (error) {
    blog.error("bootstrap", "Session restore error:", error);
    // Don't throw - app can still function without session
  }
}
