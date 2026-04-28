/**
 * Query Cache Unit Tests
 *
 * Tests for cache operations including:
 * - selectiveInvalidate predicate filtering
 * - Error handling in predicate evaluation
 * - Version bump semantics
 * - Return value correctness
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryCache } from '../../middleware/storage';

// Mock logger to avoid noise in tests
vi.mock('../../lib/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    category: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

// Mock FastCache to prevent actual storage operations
vi.mock('../../system/Storage/', () => ({
  FastCache: {
    setJSON: vi.fn().mockResolvedValue(undefined),
    getJSON: vi.fn().mockResolvedValue(null),
    removeItem: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('QueryCache', () => {
  beforeEach(async () => {
    // Reset the QueryCache instance before each test
    await QueryCache.clear();
  });

  describe('selectiveInvalidate', () => {
    describe('Predicate Filtering', () => {
      it('should invalidate only entries matching the predicate', async () => {
        // Setup: Add multiple cache entries
        await QueryCache.set('world:1', { id: 1, name: 'World 1' });
        await QueryCache.set('world:2', { id: 2, name: 'World 2' });
        await QueryCache.set('user:1', { id: 1, name: 'User 1' });
        await QueryCache.set('user:2', { id: 2, name: 'User 2' });

        // Act: Invalidate only world entries
        const count = await QueryCache.selectiveInvalidate((key) => key.startsWith('world:'));

        // Assert
        expect(count).toBe(2);
        expect(await QueryCache.get('world:1')).toBeNull();
        expect(await QueryCache.get('world:2')).toBeNull();
        expect(await QueryCache.get('user:1')).not.toBeNull();
        expect(await QueryCache.get('user:2')).not.toBeNull();
      });

      it('should return 0 when predicate matches no entries', async () => {
        // Setup: Add cache entries
        await QueryCache.set('world:1', { id: 1, name: 'World 1' });
        await QueryCache.set('world:2', { id: 2, name: 'World 2' });

        // Act: Try to invalidate with non-matching predicate
        const count = await QueryCache.selectiveInvalidate((key) => key.startsWith('user:'));

        // Assert
        expect(count).toBe(0);
        expect(await QueryCache.get('world:1')).not.toBeNull();
        expect(await QueryCache.get('world:2')).not.toBeNull();
      });

      it('should filter by both key and entry data', async () => {
        // Setup: Add entries with different data
        await QueryCache.set('world:1', { id: 1, status: 'active', name: 'World 1' });
        await QueryCache.set('world:2', { id: 2, status: 'archived', name: 'World 2' });
        await QueryCache.set('world:3', { id: 3, status: 'active', name: 'World 3' });

        // Act: Invalidate only archived worlds
        const count = await QueryCache.selectiveInvalidate(
          (key, entry) => key.startsWith('world:') && (entry.data as any).status === 'archived',
        );

        // Assert
        expect(count).toBe(1);
        expect(await QueryCache.get('world:1')).not.toBeNull();
        expect(await QueryCache.get('world:2')).toBeNull();
        expect(await QueryCache.get('world:3')).not.toBeNull();
      });

      it('should invalidate all entries when predicate always returns true', async () => {
        // Setup: Add multiple entries
        await QueryCache.set('key:1', { id: 1 });
        await QueryCache.set('key:2', { id: 2 });
        await QueryCache.set('key:3', { id: 3 });

        // Act: Invalidate with predicate that matches everything
        const count = await QueryCache.selectiveInvalidate(() => true);

        // Assert
        expect(count).toBe(3);
        expect(await QueryCache.get('key:1')).toBeNull();
        expect(await QueryCache.get('key:2')).toBeNull();
        expect(await QueryCache.get('key:3')).toBeNull();
      });
    });

    describe('Predicate Error Handling', () => {
      it('should continue operation when predicate throws for one entry', async () => {
        // Setup: Add cache entries
        await QueryCache.set('world:1', { id: 1, name: 'World 1' });
        await QueryCache.set('world:2', { id: 2, name: 'World 2' });
        await QueryCache.set('world:3', { id: 3, name: 'World 3' });

        // Act: Use predicate that throws for world:2
        const count = await QueryCache.selectiveInvalidate((key, entry) => {
          if (key === 'world:2') {
            throw new Error('Predicate evaluation failed');
          }
          return key.startsWith('world:');
        });

        // Assert: Should still invalidate world:1 and world:3, returning count of 2
        expect(count).toBe(2);
        expect(await QueryCache.get('world:1')).toBeNull();
        expect(await QueryCache.get('world:2')).not.toBeNull(); // Not invalidated due to error
        expect(await QueryCache.get('world:3')).toBeNull();
      });

      it('should handle predicate errors gracefully without throwing to caller', async () => {
        // Setup
        await QueryCache.set('world:1', { id: 1, name: 'World 1' });

        // Act: Use predicate that throws - should not throw to caller
        let threwError = false;
        try {
          await QueryCache.selectiveInvalidate((key) => {
            throw new Error('Test error');
          });
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (err) {
          threwError = true;
        }

        // Assert: Should not throw to caller
        expect(threwError).toBe(false);
      });
    });

    describe('Return Value Correctness', () => {
      it('should return exact count of invalidated entries', async () => {
        // Setup: Add 5 entries, 3 match predicate
        await QueryCache.set('world:1', { id: 1 });
        await QueryCache.set('world:2', { id: 2 });
        await QueryCache.set('world:3', { id: 3 });
        await QueryCache.set('user:1', { id: 1 });
        await QueryCache.set('user:2', { id: 2 });

        // Act: Invalidate world entries
        const count = await QueryCache.selectiveInvalidate((key) => key.startsWith('world:'));

        // Assert: Count should be exact
        expect(count).toBe(3);
      });

      it('should return 0 when no entries match and cache is empty', async () => {
        // Act: Invalidate with empty cache
        const count = await QueryCache.selectiveInvalidate(() => true);

        // Assert
        expect(count).toBe(0);
      });

      it('should return 0 when no entries match predicate', async () => {
        // Setup: Add entries
        await QueryCache.set('world:1', { id: 1 });
        await QueryCache.set('world:2', { id: 2 });

        // Act: Try to invalidate with non-matching predicate
        const count = await QueryCache.selectiveInvalidate((key) => key.startsWith('nonexistent:'));

        // Assert
        expect(count).toBe(0);
        expect(await QueryCache.get('world:1')).not.toBeNull();
        expect(await QueryCache.get('world:2')).not.toBeNull();
      });
    });

    describe('Global Version Bump Semantics', () => {
      it('should bump version only after successful removal', async () => {
        // Setup: Add cache entry
        await QueryCache.set('world:1', { id: 1 });
        const versionBefore = QueryCache.getCurrentVersion();

        // Act: Invalidate entry
        const count = await QueryCache.selectiveInvalidate(() => true);
        const versionAfter = QueryCache.getCurrentVersion();

        // Assert: Version should increment by 1 only if entry was actually removed
        expect(count).toBe(1);
        expect(versionAfter).toBe(versionBefore + 1);
      });

      it('should NOT bump version when no entries match predicate', async () => {
        // Setup: Add cache entry
        await QueryCache.set('world:1', { id: 1 });
        const versionBefore = QueryCache.getCurrentVersion();

        // Act: Invalidate with non-matching predicate
        await QueryCache.selectiveInvalidate((key) => key.startsWith('nonexistent:'));
        const versionAfter = QueryCache.getCurrentVersion();

        // Assert: Version should NOT change
        expect(versionAfter).toBe(versionBefore);
      });

      it('should bump version correctly for multiple entries', async () => {
        // Setup: Add multiple entries
        await QueryCache.set('key:1', { id: 1 });
        await QueryCache.set('key:2', { id: 2 });
        await QueryCache.set('key:3', { id: 3 });
        const versionBefore = QueryCache.getCurrentVersion();

        // Act: Invalidate all 3 entries in one call
        const count = await QueryCache.selectiveInvalidate(() => true);
        const versionAfter = QueryCache.getCurrentVersion();

        // Assert: Version should bump once (not per-entry)
        expect(count).toBe(3);
        expect(versionAfter).toBe(versionBefore + 1);
      });

      it('should prevent stale writes after version bump', async () => {
        // Setup: Add initial entry
        await QueryCache.set('world:1', { id: 1, name: 'Initial' });
        const versionAtStart = QueryCache.getCurrentVersion();

        // Act: Invalidate
        await QueryCache.selectiveInvalidate(() => true);
        const versionAfterInvalidate = QueryCache.getCurrentVersion();

        // Attempt to set with old version (should be rejected)
        await QueryCache.set('world:1', { id: 1, name: 'Stale' }, {}, versionAtStart);

        // Assert: Version bumped
        expect(versionAfterInvalidate).toBeGreaterThan(versionAtStart);

        // The stale write should have been rejected (not cached)
        // This is verified by trying to get it - should be null after invalidation
        // and the stale write didn't restore it
        expect(await QueryCache.get('world:1')).toBeNull();
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty cache', async () => {
        // Act: Invalidate empty cache
        const count = await QueryCache.selectiveInvalidate(() => true);

        // Assert
        expect(count).toBe(0);
      });

      it('should handle predicate that filters by tags', async () => {
        // Setup: Add entries with tags
        await QueryCache.set('world:1', { id: 1 }, { tags: ['admin', 'worlds'] });
        await QueryCache.set('world:2', { id: 2 }, { tags: ['worlds'] });
        await QueryCache.set('user:1', { id: 1 }, { tags: ['users'] });

        // Act: Invalidate entries with 'admin' tag
        const count = await QueryCache.selectiveInvalidate(
          (key, entry) => entry.tags?.includes('admin') ?? false,
        );

        // Assert
        expect(count).toBe(1);
        expect(await QueryCache.get('world:1')).toBeNull();
        expect(await QueryCache.get('world:2')).not.toBeNull();
        expect(await QueryCache.get('user:1')).not.toBeNull();
      });

      it('should maintain cache consistency after invalidation', async () => {
        // Setup: Add entries
        await QueryCache.set('a', { value: 1 });
        await QueryCache.set('b', { value: 2 });
        await QueryCache.set('c', { value: 3 });

        // Act: Invalidate 'b'
        const count = await QueryCache.selectiveInvalidate((key) => key === 'b');

        // Assert: Cache should be in consistent state
        expect(count).toBe(1);
        expect(await QueryCache.get('a')).toEqual({ value: 1 });
        expect(await QueryCache.get('b')).toBeNull();
        expect(await QueryCache.get('c')).toEqual({ value: 3 });
      });

      it('should handle complex predicate logic', async () => {
        // Setup: Add entries with various attributes
        await QueryCache.set('world:1', { id: 1, members: 5, public: true });
        await QueryCache.set('world:2', { id: 2, members: 20, public: false });
        await QueryCache.set('world:3', { id: 3, members: 10, public: true });

        // Act: Invalidate public worlds with < 15 members
        const count = await QueryCache.selectiveInvalidate(
          (key, entry) => {
            const data = entry.data as any;
            return data.public && data.members < 15;
          },
        );

        // Assert
        expect(count).toBe(2); // world:1 and world:3
        expect(await QueryCache.get('world:1')).toBeNull();
        expect(await QueryCache.get('world:2')).not.toBeNull();
        expect(await QueryCache.get('world:3')).toBeNull();
      });
    });
  });
});
