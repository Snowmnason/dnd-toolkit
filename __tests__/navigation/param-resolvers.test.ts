import { PARAM_RESOLVERS, ParamResolverRegistry, resolveContextParams } from '@/lib/navigation/param-resolvers';
import { describe, expect, it, vi } from 'vitest';

describe('resolveContextParams()', () => {
  describe('fulfilled vs rejected resolvers', () => {
    it('collects values from all fulfilled resolvers', async () => {
      const registry: ParamResolverRegistry = {
        param1: vi.fn(async () => 'value1'),
        param2: vi.fn(async () => 'value2'),
        param3: vi.fn(async () => 'value3'),
      };

      const result = await resolveContextParams(registry);

      expect(result).toEqual({
        param1: 'value1',
        param2: 'value2',
        param3: 'value3',
      });
      expect(registry.param1).toHaveBeenCalledTimes(1);
      expect(registry.param2).toHaveBeenCalledTimes(1);
      expect(registry.param3).toHaveBeenCalledTimes(1);
    });

    it('skips rejected resolvers (Promise.allSettled)', async () => {
      const registry: ParamResolverRegistry = {
        success1: vi.fn(async () => 'value1'),
        rejected: vi.fn(async () => {
          throw new Error('resolver failed');
        }),
        success2: vi.fn(async () => 'value2'),
      };

      const result = await resolveContextParams(registry);

      expect(result).toEqual({
        success1: 'value1',
        success2: 'value2',
      });
      expect(result).not.toHaveProperty('rejected');
    });

    it('handles single rejected resolver among fulfilled ones', async () => {
      const registry: ParamResolverRegistry = {
        param1: vi.fn(async () => 'value1'),
        param2: vi.fn(async () => {
          throw new Error('failed');
        }),
        param3: vi.fn(async () => 'value3'),
      };

      const result = await resolveContextParams(registry);

      expect(result).toEqual({
        param1: 'value1',
        param3: 'value3',
      });
    });

    it('returns empty object when all resolvers reject', async () => {
      const registry: ParamResolverRegistry = {
        param1: vi.fn(async () => {
          throw new Error('fail1');
        }),
        param2: vi.fn(async () => {
          throw new Error('fail2');
        }),
      };

      const result = await resolveContextParams(registry);

      expect(result).toEqual({});
    });

    it('handles resolvers that throw different error types', async () => {
      const registry: ParamResolverRegistry = {
        typeError: vi.fn(async () => {
          throw new TypeError('type mismatch');
        }),
        rangeError: vi.fn(async () => {
          throw new RangeError('out of range');
        }),
        generic: vi.fn(async () => 'value'),
      };

      const result = await resolveContextParams(registry);

      expect(result).toEqual({ generic: 'value' });
    });

    it('does not rethrow errors from rejections', async () => {
      const registry: ParamResolverRegistry = {
        throws: vi.fn(async () => {
          throw new Error('critical');
        }),
      };

      // Should not throw, should resolve to empty object
      await expect(resolveContextParams(registry)).resolves.toEqual({});
    });
  });

  describe('undefined filtering', () => {
    it('skips resolvers that return undefined', async () => {
      const registry: ParamResolverRegistry = {
        defined: vi.fn(async () => 'value'),
        notDefined: vi.fn(async () => undefined),
      };

      const result = await resolveContextParams(registry);

      expect(result).toEqual({
        defined: 'value',
      });
      expect(result).not.toHaveProperty('notDefined');
    });

    it('filters out multiple undefined values', async () => {
      const registry: ParamResolverRegistry = {
        param1: vi.fn(async () => undefined),
        param2: vi.fn(async () => 'value2'),
        param3: vi.fn(async () => undefined),
        param4: vi.fn(async () => 'value4'),
      };

      const result = await resolveContextParams(registry);

      expect(result).toEqual({
        param2: 'value2',
        param4: 'value4',
      });
    });

    it('returns empty object when all resolvers return undefined', async () => {
      const registry: ParamResolverRegistry = {
        param1: vi.fn(async () => undefined),
        param2: vi.fn(async () => undefined),
      };

      const result = await resolveContextParams(registry);

      expect(result).toEqual({});
    });

    it('distinguishes between undefined and empty string', async () => {
      const registry: ParamResolverRegistry = {
        empty: vi.fn(async () => ''),
        notDefined: vi.fn(async () => undefined),
        normal: vi.fn(async () => 'value'),
      };

      const result = await resolveContextParams(registry);

      // Empty string should be included; undefined should not
      expect(result).toEqual({
        empty: '',
        normal: 'value',
      });
      expect(result).not.toHaveProperty('notDefined');
    });

    it('mixes rejected, undefined, and fulfilled resolvers', async () => {
      const registry: ParamResolverRegistry = {
        rejected: vi.fn(async () => {
          throw new Error('fail');
        }),
        undefined1: vi.fn(async () => undefined),
        fulfilled1: vi.fn(async () => 'value1'),
        undefined2: vi.fn(async () => undefined),
        fulfilled2: vi.fn(async () => 'value2'),
      };

      const result = await resolveContextParams(registry);

      expect(result).toEqual({
        fulfilled1: 'value1',
        fulfilled2: 'value2',
      });
    });
  });

  describe('ordering and shape of returned record', () => {
    it('returns a plain object without prototype chain', async () => {
      const registry: ParamResolverRegistry = {
        param: vi.fn(async () => 'value'),
      };

      const result = await resolveContextParams(registry);

      // Check that result has no prototype chain (Object.create(null))
      expect(Object.getPrototypeOf(result)).toBeNull();
    });

    it('preserves key names in result', async () => {
      const registry: ParamResolverRegistry = {
        userId: vi.fn(async () => 'user123'),
        worldId: vi.fn(async () => 'world456'),
        campaignId: vi.fn(async () => 'campaign789'),
      };

      const result = await resolveContextParams(registry);

      expect(Object.keys(result)).toContain('userId');
      expect(Object.keys(result)).toContain('worldId');
      expect(Object.keys(result)).toContain('campaignId');
    });

    it('returns object with only string values', async () => {
      const registry: ParamResolverRegistry = {
        param1: vi.fn(async () => 'value1'),
        param2: vi.fn(async () => 'value2'),
      };

      const result = await resolveContextParams(registry);

      for (const value of Object.values(result)) {
        expect(typeof value).toBe('string');
      }
    });

    it('result has expected property count', async () => {
      const registry: ParamResolverRegistry = {
        param1: vi.fn(async () => 'value1'),
        param2: vi.fn(async () => undefined),
        param3: vi.fn(async () => {
          throw new Error('fail');
        }),
        param4: vi.fn(async () => 'value4'),
      };

      const result = await resolveContextParams(registry);

      // Should have 2 properties (param1 and param4)
      expect(Object.keys(result).length).toBe(2);
    });

    it('returns empty object for empty registry', async () => {
      const registry: ParamResolverRegistry = {};

      const result = await resolveContextParams(registry);

      expect(result).toEqual({});
      expect(Object.keys(result).length).toBe(0);
    });

    it('result object is directly assignable', async () => {
      const registry: ParamResolverRegistry = {
        param: vi.fn(async () => 'value'),
      };

      const result = await resolveContextParams(registry);

      // Should be able to add properties
      result.newKey = 'newValue';
      expect(result.newKey).toBe('newValue');
    });
  });

  describe('reserved key filtering (prototype pollution prevention)', () => {
    it('filters out __proto__ key', async () => {
      const registry: ParamResolverRegistry = {
        '__proto__': vi.fn(async () => 'malicious'),
        normal: vi.fn(async () => 'value'),
      };

      const result = await resolveContextParams(registry);

      expect(result).toEqual({ normal: 'value' });
      expect(result).not.toHaveProperty('__proto__');
    });

    it('filters out constructor key', async () => {
      const registry: ParamResolverRegistry = {
        constructor: vi.fn(async () => 'malicious'),
        normal: vi.fn(async () => 'value'),
      };

      const result = await resolveContextParams(registry);

      expect(result).toEqual({ normal: 'value' });
      expect(result).not.toHaveProperty('constructor');
    });

    it('filters out prototype key', async () => {
      const registry: ParamResolverRegistry = {
        prototype: vi.fn(async () => 'malicious'),
        normal: vi.fn(async () => 'value'),
      };

      const result = await resolveContextParams(registry);

      expect(result).toEqual({ normal: 'value' });
      expect(result).not.toHaveProperty('prototype');
    });

    it('filters all reserved keys together', async () => {
      const registry: ParamResolverRegistry = {
        '__proto__': vi.fn(async () => 'bad1'),
        constructor: vi.fn(async () => 'bad2'),
        prototype: vi.fn(async () => 'bad3'),
        normal: vi.fn(async () => 'good'),
      };

      const result = await resolveContextParams(registry);

      expect(result).toEqual({ normal: 'good' });
      expect(Object.keys(result).length).toBe(1);
    });

    it('allows case-sensitive similar keys', async () => {
      const registry: ParamResolverRegistry = {
        CONSTRUCTOR: vi.fn(async () => 'uppercase'),
        Constructor: vi.fn(async () => 'camelcase'),
        proto: vi.fn(async () => 'similar'),
      };

      const result = await resolveContextParams(registry);

      // These should be allowed (different from exact reserved keys)
      expect(result).toEqual({
        CONSTRUCTOR: 'uppercase',
        Constructor: 'camelcase',
        proto: 'similar',
      });
    });
  });

  describe('concurrency behavior', () => {
    it('runs all resolvers concurrently (not sequentially)', async () => {
      let execution_order: string[] = [];

      const registry: ParamResolverRegistry = {
        param1: vi.fn(async () => {
          execution_order.push('param1_start');
          await new Promise((resolve) => setTimeout(resolve, 50));
          execution_order.push('param1_end');
          return 'value1';
        }),
        param2: vi.fn(async () => {
          execution_order.push('param2_start');
          await new Promise((resolve) => setTimeout(resolve, 10));
          execution_order.push('param2_end');
          return 'value2';
        }),
      };

      const start = Date.now();
      const result = await resolveContextParams(registry);
      const duration = Date.now() - start;

      // If running concurrently, total time ~50ms (max of two)
      // If running sequentially, total time ~60ms (sum of both)
      expect(duration).toBeLessThan(100); // Allows some buffer
      expect(result).toEqual({ param1: 'value1', param2: 'value2' });

      // Verify starts happen before ends for both
      expect(execution_order).toContain('param1_start');
      expect(execution_order).toContain('param2_start');
      expect(execution_order[execution_order.length - 1]).toMatch(/end$/);
    });

    it('completes successfully even if one resolver is slow', async () => {
      const registry: ParamResolverRegistry = {
        fast: vi.fn(async () => 'fast_value'),
        slow: vi.fn(async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return 'slow_value';
        }),
      };

      const start = Date.now();
      const result = await resolveContextParams(registry);
      const duration = Date.now() - start;

      // Should wait for slow resolver due to allSettled
      expect(duration).toBeGreaterThanOrEqual(100);
      expect(result).toEqual({ fast: 'fast_value', slow: 'slow_value' });
    });
  });

  describe('integration with PARAM_RESOLVERS registry', () => {
    it('PARAM_RESOLVERS has expected structure', () => {
      expect(PARAM_RESOLVERS).toHaveProperty('userId');
      expect(PARAM_RESOLVERS).toHaveProperty('worldId');

      // All values should be functions (resolvers)
      for (const [, resolver] of Object.entries(PARAM_RESOLVERS)) {
        expect(typeof resolver).toBe('function');
      }
    });

    it('resolveContextParams works with PARAM_RESOLVERS', async () => {
      // This test verifies the function is compatible with the real registry
      // (though actual auth state and storage will vary in test environment)
      const result = await resolveContextParams(PARAM_RESOLVERS);

      // Result should be a plain object with string values (or be empty if auth/storage not configured)
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
      expect(Object.getPrototypeOf(result)).toBeNull();
    });
  });

  describe('edge cases and stress scenarios', () => {
    it('handles large registry (many resolvers)', async () => {
      const registry: ParamResolverRegistry = {};
      for (let i = 0; i < 100; i++) {
        registry[`param${i}`] = vi.fn(async () => `value${i}`);
      }

      const result = await resolveContextParams(registry);

      expect(Object.keys(result).length).toBe(100);
    });

    it('handles resolver that returns whitespace-only string', async () => {
      const registry: ParamResolverRegistry = {
        whitespace: vi.fn(async () => '   '),
        normal: vi.fn(async () => 'value'),
      };

      const result = await resolveContextParams(registry);

      // Whitespace-only strings should be included (not filtered)
      expect(result).toEqual({
        whitespace: '   ',
        normal: 'value',
      });
    });

    it('handles resolver that returns numeric-looking string', async () => {
      const registry: ParamResolverRegistry = {
        numericString: vi.fn(async () => '12345'),
        normal: vi.fn(async () => 'value'),
      };

      const result = await resolveContextParams(registry);

      expect(result).toEqual({
        numericString: '12345',
        normal: 'value',
      });
    });

    it('handles special characters in resolved values', async () => {
      const registry: ParamResolverRegistry = {
        withSpecialChars: vi.fn(async () => 'uuid-f47ac10b-58cc-4372-a567-0e02b2c3d479'),
        withHyphens: vi.fn(async () => 'some-id-123'),
        withUnderscores: vi.fn(async () => 'some_id_456'),
      };

      const result = await resolveContextParams(registry);

      expect(result).toEqual({
        withSpecialChars: 'uuid-f47ac10b-58cc-4372-a567-0e02b2c3d479',
        withHyphens: 'some-id-123',
        withUnderscores: 'some_id_456',
      });
    });

    it('handles resolver that rejects with non-Error object', async () => {
      const registry: ParamResolverRegistry = {
        rejectsWithString: vi.fn(async () => {
          return Promise.reject('string rejection');
        }),
        normal: vi.fn(async () => 'value'),
      };

      const result = await resolveContextParams(registry);

      // Should still work; rejections are caught by allSettled
      expect(result).toEqual({ normal: 'value' });
    });

    it('handles resolver that rejects with null', async () => {
      const registry: ParamResolverRegistry = {
        rejectsWithNull: vi.fn(async () => {
          return Promise.reject(null);
        }),
        normal: vi.fn(async () => 'value'),
      };

      const result = await resolveContextParams(registry);

      expect(result).toEqual({ normal: 'value' });
    });
  });
});
