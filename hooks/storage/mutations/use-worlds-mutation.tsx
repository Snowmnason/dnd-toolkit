import { CreateWorldData, World, worldsDB } from '@/lib/database';
import { useMutation } from '../use-mutation';

/**
 * Hook for creating a new world with cache invalidation and optimistic updates
 *
 * @example
 * ```tsx
 * const { mutate: createWorld, isLoading, error } = useCreateWorldMutation();
 *
 * // With optimistic update
 * const optimisticWorld: World = {
 *   world_id: 'temp-' + Date.now(),
 *   owner_id: userId,
 *   name: 'New World',
 *   description: 'A great adventure',
 *   system: 'dnd5e',
 *   is_dm: true,
 *   map_image_url: null,
 *   created_at: new Date().toISOString(),
 *   updated_at: new Date().toISOString(),
 * };
 *
 * const handleCreate = async () => {
 *   try {
 *     await createWorld({
 *       name: 'New World',
 *       description: 'A great adventure',
 *       system: 'dnd5e',
 *       is_dm: true,
 *       optimisticWorld, // Pass the optimistic data
 *     });
 *   } catch (err) {
 *     // Optimistic update will be reverted automatically
 *     console.error('Failed to create world:', err);
 *   }
 * };
 * ```
 */
export function useCreateWorldMutation() {
  const { mutate, data, error, isLoading } = useMutation<
    World,
    CreateWorldData & { optimisticWorld?: World }
  >(
    (variables: any) => worldsDB.create(variables as CreateWorldData),
    {
      invalidateTags: ['worlds'],
      optimisticUpdate: (variables: any) => {
        // If optimisticWorld is provided, prepend it to the list
        if (variables.optimisticWorld) {
          return (prevData: any) => {
            // Handle both paginated and non-paginated cache formats
            if (prevData?.items) {
              return {
                ...prevData,
                items: [variables.optimisticWorld, ...prevData.items],
                total: prevData.total + 1,
              };
            }
            // Non-paginated format (array of worlds)
            if (Array.isArray(prevData)) {
              return [variables.optimisticWorld, ...prevData];
            }
            return prevData;
          };
        }
        return undefined;
      },
      // Target only 'worlds' tagged cache entries for better performance
      optimisticTags: ['worlds'],
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
