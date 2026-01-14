import { useMutation } from '@/lib/cache';
import { createInviteLink, validateInviteToken } from '@/lib/database/invites';

export interface InviteLink {
  id: string;
  world_id: string;
  created_by: string;
  token: string;
  expires_at: string;
  created_at: string;
}

/**
 * Hook for creating an invite link with cache invalidation
 *
 * @example
 * ```tsx
 * const { mutate: createInvite, isLoading, error } = useCreateInviteLinkMutation();
 *
 * const handleCreateInvite = async () => {
 *   try {
 *     const result = await createInvite({
 *       worldId: 'world-123',
 *       hoursValid: 48,
 *     });
 *     if (result.success) {
 *       console.log('Invite created:', result.inviteLink?.token);
 *     }
 *   } catch (err) {
 *     console.error('Failed to create invite:', err);
 *   }
 * };
 * ```
 */
export function useCreateInviteLinkMutation() {
  const { mutate, data, error, isLoading } = useMutation<
    { success: boolean; inviteLink?: InviteLink; error?: string },
    { worldId: string; hoursValid?: number }
  >(
    (variables) => createInviteLink(variables),
    {
      invalidatePatterns: [(worldId) => new RegExp(`^world:.*:invites`)],
    },
  );

  return {
    mutate,
    result: data ?? null,
    isLoading,
    error: error?.message ?? null,
  };
}

/**
 * Hook for validating an invite token
 *
 * @example
 * ```tsx
 * const { mutate: validateInvite } = useValidateInviteTokenMutation();
 *
 * const handleValidate = async (token: string) => {
 *   const result = await validateInvite({ token });
 *   if (result.success) {
 *     console.log('Valid world:', result.worldId);
 *   }
 * };
 * ```
 */
export function useValidateInviteTokenMutation() {
  const { mutate, data, error, isLoading } = useMutation<
    { success: boolean; worldId?: string; error?: string },
    { token: string }
  >(
    (variables) => validateInviteToken(variables.token),
  );

  return {
    mutate,
    result: data ?? null,
    isLoading,
    error: error?.message ?? null,
  };
}
