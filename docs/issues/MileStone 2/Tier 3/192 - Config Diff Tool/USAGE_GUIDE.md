# Config Schema Diff Tool - Usage Guide

## Overview

The config schema diff tool detects and reports schema drift between `appsettings.dev.json` and `appsettings.json`. It identifies missing/extra fields (schema mismatches) and documents intentional differences.

## Quick Start

### Manual Validation

Run the config validator at any time:

```bash
npm run config:validate
```

**Validation Modes:**

- **Raw JSON (default)** — Compares file structure directly (fastest)
- **With migrations** — Applies config version migrations for runtime normalization:
  ```bash
  npm run config:validate -- --use-migrations
  ```
- **Full loader** — Includes platform-specific config merges (requires React Native):
  ```bash
  npm run config:validate -- --use-loader
  ```

```
Config Schema Validation
========================
Dev Config:    config/appsettings.dev.json
Prod Config:   config/appsettings.json

✅ SCHEMA VALID - Both configs have identical structure

5 Field Differences Found (all expected)
✅ features.consoleLogging:       true  →  false
✅ features.devBypass:            true  →  false
✅ devTools.enableConsoleLogger:  true  →  false
✅ featureFlags.loggerCategories: [11 cats] → [3 cats]
✅ environment:              development   → production

Overall: ✅ PASS (all differences expected)
```

### Automated Checks

The validator runs automatically in two modes:

#### Local (Manual Validation)

Run `npm run config:validate` locally at any time for fast feedback before creating a PR:

```bash
npm run config:validate
```

If schema validation fails, fix the mismatch locally and re-run the command. Validation is enforced in CI for pull requests, so local runs are advisory and helpful for fast iteration.

#### CI (GitHub Actions)

On every PR and push to `main`/`develop`, the workflow:
1. Runs `npm run config:validate` with strict mode (`STRICT_CONFIG_VALIDATION=1`)
2. Blocks merge if schema validation fails
3. Allows merge if schema is valid

This config validation step runs alongside other CI checks such as:

- `npm run lint` (ESLint)
- `npm run typecheck` (TypeScript `tsc --noEmit`)
- security audit steps (vulnerability scanning/tooling as configured)
- config validation (`npm run config:validate` in strict mode)

## Understanding Output

### Schema Validation

**PASS (✅):**
- Both files have identical field structure
- All differences are documented as "expected"

**FAIL (❌):**
- Missing field: field exists in one config but not the other
- This is a schema drift and must be fixed

Example error:

```
❌ SCHEMA MISMATCH
==================

appsettings.dev.json has fields that appsettings.json doesn't:
  - network.retryDelayMs
  - network.statusCheckTimeoutMs

appsettings.json has fields that appsettings.dev.json doesn't:
  - (none)

ACTION: Add missing fields to match, or remove them from appsettings.dev.json
```

### Field Differences

Each difference shows:
- **Status**: ✅ (expected) or ⚠️ (unexpected)
- **Field path**: dot-notation (e.g., `features.devBypass`)
- **Values**: dev value → prod value
- **Reason**: explanation from `lib/config/tools/expected-differences.json`

Example:

```
✅ features.devBypass: true → false
   └─ Dev enables authentication bypass for testing; production MUST be false for security
```

### Unexpected Differences

If a field differs but isn't documented as "expected":

```
⚠️  someNewField: 123 → 456
```

In dev mode, this logs a warning but doesn't block commits. In CI (with `STRICT_CONFIG_VALIDATION=1`), unexpected differences block merges.

If you intentionally want this difference, add it to `lib/config/tools/expected-differences.json` with a rationale.

## Common Tasks

### Adding a New Field to Config

If you add a field to `appsettings.dev.json`:

1. Run `npm run config:validate`
2. Add the same field to `appsettings.json` (with appropriate prod value)
3. Run `npm run config:validate` again — should pass

**Example:** Adding `network.maxRetries`

Dev config:
```json
{
  "network": {
    "timeoutMs": 5000,
    "maxRetries": 3  // ← NEW
  }
}
```

Prod config:
```json
{
  "network": {
    "timeoutMs": 10000,
    "maxRetries": 5  // ← Add this
  }
}
```

Then run `npm run config:validate` — should show the new field as an expected difference in values.

### Documenting an Intentional Difference

If a field intentionally differs between dev and prod (e.g., different timeout values for testing):

1. Add it to `lib/config/tools/expected-differences.json`
2. Provide a clear rationale

Example:

```json
{
  "network.retryDelayMs": "Dev uses short delays for faster testing; production uses longer delays for stability"
}
```

Then run `npm run config:validate` — the difference will show as ✅ (expected).

### Removing a Field

If you remove a field from one config:

1. Remove it from the other config too (schema must match)
2. If it was documented as expected, remove it from `expected-differences.json`
3. Run `npm run config:validate` — should pass

### Bypassing Local CI Enforcement

CI checks (including config validation in strict mode) cannot be bypassed from the client side. If you need an exception for a PR, follow your repository's approval process or request a temporary override from repository administrators.

## Expected Differences

Common fields that intentionally differ:

| Field | Dev | Prod | Reason |
|-------|-----|------|--------|
| `environment` | `"development"` | `"production"` | Environment mode affects logging and features |
| `features.consoleLogging` | `true` | `false` | Dev enables verbose console logging |
| `features.devBypass` | `true` | `false` | **CRITICAL:** Auth bypass for testing only |
| `features.mockData` | `true` | `false` | **CRITICAL:** Mock data for testing only |
| `devTools.enableConsoleLogger` | `true` | `false` | Dev tools disabled in production |
| `devTools.enableNetworkLogger` | `true` | `false` | Network logging for dev debugging |
| `devTools.enablePerformanceLogger` | `true` | `false` | Performance monitoring for dev|
| `overrides.verboseErrorMessages` | `true` | `false` | Dev shows detailed errors; prod hides sensitive info |
| `thresholds.slowScreenMs` | varies | varies | Dev may use different thresholds for testing |
| `network.retryDelayMs` | varies | varies | Dev uses shorter delays for faster testing |

See `lib/config/tools/expected-differences.json` for the full list.

## Troubleshooting

### "Schema mismatch: field X is missing in prod config"

**Fix:** Add the field to `appsettings.json` with an appropriate production value.

```bash
npm run config:validate
# Shows which fields are missing
# Add them to appsettings.json
npm run config:validate
# Verify it passes
```

### "Unexpected difference in field X"

**Options:**

A) Remove the difference (keep values the same in both configs)
B) Document it as expected if intentional:
   - Add to `lib/config/tools/expected-differences.json`
   - Provide a clear reason

### Local hook isn't running (optional)

If you opted into local pre-commit hooks and a hook isn't running, ensure Husky is initialized:

```bash
npx husky install
```

Then try committing again. Note: CI validation runs regardless of local hooks.

### "npm run config:validate is failing but I don't understand why"

Run it locally with verbose output:

```bash
npm run config:validate
# Read the error message and paths shown
# Fix the schema mismatch
```

## See Also

- [Implementation Guide](IMPLEMENTATION.md) — How the tool works architecturally
- [lib/config/tools/expected-differences.json](../../../../lib/config/tools/expected-differences.json) — Full list of documented differences
- [lib/config/README.md](../../../../lib/config/README.md) — Config module documentation
