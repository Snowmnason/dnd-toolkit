/**
 * AppSettings Version Migrations
 *
 * Handles schema evolution for AppSettings as new versions are released.
 * Each migration function transforms config from an old version to the current version schema.
 *
 * **Design:**
 * - Migrations are cumulative: v1→v2, v2→v3, etc. through v{CURRENT_VERSION}
 * - Version numbers are simple integers; no semantic versioning
 * - Each migration function accepts unknown input (defensive) and returns typed AppSettings
 * - Migrations must handle missing required fields gracefully (set defaults or throw)
 * - Old migrations are kept indefinitely; don't delete them (rollback support)
 *
 * **Adding a new migration:**
 * 1. Increment CURRENT_CONFIG_VERSION
 * 2. Create migrateVxToVy() function
 * 3. Add to MIGRATION_CHAIN in correct order
 * 4. Update AppSettings interface in loader.ts
 * 5. Update config files (appsettings.json, appsettings.dev.json)
 * 6. Document the breaking change in comments
 *
 * **Example:**
 * If v1 → v2 adds a required field `newConfig.analytics.enabled`:
 * ```ts
 * export const migrateV1ToV2 = (config: any): any => ({
 *   ...config,
 *   analytics: {
 *     ...config.analytics,
 *     enabled: config.analytics?.enabled ?? false, // Default: disabled
 *   },
 * });
 * ```
 */

import type { AppSettings } from "./loader";

/**
 * Current schema version. Increment when making breaking changes to AppSettings.
 *
 * Breaking changes: new required field, removed field, type change, rename
 * Non-breaking: optional field with default, new feature flag, performance improvement
 */
export const CURRENT_CONFIG_VERSION = 1;

/**
 * Migration from v1 to v2 (stub for future use)
 *
 * Currently a no-op placeholder. Add logic when v2 schema is introduced.
 * Example changes: add new required section, rename field, change type
 */
export const migrateV1ToV2 = (config: any): any => {
  // No changes for v1→v2 yet; this is a placeholder for future schema evolution
  return config;
};

/**
 * Registry of migration functions in order.
 * Migrations are applied in sequence: v1→v2, v2→v3, etc.
 */
const MIGRATION_CHAIN = [
  // [targetVersion, migrationFunction]
  [2, migrateV1ToV2],
  // Add more [targetVersion, migrationFunction] pairs as new versions are introduced
] as const;

/**
 * Migrate config from detected version to target version.
 *
 * Applies a chain of migrations in order if version mismatch detected.
 * If version >= target, returns config as-is (no migration needed).
 * If version < target, applies each migration in sequence.
 *
 * @param config - Loaded config object (may be any shape)
 * @param detectedVersion - Version field from loaded config (required number)
 * @param targetVersion - Target version to migrate to (default: CURRENT_CONFIG_VERSION)
 * @returns Migrated config (or original if no migrations needed)
 * @throws If version mismatch or migration fails
 */
export function migrateConfig(
  config: any,
  detectedVersion: number,
  targetVersion: number = CURRENT_CONFIG_VERSION,
): AppSettings {
  // Already at target or newer; no migration needed
  if (detectedVersion >= targetVersion) {
    return config;
  }

  let migratedConfig = config;
  let currentVersion = detectedVersion;

  // Apply each migration in sequence
  for (const [nextVersion, migrationFn] of MIGRATION_CHAIN) {
    if (currentVersion < nextVersion && nextVersion <= targetVersion) {
      try {
        migratedConfig = migrationFn(migratedConfig);
        migratedConfig.version = nextVersion;
        currentVersion = nextVersion;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        throw new Error(
          `[ConfigMigration] Failed to migrate from v${currentVersion} to v${nextVersion}: ${errorMsg}`,
        );
      }
    }
  }

  return migratedConfig;
}
