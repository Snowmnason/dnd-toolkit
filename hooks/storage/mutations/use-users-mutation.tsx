'use client';

import { UpdateUserData, User, usersDB } from '@/lib/database';
import { useMutation } from '../use-mutation';

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
  const { mutate, data, error, isLoading } = useMutation<User, UpdateUserData>(
    (variables: any) => usersDB.updateCurrentUser(variables as UpdateUserData),
    {
      invalidateTags: ['users'],
    },
  );

  return {
    mutate,
    user: data ?? null,
    isLoading,
    error: (error as any)?.message ?? null,
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
  const { mutate, error, isLoading } = useMutation<boolean, void>(
    () => usersDB.deleteCurrentUser(),
    {
      invalidateTags: ['users'],
    },
  );

  return {
    mutate,
    isLoading,
    error: (error as any)?.message ?? null,
  };
}
