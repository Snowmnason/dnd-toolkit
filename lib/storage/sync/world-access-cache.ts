import { logger } from '@/lib/utils';
import { getPrivacyStorageBackend } from '@/middleware/storage/helpers/privacy';

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

      const backend = getPrivacyStorageBackend(cacheKey);

      if (hasAccess) {
        // Set access flag and metadata
        await backend.setJSON(cacheKey, true);
        await backend.setJSON(metaKey, {
          timestamp: Date.now(),
          source: `db_mutation:${source}`,
        });
        logger.category('storage').debug(`Updated world access flag for ${worldId}`);
      } else {
        // Remove access flag, update metadata to reflect removal
        await backend.removeItem(cacheKey);
        await backend.setJSON(metaKey, {
          timestamp: Date.now(),
          source: `db_mutation:${source}`,
          removed: true,
        });
        logger.category('storage').debug(`Removed world access flag for ${worldId}`);
      }
    } catch (error) {
      // Log but do not throw — DB operation is canonical
      logger.category('storage').error(
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

      const backend = getPrivacyStorageBackend(cacheKey);
      await backend.removeItem(cacheKey);
      await backend.removeItem(metaKey);
      logger.category('storage').debug(`Cleared all access flags for world ${worldId}`);
    } catch (error) {
      logger.category('storage').error(
        `Failed to clear world access cache for ${worldId}`,
        error
      );
    }
  },
};
