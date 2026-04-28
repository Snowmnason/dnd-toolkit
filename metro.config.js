// Metro configuration for D&D Toolkit
// Uses Sentry's Expo Metro config as base, with room for custom configuration
//
// To add custom Metro settings, modify the config object below.
// See: https://docs.expo.dev/guides/customizing-metro/

const path = require("path");
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

// Get Sentry's Expo Metro configuration
const config = getSentryExpoConfig(__dirname);

// ─── Metro Blocklist ─────────────────────────────────────────────────────────
// Prevent Metro from watching or resolving these directories.
// They are generated build artifacts, tooling config, tests, or documentation —
// none of which the app bundle imports at runtime.
//
// Blocking them reduces file-system crawl pressure on every hot-reload cycle,
// especially on Windows where NTFS change notifications accumulate quickly.
//
// NEVER block: app/, components/, hooks/, lib/, system/, assets/, theme/,
//              maps/, providers/, contexts/, config/, type-definitions/,
//              pure-algo-immutables/, validation/, Screens/, AppScreens/, .expo/
// ─────────────────────────────────────────────────────────────────────────────
const BLOCKED_DIRS = [
  "dist",               // Web export output
  "dist-desktop",       // Desktop packager output
  "desktop/dist",       // Electron compiled TypeScript output
  "android/build",      // Gradle native build artifacts
  "android/.gradle",    // Gradle daemon cache
  "supabase",           // DB migrations, edge functions, SQL — not imported at runtime
  "scripts",            // Build/deploy scripts — never imported by the app
  "docs",               // Documentation only
  "__mocks__",          // Jest mock files — not used at runtime
  "__tests__",          // Test files — not used at runtime
  ".github",            // CI/CD workflows and config
  ".idea",              // JetBrains IDE config
  ".vscode",            // VS Code workspace config
];

// Build cross-platform regex patterns for each blocked directory.
// Splits on the platform separator so each segment can be individually escaped,
// then joins with [/\\] to match both Windows (\) and Unix (/) path styles.
const SEP = "[/\\\\]";
const blockPatterns = BLOCKED_DIRS.map((dir) => {
  const abs = path.resolve(__dirname, dir);
  const escaped = abs
    .split(path.sep)
    .map((segment) => segment.replace(/[.*+?^${}()|[\]]/g, "\\$&"))
    .join(SEP);
  // eslint-disable-next-line security/detect-non-literal-regexp
  return new RegExp(`^${escaped}(${SEP}|$)`);
});

// Merge with Sentry's existing blockList rather than replacing it.
const existingBlockList = config.resolver?.blockList ?? [];
const existingArray = Array.isArray(existingBlockList)
  ? existingBlockList
  : [existingBlockList];

config.resolver = {
  ...config.resolver,
  blockList: [...existingArray, ...blockPatterns],
};

module.exports = config;
