/**
 * usePendingInvite
 *
 * Encapsulates pending-invite storage and processing so auth-redirect.tsx
 * never imports StorageManager, invitesDB, worldsDB, or usersDB directly.
 */

import { invitesDB, usersDB, worldsDB } from "@/lib/database";
import { StorageManager } from "@/lib/storage";
import { STORAGE_KEYS } from "@/maps";

interface PendingInvite {
  token: string;
  worldName: string;
  timestamp: number;
}

const INVITE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export const pendingInviteStorage = {
  async save(token: string, worldName: string): Promise<void> {
    const inviteData: PendingInvite = { token, worldName, timestamp: Date.now() };
    await StorageManager.set(STORAGE_KEYS.PENDING_INVITE, inviteData);
  },

  async get(): Promise<PendingInvite | null> {
    const data = await StorageManager.get<PendingInvite>(STORAGE_KEYS.PENDING_INVITE);
    if (!data) return null;
    if (Date.now() - data.timestamp >= INVITE_TTL_MS) {
      await StorageManager.remove(STORAGE_KEYS.PENDING_INVITE);
      return null;
    }
    return data;
  },

  async clear(): Promise<void> {
    await StorageManager.remove(STORAGE_KEYS.PENDING_INVITE);
  },
};

export interface InviteProcessResult {
  success: boolean;
  alreadyMember?: boolean;
  error?: string;
}

/**
 * Process an invite token for a logged-in user.
 * Validates the token, checks membership, and adds user to world.
 */
export async function processInviteForUser(
  inviteToken: string,
): Promise<InviteProcessResult> {
  const validation = await invitesDB.validateInviteToken(inviteToken);
  if (!validation.success || !validation.worldId) {
    return { success: false, error: validation.error ?? "Invalid invite token" };
  }

  const userProfile = await usersDB.getCurrentUser();
  if (!userProfile) {
    return { success: false, error: "User profile not found" };
  }

  const isAlreadyMember = await worldsDB.isUserInWorld(validation.worldId, userProfile.id);
  if (isAlreadyMember) {
    return { success: true, alreadyMember: true };
  }

  await worldsDB.addUserToWorld(validation.worldId, userProfile.id, inviteToken, "player");
  return { success: true };
}

/**
 * Preload worlds into cache for a user (warms cache before navigation).
 */
export async function preloadWorlds(userId: string): Promise<void> {
  try {
    await worldsDB.getMyWorlds(userId);
  } catch {
    // Non-critical — app still works without warm cache
  }
}
