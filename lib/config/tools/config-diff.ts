/**
 * Config Schema Diff Tool
 *
 * Detects schema drift (missing/extra fields) between appsettings.dev.json
 * and appsettings.json. Provides deep field-by-field comparison and
 * documents expected differences.
 */

/**
 * Schema validation issue (missing or extra field)
 */
export interface SchemaIssue {
  type: 'missing-in-prod' | 'missing-in-dev' | 'extra-in-prod' | 'extra-in-dev';
  path: string; // dot-notation path (e.g., "features.consoleLogging")
  devValue?: unknown;
  prodValue?: unknown;
}

/**
 * Field-level difference between dev and prod configs
 */
export interface DiffEntry {
  path: string; // dot-notation path
  devValue: unknown;
  prodValue: unknown;
  isExpected: boolean; // whether this difference is documented as intentional
  reason?: string; // reason from expected-differences.json
}

/**
 * Deep traversal result for schema/field extraction
 */
interface FieldMap {
  [path: string]: unknown;
}

/**
 * Load expected differences from expected-differences.json
 */
function loadExpectedDifferences(): Record<string, string> {
  try {
     
    return require('./expected-differences.json') as Record<string, string>;
  } catch {
    // File may not exist yet; return empty map
    return {};
  }
}

/**
 * Extract all field paths (dot-notation) from an object
 * Recursively traverses nested objects; arrays are treated as leaf values
 */
function extractFields(obj: unknown, prefix = ''): FieldMap {
  const fields: FieldMap = {};

  if (obj === null || typeof obj !== 'object') {
    if (prefix) {
      // eslint-disable-next-line security/detect-object-injection
      fields[prefix] = obj;
    }
    return fields;
  }

  if (Array.isArray(obj)) {
    // Arrays are leaf values; don't traverse contents
    if (prefix) {
      // eslint-disable-next-line security/detect-object-injection
      fields[prefix] = obj;
    }
    return fields;
  }

  const record = obj as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    const newPath = prefix ? `${prefix}.${key}` : key;
    /* eslint-disable-next-line security/detect-object-injection -- safe: keys derived from Object.keys(record) */
    const value = record[key];

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      // Recurse into nested objects

      Object.assign(fields, extractFields(value, newPath));
    } else {
      // Leaf value (primitive, array, or null)
      /* eslint-disable-next-line security/detect-object-injection -- safe: using internal field path as key */
      fields[newPath] = value;
    }
  }

  return fields;
}

/**
 * Validate config schemas match (no missing/extra fields)
 * Returns list of schema issues found
 */
export function validateConfigSchema(
  devConfig: unknown,
  prodConfig: unknown
): SchemaIssue[] {
  const issues: SchemaIssue[] = [];

  if (!devConfig || typeof devConfig !== 'object') {
    issues.push({
      type: 'missing-in-dev',
      path: '$root',
      prodValue: prodConfig,
    });
    return issues;
  }

  if (!prodConfig || typeof prodConfig !== 'object') {
    issues.push({
      type: 'missing-in-prod',
      path: '$root',
      devValue: devConfig,
    });
    return issues;
  }

  const devFields = extractFields(devConfig);
  const prodFields = extractFields(prodConfig);

  const devPaths = new Set(Object.keys(devFields));
  const prodPaths = new Set(Object.keys(prodFields));

  // Check for fields in dev but not in prod
  for (const path of devPaths) {
    if (!prodPaths.has(path)) {
      issues.push({
        type: 'missing-in-prod',
        path,
        /* eslint-disable-next-line security/detect-object-injection -- safe: path is derived from internal field extraction */
        devValue: devFields[path],
      });
    }
  }

  // Check for fields in prod but not in dev
  for (const path of prodPaths) {
    if (!devPaths.has(path)) {
      issues.push({
        type: 'missing-in-dev',
        path,
        /* eslint-disable-next-line security/detect-object-injection -- safe: path is derived from internal field extraction */
        prodValue: prodFields[path],
      });
    }
  }

  return issues;
}

/**
 * Deep diff of dev and prod configs
 * Returns all field-level differences (superset includes schema mismatches)
 */
export function getConfigDiff(devConfig: unknown, prodConfig: unknown): DiffEntry[] {
  const diffs: DiffEntry[] = [];
  const expectedDiffs = loadExpectedDifferences();

  if (!devConfig || typeof devConfig !== 'object') {
    return [
      {
        path: '$root',
        devValue: devConfig,
        prodValue: prodConfig,
        isExpected: false,
      },
    ];
  }

  if (!prodConfig || typeof prodConfig !== 'object') {
    return [
      {
        path: '$root',
        devValue: devConfig,
        prodValue: prodConfig,
        isExpected: false,
      },
    ];
  }

  const devFields = extractFields(devConfig);
  const prodFields = extractFields(prodConfig);

  const allPaths = new Set([...Object.keys(devFields), ...Object.keys(prodFields)]);

  for (const path of allPaths) {
    /* eslint-disable-next-line security/detect-object-injection -- safe: path is derived from extractFields and represents internal field paths */
    const devValue = devFields[path];
    /* eslint-disable-next-line security/detect-object-injection -- safe: path is derived from extractFields and represents internal field paths */
    const prodValue = prodFields[path];

    // Skip if both undefined (shouldn't happen with extractFields, but defensive)
    if (devValue === undefined && prodValue === undefined) {
      continue;
    }

    // Check if values differ
    if (JSON.stringify(devValue) !== JSON.stringify(prodValue)) {
      const isExpected = path in expectedDiffs;
      /* eslint-disable-next-line security/detect-object-injection -- safe: path is derived from config field paths */
      const reason = expectedDiffs[path];
      diffs.push({
        path,
        devValue,
        prodValue,
        isExpected,
        reason,
      });
    }
  }

  return diffs;
}

/**
 * Get documented expected differences between dev and prod configs
 */
export function mapExpectedDifferences(): Record<string, string> {
  return loadExpectedDifferences();
}
