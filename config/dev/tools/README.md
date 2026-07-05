# lib/config/tools

Utilities for validating and comparing application configuration across environments.

## `config-diff.ts` — Configuration Drift Detection

**Purpose:** Detect schema drift and field-level differences between `appsettings.dev.json` and `appsettings.json`.

**When to use:**
- Validating that development and production configs are in sync
- PR reviews: ensure config changes don't inadvertently break one environment
- CI/CD: automated validation before deployment
- Documenting intentional differences between environments

**Key features:**
- Deep field-by-field comparison (recursively traverses all config levels)
- Schema validation: detects missing fields or unexpected extra fields
- Expected differences whitelist: documents intentional divergence (e.g., dev URLs vs prod URLs)
- CLI-friendly output (JSON + text summary)

### Usage

**Via CLI (direct invocation):**

```bash
# Run from repo root
node -r ts-node/register lib/config/tools/config-diff.ts

# Or, if compiled to JS:
node lib/config/tools/config-diff.js
```

**Output:**
- **Unexpected diffs** (red): Fields that differ but are not in `expected-differences.json`
- **Expected diffs** (green): Fields that differ but are documented as intentional
- **Schema issues** (yellow): Missing fields in dev/prod or extra fields

**Examples:**

All diffs are expected (in whitelist):
```
✓ All config diffs are expected (0 unexpected, 15 expected)
```

Some diffs are unexpected:
```
✗ Found unexpected diffs (3 unexpected, 12 expected):
  - featureFlags.betaFeature: dev=true, prod=false (reason: ?)
  - database.pool.max: dev=50, prod=100 (reason: ?)
  - ...
```

### Expected Differences

The file `expected-differences.json` documents intentional config differences:

```json
{
  "database.url": "Dev uses local DB; prod uses cloud",
  "featureFlags.debugMode": "Debug enabled in dev only",
  "logging.level": "Dev uses DEBUG; prod uses INFO",
  "api.timeout": "Dev has longer timeout for debugging"
}
```

**To add an expected difference:**
1. Run the diff tool and identify the unexpected diff
2. Add the path and reason to `expected-differences.json`
3. Run the diff tool again to verify it's now expected

### GitHub Actions Integration

The tool is designed to run in PR validation workflows:

```yaml
# .github/workflows/config-validate.yml (existing)
- name: Validate Config Diffs
  run: node -r ts-node/register lib/config/tools/config-diff.ts
```

**This ensures:**
- Every PR config change is reviewed
- No accidental config drift between dev and prod
- New diffs must be explicitly whitelisted (documented in `expected-differences.json`)

### API Reference

**`detectDifferences(devConfig, prodConfig)`**

Compares dev and prod configs and returns all diffs.

```typescript
import { detectDifferences } from "@/lib/config/tools/config-diff";

const devConfig = require("../../appsettings.dev.json");
const prodConfig = require("../../appsettings.json");

const diffs = detectDifferences(devConfig, prodConfig);
// Returns array of { path, devValue, prodValue, isExpected, reason }
```

**`validateSchema(config1, config2)`**

Detects missing fields or extra fields (schema drift).

```typescript
const issues = validateSchema(devConfig, prodConfig);
// Returns array of { type, path, devValue, prodValue }
```

## See Also

- [lib/config/loader.ts](../loader.ts) — Config loading and resolution
- [docs/issues/MileStone 2/Tier 3/192 - Config Diff Tool/IMPLEMENTATION.md](../../../docs/issues/MileStone%202/Tier%203/192%20-%20Config%20Diff%20Tool/IMPLEMENTATION.md) — Current issue-era implementation note
