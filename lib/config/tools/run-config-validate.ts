/**
 * Config Validation CLI
 *
 * Loads appsettings.dev.json and appsettings.json, runs schema validation,
 * and reports findings in human-readable format.
 *
 * Usage: node lib/config/tools/run-config-validate.js
 * or: npm run config:validate
 *
 * Options:
 *   --use-migrations  Validate with migrations applied (normalized structure)
 *   --use-loader      Validate with full loader (migrations + platform merges)
 *                     Requires React Native to be available
 *
 * Modes (by priority):
 *   1. Raw JSON files (default) - Fast, file-level schema comparison
 *   2. --use-migrations       - Applies config migrations for version compatibility
 *   3. --use-loader           - Full runtime shape (with platform-specific merges)
 */

import * as fs from 'fs';
import * as path from 'path';
import { getConfigDiff, validateConfigSchema } from './config-diff';

// Parse and validate CLI flags
const useLoader = process.argv.includes('--use-loader');
const useMigrations = process.argv.includes('--use-migrations');

// Ensure flags are mutually exclusive
if (useLoader && useMigrations) {
  console.error('❌ Error: --use-loader and --use-migrations are mutually exclusive.');
  console.error('   Use --use-migrations for normalized config with migrations applied.');
  console.error('   Use --use-loader for full runtime shape (migrations + platform merges).');
  process.exit(1);
}

// ANSI color codes for terminal output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

/**
 * Load JSON config file
 */
function loadConfig(filePath: string): unknown {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(
      `Failed to load config from ${filePath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Load config via migrations (deterministic transformations, no React Native deps)
 * Returns the normalized config shape with migrations applied (but skips platform merges)
 */
function loadConfigWithMigrations(): { devConfig: unknown; prodConfig: unknown } {
  try {
    // Load raw JSON files
    const workspaceRoot = path.resolve(__dirname, '../../..');
    const devConfigPath = path.join(workspaceRoot, 'config/appsettings.dev.json');
    const prodConfigPath = path.join(workspaceRoot, 'config/appsettings.json');

    const devRaw = loadConfig(devConfigPath);
    const prodRaw = loadConfig(prodConfigPath);

    // Apply migrations to normalize configs
     
    const { migrateConfig, CURRENT_CONFIG_VERSION } = require('../migrations');

    const devVersion = (devRaw as any).version || 1;
    const prodVersion = (prodRaw as any).version || 1;

    const devConfig = migrateConfig(devRaw, devVersion, CURRENT_CONFIG_VERSION);
    const prodConfig = migrateConfig(prodRaw, prodVersion, CURRENT_CONFIG_VERSION);

    return { devConfig, prodConfig };
  } catch (error) {
    throw new Error(
      `Failed to load config with migrations: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Safe helper to clear require.cache for a module, guarding against errors
 */
function clearModuleCache(modulePath: string): void {
  try {
    const resolvedPath = require.resolve(modulePath);
    if (require.cache[resolvedPath]) {
      delete require.cache[resolvedPath];
    }
  } catch {
    // Ignore errors if module was never loaded or resolve failed
  }
}

/**
 * Load config via the loader (applies migrations, platform merges, etc.)
 * Returns the normalized config shape for both dev and prod environments
 */
function loadConfigViaLoader(): { devConfig: unknown; prodConfig: unknown } {
  try {
    // Dynamically import loader to avoid loading it unless --use-loader is used
     
    const loaderModule = require('../loader');
    const { getAppConfig } = loaderModule;

    // Load dev config
    const prevEnv = process.env.EXPO_PUBLIC_ENVIRONMENT;
    try {
      process.env.EXPO_PUBLIC_ENVIRONMENT = 'development';
      // Clear the cached config so the loader re-reads with the new environment
      clearModuleCache('../loader');
       
      const devLoadedModule = require('../loader');
      const devConfig = devLoadedModule.getAppConfig();

      // Load prod config
      process.env.EXPO_PUBLIC_ENVIRONMENT = 'production';
      clearModuleCache('../loader');
       
      const prodLoadedModule = require('../loader');
      const prodConfig = prodLoadedModule.getAppConfig();

      return { devConfig, prodConfig };
    } finally {
      // Restore previous environment
      if (prevEnv !== undefined) {
        process.env.EXPO_PUBLIC_ENVIRONMENT = prevEnv;
      } else {
        delete process.env.EXPO_PUBLIC_ENVIRONMENT;
      }
      // Clear cache again to avoid pollution
      clearModuleCache('../loader');
    }
  } catch (error) {
    throw new Error(
      `Failed to load config via loader: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Print colored output
 */
function log(message: string, color?: keyof typeof colors): void {
  if (color) {
    console.log(`${colors[color]}${message}${colors.reset}`);
  } else {
    console.log(message);
  }
}

/**
 * Main validation and reporting
 */
function main(): void {
  const workspaceRoot = path.resolve(__dirname, '../../..');
  const devConfigPath = path.join(workspaceRoot, 'config/appsettings.dev.json');
  const prodConfigPath = path.join(workspaceRoot, 'config/appsettings.json');

  log('\nConfig Schema Validation', 'bold');
  log('========================\n', 'cyan');
  log(`Dev Config:    ${devConfigPath}`);
  log(`Prod Config:   ${prodConfigPath}`);
  if (useMigrations) {
    log('Mode:          With migrations applied (normalized structure)', 'cyan');
  } else if (useLoader) {
    log('Mode:          Full loader validation (with platform merges)', 'cyan');
  } else {
    log('Mode:          Raw JSON files', 'cyan');
  }
  log('');

  // Load configs
  let devConfig: unknown;
  let prodConfig: unknown;

  if (useMigrations) {
    try {
      const loaded = loadConfigWithMigrations();
      devConfig = loaded.devConfig;
      prodConfig = loaded.prodConfig;
    } catch (error) {
      log(`❌ ${error instanceof Error ? error.message : String(error)}`, 'red');
      process.exit(1);
    }
  } else if (useLoader) {
    try {
      const loaded = loadConfigViaLoader();
      devConfig = loaded.devConfig;
      prodConfig = loaded.prodConfig;
    } catch (error) {
      log(`❌ ${error instanceof Error ? error.message : String(error)}`, 'red');
      process.exit(1);
    }
  } else {
    try {
      devConfig = loadConfig(devConfigPath);
    } catch (error) {
      log(`❌ ${error instanceof Error ? error.message : String(error)}`, 'red');
      process.exit(1);
    }

    try {
      prodConfig = loadConfig(prodConfigPath);
    } catch (error) {
      log(`❌ ${error instanceof Error ? error.message : String(error)}`, 'red');
      process.exit(1);
    }
  }

  // Validate schema
  const schemaIssues = validateConfigSchema(devConfig, prodConfig);

  if (schemaIssues.length > 0) {
    log('❌ SCHEMA MISMATCH', 'red');
    log('==================\n', 'red');

    const missingInProd = schemaIssues.filter((i) => i.type === 'missing-in-prod');
    const missingInDev = schemaIssues.filter((i) => i.type === 'missing-in-dev');

    if (missingInProd.length > 0) {
      log('appsettings.dev.json has fields that appsettings.json doesn\'t:', 'red');
      for (const issue of missingInProd) {
        log(`  - ${issue.path}`);
      }
      log('');
    }

    if (missingInDev.length > 0) {
      log('appsettings.json has fields that appsettings.dev.json doesn\'t:', 'red');
      for (const issue of missingInDev) {
        log(`  - ${issue.path}`);
      }
      log('');
    }

    log('ACTION: Add missing fields to match, or remove extra fields', 'yellow');
    log('See lib/config/README.md for expected differences\n');
    process.exit(1);
  }

  log('✅ SCHEMA VALID - Both configs have identical structure\n', 'green');

  // Get field-level differences
  const diffs = getConfigDiff(devConfig, prodConfig);

  if (diffs.length === 0) {
    log('ℹ️  No field differences found (configs are identical)\n', 'cyan');
    log('Overall: ✅ PASS\n', 'green');
    return;
  }

  const unexpectedDiffs = diffs.filter((d) => !d.isExpected);

  log(`${diffs.length} Field Differences Found`, 'cyan');
  if (unexpectedDiffs.length > 0) {
    log(`(${unexpectedDiffs.length} unexpected)\n`, 'yellow');
  } else {
    log('(all expected)\n', 'green');
  }

  // Show differences
  for (const diff of diffs) {
    const status = diff.isExpected ? '✅' : '⚠️ ';
    const color = diff.isExpected ? 'green' : 'yellow';

    const devVal = JSON.stringify(diff.devValue);
    const prodVal = JSON.stringify(diff.prodValue);

    log(`${status} ${diff.path}: ${devVal} → ${prodVal}`, color);
    if (diff.reason) {
      log(`   └─ ${diff.reason}`);
    }
  }

  log('');

  // Final result
  if (unexpectedDiffs.length > 0) {
    log(`Overall: ⚠️  ${unexpectedDiffs.length} UNEXPECTED DIFFERENCE${unexpectedDiffs.length > 1 ? 'S' : ''}`, 'yellow');
    log(`Review the differences above. If intentional, add them to`, 'yellow');
    log(`lib/config/tools/expected-differences.json\n`, 'yellow');
    // Note: don't exit with error for unexpected diffs in dev mode - just warn
    log('Set STRICT_CONFIG_VALIDATION=1 to fail on unexpected differences\n', 'cyan');
    if (process.env.STRICT_CONFIG_VALIDATION === '1') {
      process.exit(1);
    }
  } else {
    log('Overall: ✅ PASS (all differences expected)\n', 'green');
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { main };

