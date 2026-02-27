'use client';

import { QueryCache } from '@/lib/cache';
import { UpdateUserData, User, usersDB } from '@/lib/database/users';
import { logger } from '@/lib/utils/logger';
import { useCallback, useState } from 'react';

/**
 * Hook for updating current user profile with cache invalidation
 *
 * @example
 * ```tsx
 * const { mutate: updateUser, isLoading } = useUpdateUserMutation();
 *
 * const handleUpdate = async () => {
 *   try {
 *     const updated = await updateUser({
 *       username: 'newusername'
 *     });
 *     console.log('User updated:', updated);
 *   } catch (err) {
 *     console.error('Update failed:', err);
 *   }
 * };
 * ```
 */
export function useUpdateUserMutation() {
  const [data, setData] = useState<User | undefined>(undefined);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const mutate = useCallback(
    async (userData: UpdateUserData): Promise<User> => {
      try {
        setIsLoading(true);
        setUpdateError(null);

        const result = await usersDB.updateCurrentUser(userData);
        setData(result);

        // Invalidate user cache
        await QueryCache.invalidateByTags(['users']);

        return result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        logger.category('other').error('Failed to update user:', err);
        setUpdateError(errorMsg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  return {
    mutate,
    user: data ?? null,
    isLoading,
    error: updateError,
  };
}

/**
 * Hook for deleting current user account with cache invalidation
 *
 * @example
 * ```tsx
 * const { mutate: deleteAccount, isLoading } = useDeleteAccountMutation();
 *
 * const handleDelete = async () => {
 *   await deleteAccount();
 * };
 * ```
 */
export function useDeleteAccountMutation() {
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const mutate = useCallback(
    async (): Promise<boolean> => {
      try {
        setIsLoading(true);
        setDeleteError(null);

        const result = await usersDB.deleteCurrentUser();

        return result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        logger.category('other').error('Failed to delete account:', err);
        setDeleteError(errorMsg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  return {
    mutate,
    isLoading,
    error: deleteError,
  };
}
