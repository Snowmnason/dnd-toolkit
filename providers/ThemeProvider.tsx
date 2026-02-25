import { getPrivacyStorageBackend, STORAGE_KEYS } from "@/lib/storage";
import { logger } from "@/lib/utils/logger";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { allThemes, ThemeFamilyName } from "../theme/themeRegistry";
import { ThemeTokens, TokenName } from "../theme/tokens";
import { tone } from "../theme/ultils/colorUtils";

export type ThemeFamily = ThemeFamilyName;
export type ThemeMode = "light" | "dark";

interface ThemeContextValue {
  theme: ThemeTokens;
  family: ThemeFamily;
  mode: ThemeMode;
  setFamily: (f: ThemeFamily) => void;
  setMode: (m: ThemeMode) => void;
  setTheme: (f: ThemeFamily, m: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * 🌈 ThemeProvider
 * Wraps the entire app and manages the active theme family + mode.
 * Automatically loads and persists theme preferences from SecureStorage.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [family, setFamilyState] = useState<ThemeFamily>("classic");
  const [mode, setModeState] = useState<ThemeMode>("dark");
  const [isLoading, setIsLoading] = useState(true);

  // Cache backend references at function scope to avoid repeated lookups
  const familyBackend = useMemo(
    () => getPrivacyStorageBackend(STORAGE_KEYS.THEME_PREFERENCE),
    [],
  );
  const modeBackend = useMemo(
    () => getPrivacyStorageBackend(STORAGE_KEYS.THEME_MODE),
    [],
  );

  // Load saved theme preferences on mount
  useEffect(() => {
    const loadThemePreferences = async () => {
      try {
        const [savedFamily, savedMode] = await Promise.all([
          familyBackend.getItem(STORAGE_KEYS.THEME_PREFERENCE),
          modeBackend.getItem(STORAGE_KEYS.THEME_MODE),
        ]);

        if (savedFamily && allThemes[savedFamily as ThemeFamily]) {
          setFamilyState(savedFamily as ThemeFamily);
        } else {
          setFamilyState("classic");
          familyBackend
            .setItem(STORAGE_KEYS.THEME_PREFERENCE, "classic")
            .catch((e) =>
              logger
                .category("ui")
                .error("Failed to save corrected theme preference", {
                  error: String(e),
                }),
            );
          logger
            .category("ui")
            .debug("ThemeProvider: invalid saved family, defaulted to classic");
        }
        if (savedMode && (savedMode === "light" || savedMode === "dark")) {
          setModeState(savedMode as ThemeMode);
          logger
            .category("ui")
            .debug("ThemeProvider: loaded saved mode", { mode: savedMode });
        } else {
          setModeState("dark");
          modeBackend.setItem(STORAGE_KEYS.THEME_MODE, "dark").catch((e) =>
            logger.category("ui").error("Failed to save corrected theme mode", {
              error: String(e),
            }),
          );
          logger
            .category("ui")
            .debug("ThemeProvider: invalid saved mode, defaulted to dark");
        }
      } catch (error) {
        logger
          .category("ui")
          .error("ThemeProvider: failed to load preferences", {
            error: String(error),
          });
      } finally {
        setIsLoading(false);
      }
    };

    loadThemePreferences();
  }, [familyBackend, modeBackend]);

  // Resolve active theme tokens from family + mode
  const theme: ThemeTokens = useMemo(() => {
    /* eslint-disable-next-line security/detect-object-injection */
    const selectedFamily = allThemes[family];
    /* eslint-disable-next-line security/detect-object-injection */
    return selectedFamily?.[mode] ?? allThemes.classic.dark;
  }, [family, mode]);

  /** Update family and persist */
  const setFamily = useCallback(
    (f: ThemeFamily) => {
      /* eslint-disable-next-line security/detect-object-injection */
      if (!allThemes[f]) {
        logger.category("ui").warn("ThemeProvider: unknown theme", {
          requested: f,
          fallback: "classic",
        });
        setFamilyState("classic");
        familyBackend
          .setItem(STORAGE_KEYS.THEME_PREFERENCE, "classic")
          .catch((e) =>
            logger
              .category("ui")
              .error("Failed to save theme preference", { error: String(e) }),
          );
      } else {
        setFamilyState(f);
        logger
          .category("ui")
          .debug("ThemeProvider: family changed", { family: f });
        familyBackend
          .setItem(STORAGE_KEYS.THEME_PREFERENCE, f)
          .catch((e) =>
            logger
              .category("ui")
              .error("Failed to save theme preference", { error: String(e) }),
          );
      }
    },
    [familyBackend],
  );

  /** Update mode and persist */
  const setMode = useCallback(
    (m: ThemeMode) => {
      setModeState(m);
      logger.category("ui").debug("ThemeProvider: mode changed", { mode: m });
      modeBackend
        .setItem(STORAGE_KEYS.THEME_MODE, m)
        .catch((e) =>
          logger
            .category("ui")
            .error("Failed to save theme mode", { error: String(e) }),
        );
    },
    [modeBackend],
  );

  /** Update both family + mode and persist */
  const setTheme = useCallback(
    (f: ThemeFamily, m: ThemeMode) => {
      /* eslint-disable-next-line security/detect-object-injection */
      if (!allThemes[f]) {
        logger.category("ui").warn("ThemeProvider: unknown theme", {
          requested: f,
          fallback: "classic",
        });
        familyBackend
          .setItem(STORAGE_KEYS.THEME_PREFERENCE, "classic")
          .catch((e) =>
            logger
              .category("ui")
              .error("Failed to save theme preference", { error: String(e) }),
          );
      } else {
        setFamilyState(f);
        familyBackend
          .setItem(STORAGE_KEYS.THEME_PREFERENCE, f)
          .catch((e) =>
            logger
              .category("ui")
              .error("Failed to save theme preference", { error: String(e) }),
          );
      }
      setModeState(m);
      logger.category("ui").debug("ThemeProvider: theme changed", {
        family: f || "classic",
        mode: m,
      });
      modeBackend
        .setItem(STORAGE_KEYS.THEME_MODE, m)
        .catch((e) =>
          logger
            .category("ui")
            .error("Failed to save theme mode", { error: String(e) }),
        );
    },
    [familyBackend, modeBackend],
  );

  // Memoize context value to prevent unnecessary re-renders of all consumers
  const contextValue = useMemo(
    () => ({ theme, family, mode, setFamily, setMode, setTheme }),
    [theme, family, mode, setFamily, setMode, setTheme],
  );

  // On web, sync ALL theme tokens to CSS variables for instant visual updates in RN Web
  // This allows components to reference `var(--token)` and update without remounts
  useEffect(() => {
    if (typeof document === "undefined") return;
    try {
      const root = document.documentElement;
      const set = (name: string, value: string) =>
        root.style.setProperty(name, value);

      // Sync every theme token to a CSS variable: --background, --surface, etc.
      Object.entries(theme).forEach(([key, value]) => {
        if (!value) return;
        set(`--${key}` as `--${TokenName}`, value);
      });

      // Convenience aliases for older callers (keep for backward-compat)
      set("--bg", theme.background);
      set(
        "--surfaceAlt",
        tone(theme.surface, "alt", undefined, undefined, theme),
      );
      set(
        "--accentAlt",
        tone(theme.accent, "alt", undefined, undefined, theme),
      );
    } catch {
      // no-op on native or if document is not accessible
    }
  }, [theme]);

  // Don't render children until theme is loaded to prevent flash of wrong theme
  if (isLoading) {
    return null;
  }

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * 🎨 Hook: useTheme
 * Access the current theme + controls anywhere in the app.
 */
export function UseTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("UseTheme must be used within a ThemeProvider");
  return ctx;
}
