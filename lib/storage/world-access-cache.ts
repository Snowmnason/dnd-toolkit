import { logger } from '../utils/logger';
import { SecureStorage } from './SecureStorage';

/**
 * World Access Cache Helper
 *
 * Centralizes SecureStorage updates for world access flags after mutations.
 * Keeps access metadata synchronized across FastCache and SecureStorage layers.
 *
 * Features:
 * - Updates access flag (boolean) and metadata (timestamp, source)
 * - Non-throwing error handling (storage errors don't break DB operations)
 * - Category logging for audit trail
 */

export const worldAccessCache = {
  /**
   * Update world access flag after successful mutation
   *
   * @param worldId - World identifier
   * @param hasAccess - Whether user has access (true = added, false/remove = deleted)
   * @param source - Mutation source ('create' | 'add' | 'remove' | 'delete')
   *
   * Non-throwing. Logs errors but doesn't fail the mutation.
   */
  async updateAccessFlag(
    worldId: string,
    hasAccess: boolean,
    source: 'create' | 'add' | 'remove' | 'delete'
  ): Promise<void> {
    try {
      const cacheKey = `world_access_${worldId}`;
      const metaKey = `world_access_meta_${worldId}`;

      if (hasAccess) {
        // Set access flag and metadata
        await SecureStorage.setJSON(cacheKey, true);
        await SecureStorage.setJSON(metaKey, {
          timestamp: Date.now(),
          source: `db_mutation:${source}`,
        });
        logger.debug('storage', `Updated world access flag for ${worldId}`);
      } else {
        // Remove access flag, update metadata to reflect removal
        await SecureStorage.removeItem(cacheKey);
        await SecureStorage.setJSON(metaKey, {
          timestamp: Date.now(),
          source: `db_mutation:${source}`,
          removed: true,
        });
        logger.debug('storage', `Removed world access flag for ${worldId}`);
      }
    } catch (error) {
      // Log but do not throw — DB operation is canonical
      logger.error(
        'storage',
        `Failed to update world access cache for ${worldId}`,
        error
      );
    }
  },

  /**
   * Clear access flags for a world (e.g., after delete)
   * Removes both flag and metadata.
   */
  async clearWorldAccess(worldId: string): Promise<void> {
    try {
      const cacheKey = `world_access_${worldId}`;
      const metaKey = `world_access_meta_${worldId}`;

      await SecureStorage.removeItem(cacheKey);
      await SecureStorage.removeItem(metaKey);
      logger.debug('storage', `Cleared all access flags for world ${worldId}`);
    } catch (error) {
      logger.error(
        'storage',
        `Failed to clear world access cache for ${worldId}`,
        error
      );
    }
  },
};
