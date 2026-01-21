/**
 * useSystemThemeSync Hook
 *
 * Example pattern for safely consuming the Electron API's onThemeChange
 * with proper cleanup function usage to prevent memory leaks.
 *
 * This demonstrates the recommended approach for any component that needs
 * to respond to system-level theme changes (OS light/dark mode).
 *
 * Usage:
 * ```tsx
 * function MyComponent() {
 *   const { systemTheme, isElectron } = useSystemThemeSync();
 *
 *   if (!isElectron) return null; // Skip on web
 *
 *   return <div>System theme: {systemTheme}</div>;
 * }
 * ```
 */

/// <reference lib="dom" />

import { useEffect, useState } from "react";

interface UseSystemThemeSyncOptions {
  /** Callback when theme changes (optional - for additional side effects) */
  onThemeChange?: (theme: "light" | "dark") => void;
  /** Log theme changes for debugging (default: false) */
  debug?: boolean;
}

interface UseSystemThemeSyncResult {
  /** Current system theme ('light' or 'dark') */
  systemTheme: "light" | "dark" | null;
  /** Whether running in Electron */
  isElectron: boolean;
  /** Whether theme has been loaded from system */
  isLoaded: boolean;
}

/**
 * Hook to sync with system theme changes and track component lifecycle
 *
 * CRITICAL: This hook demonstrates the proper cleanup pattern required for
 * window.electronAPI.onThemeChange() to prevent memory leaks.
 *
 * Memory leak prevention:
 * 1. Store cleanup function returned by onThemeChange()
 * 2. Call cleanup function in useEffect cleanup
 * 3. This removes the IPC listener when component unmounts
 * 4. Prevents listener accumulation on re-mounts
 */
export function useSystemThemeSync(
  options: UseSystemThemeSyncOptions = {},
): UseSystemThemeSyncResult {
  const { onThemeChange, debug = false } = options;
  const [systemTheme, setSystemTheme] = useState<"light" | "dark" | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Check if running in Electron
  const isElectron =
    typeof window !== "undefined" && !!(window as any).electronAPI;

  useEffect(() => {
    if (!isElectron) {
      if (debug) console.log("[useSystemThemeSync] Not in Electron, skipping");
      return;
    }

    let cleanup: (() => void) | null = null;

    // IIFE to handle async initialization
    (async () => {
      try {
        // Get initial theme from system
        const initialTheme = await (window as any).electronAPI.getSystemTheme();
        setSystemTheme(initialTheme);
        setIsLoaded(true);

        if (debug) {
          console.log("[useSystemThemeSync] Initial theme:", initialTheme);
        }

        // Listen for theme changes
        // CRITICAL: onThemeChange() returns a cleanup function
        cleanup = (window as any).electronAPI.onThemeChange(
          (theme: "light" | "dark") => {
            if (debug) {
              console.log("[useSystemThemeSync] Theme changed to:", theme);
            }
            setSystemTheme(theme);
            onThemeChange?.(theme);
          },
        );

        if (debug) {
          console.log("[useSystemThemeSync] Listener registered");
        }
      } catch (error) {
        console.error("[useSystemThemeSync] Error initializing:", error);
        setIsLoaded(true); // Still mark as loaded even if there's an error
      }
    })();

    // Cleanup function: called when component unmounts or dependencies change
    return () => {
      if (cleanup) {
        if (debug) {
          console.log("[useSystemThemeSync] Calling cleanup function");
        }
        cleanup();
      }
    };
  }, [isElectron, onThemeChange, debug]);

  return {
    systemTheme,
    isElectron,
    isLoaded,
  };
}
