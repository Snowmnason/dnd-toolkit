import { useQuery } from '@/lib/cache';
import { usersDB } from '@/lib/database/users';

/**
 * Hook for fetching current user profile with SWR pattern
 *
 * @example
 * ```tsx
 * const { user, isLoading, error, refetch } = useCurrentUserQuery();
 *
 * if (isLoading) return <Loading />;
 * if (!user) return <NotAuthenticated />;
 *
 * return <UserProfile user={user} />;
 * ```
 */
export function useCurrentUserQuery() {
  const { data, error, isLoading, isValidating, refetch, invalidate } = useQuery(
    'users:current',
    () => usersDB.getCurrentUser().then(user => {
      if (!user) throw new Error('Not authenticated');
      return user;
    }),
    {
      staleTime: 1 * 60 * 60 * 1000, // 1 hour
      cacheTime: 4 * 60 * 60 * 1000, // 4 hours
      tags: ['users'],
    },
  );

  return {
    user: data ?? null,
    isLoading,
    isValidating,
    error: error?.message ?? null,
    refetch,
    invalidate,
  };
}

/**
 * Hook for fetching a specific user by ID with SWR pattern
 *
 * @param userId - The user ID to fetch (null to disable query)
 * @example
 * ```tsx
 * const { user, isLoading } = useUserQuery(userId);
 * ```
 */
export function useUserQuery(userId: string | null) {
  const { data, error, isLoading, isValidating, refetch, invalidate } = useQuery(
    `user:${userId}`,
    userId ? () => usersDB.getCurrentUser().then(user => {
      if (!user) throw new Error('User not found');
      return user;
    }) : async () => null,
    {
      disabled: !userId,
      staleTime: 30 * 60 * 1000, // 30 minutes
      cacheTime: 2 * 60 * 60 * 1000, // 2 hours
      tags: ['users', userId ? `user:${userId}` : ''],
    },
  );

  return {
    user: data ?? null,
    isLoading,
    isValidating,
    error: error?.message ?? null,
    refetch,
    invalidate,
  };
}
