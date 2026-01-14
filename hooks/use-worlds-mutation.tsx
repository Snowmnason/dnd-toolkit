import { useMutation } from '@/lib/cache';
import { worldsDB, World, CreateWorldData } from '@/lib/database/worlds';

/**
 * Hook for creating a new world with cache invalidation
 *
 * @example
 * ```tsx
 * const { mutate: createWorld, isLoading, error } = useCreateWorldMutation();
 *
 * const handleCreate = async () => {
 *   try {
 *     const newWorld = await createWorld({
 *       name: 'My New World',
 *       description: 'A great adventure',
 *       system: 'dnd5e',
 *       is_dm: true,
 *     });
 *     console.log('World created:', newWorld);
 *   } catch (err) {
 *     console.error('Failed to create world:', err);
 *   }
 * };
 * ```
 */
export function useCreateWorldMutation() {
  const { mutate, data, error, isLoading } = useMutation<World, CreateWorldData>(
    (variables: any) => worldsDB.create(variables as CreateWorldData),
    {
      invalidateTags: ['worlds'],
    },
  );

  return {
    mutate,
    world: data ?? null,
    isLoading,
    error: (error as any)?.message ?? null,
  };
}

/**
 * Hook for updating a world with cache invalidation
 *
 * @example
 * ```tsx
 * const { mutate: updateWorld } = useUpdateWorldMutation();
 *
 * await updateWorld({
 *   worldId: 'world-123',
 *   updates: { name: 'Updated Name' }
 * });
 * ```
 */
export function useUpdateWorldMutation() {
  const { mutate, data, error, isLoading } = useMutation<
    World,
    { worldId: string; updates: Partial<CreateWorldData> }
  >(
    (variables: any) => worldsDB.update((variables as any).worldId, (variables as any).updates),
    {
      invalidateTags: ['worlds'],
    },
  );

  return {
    mutate,
    world: data ?? null,
    isLoading,
    error: (error as any)?.message ?? null,
  };
}

/**
 * Hook for deleting a world with cache invalidation
 *
 * @example
 * ```tsx
 * const { mutate: deleteWorld } = useDeleteWorldMutation();
 *
 * await deleteWorld({ worldId: 'world-123' });
 * ```
 */
export function useDeleteWorldMutation() {
  const { mutate, error, isLoading } = useMutation<void, { worldId: string }>(
    (variables: any) => worldsDB.delete((variables as any).worldId),
    {
      invalidateTags: ['worlds'],
    },
  );

  return {
    mutate,
    isLoading,
    error: (error as any)?.message ?? null,
  };
}
