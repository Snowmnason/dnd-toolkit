# Config Schema Diff Tool - Implementation Guide

## Overview

The config schema diff tool is a development and CI utility that detects schema drift (missing/extra fields) between `appsettings.dev.json` and `appsettings.json`.

### What Was Added

#### Core Library (`lib/config/tools/`)

**`config-diff.ts`**
- `validateConfigSchema(devConfig, prodConfig): SchemaIssue[]` — Detects missing/extra fields
- `getConfigDiff(devConfig, prodConfig): DiffEntry[]` — Deep field-by-field comparison with expected-difference matching
- `mapExpectedDifferences(): Record<string, string>` — Loads documented expected differences
- Helper: `extractFields()` — Recursively extracts all field paths from nested objects (dot-notation)

**`run-config-validate.ts`**
- CLI entry point that loads config files, runs validation, and prints human-readable output
- Color-coded terminal output (❌ schema mismatch, ✅ expected, ⚠️ unexpected)
- Environment variable `STRICT_CONFIG_VALIDATION=1` for CI mode (fails on unexpected differences)
- Supports multiple validation modes:
  - **Raw JSON** (default) — File-level schema comparison
  - **--use-migrations** — Applies config version migrations (deterministic)
  - **--use-loader** — Full runtime config with platform merges (requires React Native)

**`expected-differences.json`**
- Static mapping of documented expected differences (e.g., `features.devBypass` from true→false)
- Each entry includes a reason explaining why the difference is intentional

**`index.ts`**
- Barrel export for public API (`validateConfigSchema`, `getConfigDiff`, `mapExpectedDifferences`)

#### Integration Points

**`lib/config/index.ts`**
- Re-exports config tools for public use

**`package.json`**
- Added `"config:validate": "node --loader tsx lib/config/tools/run-config-validate.ts"` script

**Local Hook (optional)**
- Teams may add a local pre-commit hook that runs `npm run config:validate`, but this is optional.
- Validation is enforced in CI; local hooks are advisory and intended for faster developer feedback.

**`.github/workflows/config-validate.yml`**
- GitHub Actions workflow triggered on:
  - PRs that modify config files or tools
  - Push to `main` or `develop` branches
- Runs with `STRICT_CONFIG_VALIDATION=1` (fails on unexpected differences)
- Blocks merge if validation fails

## How It Works

### Schema Validation Algorithm

1. **Extract fields** from both configs using recursive traversal
   - Converts nested object structure to flat key-value map (dot-notation paths)
   - Arrays are treated as leaf values (not traversed)
2. **Compare field sets**
   - Find fields in dev but not in prod (missing-in-prod)
   - Find fields in prod but not in dev (missing-in-dev)
3. **Report issues**
   - Schema pass: both configs have identical field structure
   - Schema fail: any missing/extra fields

**Example:**

Dev config:
```json
{
  "features": { "devBypass": true, "consoleLogging": true },
  "network": { "retryDelayMs": 1000 }
}
```

Prod config:
```json
{
  "features": { "devBypass": false },
  "network": { "maxRetries": 5 }
}
```

Extracted fields (dev):
```
features.devBypass = true
features.consoleLogging = true
network.retryDelayMs = 1000
```

Extracted fields (prod):
```
features.devBypass = false
network.maxRetries = 5
```

Schema issues found:
- `missing-in-prod`: `features.consoleLogging` (exists in dev, not in prod)
- `missing-in-prod`: `network.retryDelayMs` (exists in dev, not in prod)
- `missing-in-dev`: `network.maxRetries` (exists in prod, not in dev)

### Deep Diff Algorithm

1. Extract fields from both configs (as above)
2. For each field, check if value differs
3. Load expected differences map
4. For each difference, check if documented as expected
5. Return all differences with expected/unexpected flag and reason

**Example:**

Same configs as above produce:

```typescript
[
  {
    path: 'features.devBypass',
    devValue: true,
    prodValue: false,
    isExpected: true,     // documented in expected-differences.json
    reason: 'Dev enables auth bypass for testing; production MUST be false'
  },
  {
    path: 'features.consoleLogging',
    devValue: true,
    prodValue: undefined,
    isExpected: false     // not expected (schema mismatch + not documented)
  },
  // ... more entries
]
```

### CLI Output Flow

1. Load both config files (JSON parse + error handling)
2. Run `validateConfigSchema()` — check structure
   - If fails: print schema issues, exit code 1
   - If passes: continue
3. Run `getConfigDiff()` — check field values
   - If empty: print "no differences", exit code 0
   - If found: print each difference (expected vs. unexpected)
4. Exit code logic:
   - Schema fails → always exit code 1
   - Schema passes, unexpected diffs, `STRICT_CONFIG_VALIDATION=1` → exit code 1
   - Schema passes, only expected diffs (or no diffs) → exit code 0

### Validation Modes

The CLI supports multiple validation modes to check different levels of runtime compatibility:

**Raw JSON (default)**
- Fast file-level schema comparison
- Detects missing/extra fields between source files
- No transformations applied
- Best for: Rapid feedback during development

**With Migrations (`--use-migrations`)**
- Applies config version migrations from `lib/config/migrations.ts`
- Normalizes configs to current version (handles backwards compatibility)
- Still doesn't apply platform-specific overrides
- Best for: Validating version compatibility and migration correctness

**Full Loader (`--use-loader`)**
- Applies migrations AND platform-specific config merges
- Validates the actual runtime config shape that the app uses
- Requires React Native to be available (may not work in CI without native dependencies)
- Best for: Local development; comprehensive runtime shape validation

**Example usage:**
```bash
npm run config:validate                    # Raw JSON (default)
npm run config:validate -- --use-migrations # With migrations
npm run config:validate -- --use-loader     # Full runtime (requires React Native)
```

**CI Usage:**
By default, CI uses raw JSON mode (fastest, deterministic). To add migration validation to CI, use:
```bash
STRICT_CONFIG_VALIDATION=1 npm run config:validate -- --use-migrations
```

### Git Hook and CI Integration

**Local Validation**:
- Run `npm run config:validate` locally to check schema and diffs before opening a PR
- Local runs are non-strict by default; they provide quick feedback for developers
- Adding a local pre-commit hook is optional and left to team preference

**GitHub Actions Workflow** (`.github/workflows/config-validate.yml`):
- Triggers on config file changes or tool updates
- Runs with `STRICT_CONFIG_VALIDATION=1` (strict mode)
- Any unexpected differences or schema errors → blocks merge
- Clear failure message in PR checks
This validation job is intended to run as part of the repository CI pipeline and should be executed alongside other automation steps such as linting, typechecking, and any configured security scans. The combined CI checks provide a single authoritative gate for PRs.

## Type Definitions

### `SchemaIssue`

```typescript
interface SchemaIssue {
  type: 'missing-in-prod' | 'missing-in-dev' | 'extra-in-prod' | 'extra-in-dev';
  path: string;         // Dot-notation path (e.g., "features.consoleLogging")
  devValue?: unknown;   // Value from dev config (if exists)
  prodValue?: unknown;  // Value from prod config (if exists)
}
```

Represents a field that exists in one config but not the other (schema mismatch).

### `DiffEntry`

```typescript
interface DiffEntry {
  path: string;        // Dot-notation path
  devValue: unknown;   // Value from dev config
  prodValue: unknown;  // Value from prod config
  isExpected: boolean; // Whether documented in expected-differences.json
  reason?: string;     // Explanation from expected-differences.json
}
```

Represents a field that differs in value between configs.

## Dependencies

- **Node.js**: File I/O, environment variables
- **TypeScript**: Type definitions and implementation
- **Vitest**: Unit testing (optional, for test suite)

No external npm packages required (pure TypeScript/Node.js).

## Configuration

### Expected Differences Map

Edit `lib/config/tools/expected-differences.json` to document intentional differences:

```json
{
  "features.devBypass": "Dev enables auth bypass for testing; production MUST be false",
  "environment": "Dev uses development mode; production uses production mode",
  "thresholds.slowScreenMs": "Dev may use lower threshold for stricter testing"
}
```

Keys are dot-notation paths; values are human-readable explanations.

### Strict Mode

Run with `STRICT_CONFIG_VALIDATION=1` to fail on unexpected differences:

```bash
STRICT_CONFIG_VALIDATION=1 npm run config:validate
```

This is used in CI to enforce strict schema validation on PRs.

## Testing

Unit tests in `__tests__/config/tools.test.ts` cover:

- Schema validation: missing fields, extra fields, nested objects, arrays
- Deep diff: value differences, expected vs. unexpected matching
- Expected differences: loading and matching logic
- Null/undefined handling

Run tests:

```bash
npm run test -- __tests__/config/tools.test.ts
```

## Performance

- **Schema validation**: O(n) where n = total fields (typically <50, <1ms)
- **Deep diff**: O(n) recursive traversal
- **File loading**: Depends on file size (typically <10ms)

No caching; each invocation is independent.

## Security & Safety

- **No external network**: Only reads local config files
- **No write operations**: Read-only analysis
- **No secret leakage**: stdout doesn't log config values in production (uses diff format only)
- **Git hook non-blocking by default**: Only blocks on schema errors (use `--no-verify` to bypass)
- **CI strict mode**: Blocks unexpected differences on merge (cannot bypass without approvals)

## Extensions & Future Work

**Possible enhancements:**

1. **Auto-fixer** (`npm run config:sync`) — suggests diffs and allows user to apply
2. **Config inheritance** — base template with per-env overrides (reduce duplication)
3. **Migration validation** — check that new version migrations are compatible
4. **Selective validation** — validate only changed fields (for large configs)
5. **Remote config sync** — fetch prod config from backend and compare locally

See [issue suggestions](../../../suggestions/) for more ideas.

## Troubleshooting

### "Module not found: lib/config/tools"

Ensure the files are created in the correct directory:
```
lib/config/tools/
  ├── config-diff.ts
  ├── expected-differences.json
  ├── run-config-validate.ts
  └── index.ts
```

### "Command not found: npm run config:validate"

Ensure `package.json` script is added:
```json
{
  "scripts": {
    "config:validate": "node --loader tsx lib/config/tools/run-config-validate.ts"
  }
}
```

### Local hook not running (optional)

If you added local pre-commit hooks and they're not running, ensure Husky is initialized:
```bash
npx husky install
```

## Related Modules

- **lib/config** — Main config module with loader, validator, and this tools submodule
- **lib/config/loader.ts** — Loads config files at app startup
- **lib/config/config-validator.ts** — Runtime validation of config structure and production safety
- **lib/config/hot-reload.ts** — Dev-only hot-reload for config changes without restart

See [Config Module README](../../../../lib/config/README.md) for full documentation.
