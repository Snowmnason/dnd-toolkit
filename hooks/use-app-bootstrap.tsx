import { preloadThemes } from "@/theme";
import { Asset } from "expo-asset";
import * as Font from "expo-font";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { logger } from "../lib/utils/logger";

// Gate bootstrap logs to keep console clean by default
const BOOTSTRAP_LOGS = false;
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
        blog.debug("bootstrap", "Starting app bootstrap...");

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
        await Promise.all([Promise.all(assetPromises), sessionPromise]);

        if (isMounted) {
          setState((prev) => ({
            ...prev,
            assetsLoaded: true,
            sessionRestored: true,
            isReady: true,
          }));
          blog.info("bootstrap", "App bootstrap completed successfully");
        }
      } catch (error) {
        blog.error("bootstrap", "Bootstrap error:", error);
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
    await Font.loadAsync(customFonts);
    blog.debug("bootstrap", "Fonts loaded successfully");
  } catch (error) {
    blog.warn("bootstrap", "Font loading error (non-critical):", error);
    // Continue anyway - fonts are not critical
  }
}

async function loadImages() {
  try {
    await Asset.loadAsync(preloadImages);
    blog.debug("bootstrap", "Images loaded successfully");
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
    blog.debug("bootstrap", "Web platform assets ready");
  } else {
    blog.debug("bootstrap", "Mobile platform ready");
  }
}

async function restoreSession() {
  try {
    blog.debug("bootstrap", "Restoring Supabase session...");

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
    const SESSION_RESTORE_TIMEOUT = 5000; // 5 seconds
    
    const sessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise<{ data: { session: null }; error: any }>((resolve) =>
      setTimeout(() => {
        blog.warn("bootstrap", "Session restore timed out after 5s");
        resolve({ data: { session: null }, error: new Error("Session restore timeout") });
      }, SESSION_RESTORE_TIMEOUT)
    );

    // Race between session restore and timeout
    const {
      data: { session },
      error,
    } = await Promise.race([sessionPromise, timeoutPromise]);

    if (error) {
      blog.warn("bootstrap", "Session restore error:", error);
      return;
    }

    if (session) {
      blog.info("bootstrap", "Session restored successfully");

      // Update local auth state to match
      const { AuthStateManager } = await import("../lib/auth/auth-state");
      await AuthStateManager.setSession(session);
    } else {
      blog.info("bootstrap", "No stored session found");
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
