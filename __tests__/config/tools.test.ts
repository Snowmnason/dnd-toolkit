/**
 * Unit tests for config-diff tool
 */

import { getConfigDiff, mapExpectedDifferences, validateConfigSchema } from "@/config";
import { describe, expect, it } from 'vitest';

describe('config-diff', () => {
  describe('validateConfigSchema', () => {
    it('should find no issues when schemas match', () => {
      const dev = {
        features: { devBypass: true },
        environment: 'development',
      };
      const prod = {
        features: { devBypass: false },
        environment: 'production',
      };

      const issues = validateConfigSchema(dev, prod);
      expect(issues).toHaveLength(0);
    });

    it('should detect missing field in prod', () => {
      const dev = {
        features: { devBypass: true, consoleLogging: true },
        environment: 'development',
      };
      const prod = {
        features: { devBypass: false },
        environment: 'production',
      };

      const issues = validateConfigSchema(dev, prod);
      expect(issues).toContainEqual({
        type: 'missing-in-prod',
        path: 'features.consoleLogging',
        devValue: true,
      });
    });

    it('should detect missing field in dev', () => {
      const dev = {
        features: { devBypass: true },
        environment: 'development',
      };
      const prod = {
        features: { devBypass: false, verboseLogging: false },
        environment: 'production',
      };

      const issues = validateConfigSchema(dev, prod);
      expect(issues).toContainEqual({
        type: 'missing-in-dev',
        path: 'features.verboseLogging',
        prodValue: false,
      });
    });

    it('should handle deeply nested objects', () => {
      const dev = {
        features: {
          devBypass: true,
          network: { retryDelayMs: 1000, timeoutMs: 5000 },
        },
      };
      const prod = {
        features: { devBypass: false },
      };

      const issues = validateConfigSchema(dev, prod);
      expect(issues.length).toBeGreaterThan(0);
      expect(issues.some((i) => i.path.includes('network'))).toBe(true);
    });

    it('should treat arrays as leaf values (not traverse contents)', () => {
      const dev = {
        categories: ['a', 'b'],
      };
      const prod = {
        categories: ['a', 'b', 'c'], // Different array size
      };

      const issues = validateConfigSchema(dev, prod);
      expect(issues).toHaveLength(0); // Arrays are treated as complete values
    });

    it('should handle null/undefined gracefully', () => {
      const issues1 = validateConfigSchema(null, {});
      expect(issues1.length).toBeGreaterThan(0);

      const issues2 = validateConfigSchema({}, null);
      expect(issues2.length).toBeGreaterThan(0);
    });
  });

  describe('getConfigDiff', () => {
    it('should return empty array when configs are identical', () => {
      const config = {
        features: { devBypass: true },
        environment: 'development',
      };

      const diffs = getConfigDiff(config, config);
      expect(diffs).toHaveLength(0);
    });

    it('should detect all field-level differences', () => {
      const dev = {
        features: { devBypass: true, consoleLogging: true },
        environment: 'development',
      };
      const prod = {
        features: { devBypass: false, consoleLogging: false },
        environment: 'production',
      };

      const diffs = getConfigDiff(dev, prod);
      expect(diffs.length).toBeGreaterThan(0);
      expect(diffs.some((d) => d.path === 'features.devBypass')).toBe(true);
      expect(diffs.some((d) => d.path === 'environment')).toBe(true);
    });

    it('should mark expected differences', () => {
      const dev = {
        features: { devBypass: true },
      };
      const prod = {
        features: { devBypass: false },
      };

      const diffs = getConfigDiff(dev, prod);
      const devBypassDiff = diffs.find((d) => d.path === 'features.devBypass');

      expect(devBypassDiff).toBeDefined();
      expect(devBypassDiff?.isExpected).toBe(true);
      expect(devBypassDiff?.reason).toBeDefined();
    });

    it('should mark unexpected differences', () => {
      const dev = {
        someRandomField: 'value1',
      };
      const prod = {
        someRandomField: 'value2',
      };

      const diffs = getConfigDiff(dev, prod);
      const diff = diffs.find((d) => d.path === 'someRandomField');

      expect(diff).toBeDefined();
      expect(diff?.isExpected).toBe(false);
    });

    it('should handle deeply nested fields', () => {
      const dev = {
        network: {
          retry: {
            delayMs: 1000,
            maxAttempts: 3,
          },
        },
      };
      const prod = {
        network: {
          retry: {
            delayMs: 2000,
            maxAttempts: 5,
          },
        },
      };

      const diffs = getConfigDiff(dev, prod);
      expect(diffs.some((d) => d.path === 'network.retry.delayMs')).toBe(true);
      expect(diffs.some((d) => d.path === 'network.retry.maxAttempts')).toBe(true);
    });

    it('should include dev and prod values in diff', () => {
      const dev = { timeout: 1000 };
      const prod = { timeout: 5000 };

      const diffs = getConfigDiff(dev, prod);
      expect(diffs[0].devValue).toBe(1000);
      expect(diffs[0].prodValue).toBe(5000);
    });
  });

  describe('mapExpectedDifferences', () => {
    it('should return a record of expected differences', () => {
      const expected = mapExpectedDifferences();
      expect(typeof expected).toBe('object');
      expect(expected).not.toBeNull();
    });

    it('should include common dev/prod differences', () => {
      const expected = mapExpectedDifferences();
      expect(expected['features.devBypass']).toBeDefined();
      expect(expected['features.mockData']).toBeDefined();
      expect(expected['environment']).toBeDefined();
    });

    it('should provide descriptive reasons', () => {
      const expected = mapExpectedDifferences();
      const reason = expected['features.devBypass'];
      expect(reason).toContain('testing');
    });
  });

  describe('Config validation modes', () => {
    it('should validate raw JSON files without migrations', () => {
      const dev = {
        version: 1,
        features: { devBypass: true },
        environment: 'development',
      };
      const prod = {
        version: 1,
        features: { devBypass: false },
        environment: 'production',
      };

      const issues = validateConfigSchema(dev, prod);
      expect(issues).toHaveLength(0);
    });

    it('should detect schema mismatches in raw JSON mode', () => {
      const dev = {
        version: 1,
        features: { devBypass: true, newField: 'test' },
        environment: 'development',
      };
      const prod = {
        version: 1,
        features: { devBypass: false },
        environment: 'production',
      };

      const issues = validateConfigSchema(dev, prod);
      expect(issues.length).toBeGreaterThan(0);
      expect(issues.some(i => i.path === 'features.newField')).toBe(true);
    });

    it('should handle version field in config gracefully', () => {
      const dev = {
        version: 1,
        features: { devBypass: true },
      };
      const prod = {
        version: 1,
        features: { devBypass: false },
      };

      const issues = validateConfigSchema(dev, prod);
      expect(issues).toHaveLength(0);
    });

    it('should detect missing version field', () => {
      const dev = {
        // No version field
        features: { devBypass: true },
      };
      const prod = {
        version: 1,
        features: { devBypass: false },
      };

      const issues = validateConfigSchema(dev, prod);
      expect(issues.length).toBeGreaterThan(0);
      expect(issues.some(i => i.path === 'version')).toBe(true);
    });
  });
});
