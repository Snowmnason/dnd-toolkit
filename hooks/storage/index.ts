// Barrel export for query hooks
export { getCurrentUserProfile, useCurrentUser } from "./queries/use-current-user";
export { useCurrentUserQuery, useUserQuery } from "./queries/use-users-query";
export { useWorlds } from "./queries/use-worlds";
export { useWorldsQuery } from "./queries/use-worlds-query";

// Database type re-exports (screen-safe path)
export type { AccessRole, WorldWithAccess } from "@/lib/database";

// Barrel export for mutation hooks
export {
    useCreateInviteLinkMutation,
    useValidateInviteTokenMutation
} from "./mutations/use-invites-mutation";
export {
    useDeleteAccountMutation, useUpdateUserMutation
} from "./mutations/use-users-mutation";
export {
    useCreateWorldMutation, useDeleteWorldMutation, useUpdateWorldMutation
} from "./mutations/use-worlds-mutation";

export { useQuery } from './use-query';
export type { UseQueryOptions, UseQueryState } from './use-query';

export { useMutation } from './use-mutation';
export type { UseMutationOptions, UseMutationState } from './use-mutation';




/*
export { useAssetQuery } from "./use-asset-query";
export { useEntitlementsQuery } from "./use-entitlements-query";
export { useFeatureFlagsQuery } from "./use-feature-flags-query";
export { useInstanceQuery } from "./use-instance-query";
export { useWorldDetailsQuery } from "./use-world-details-query";
*/