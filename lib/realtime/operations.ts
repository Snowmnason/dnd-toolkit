/**
 * Real-Time Operations
 *
 * High-level semantic operations for subscribing to world and game events.
 * These wrap the registry and provide type-safe subscription interfaces.
 */

import { logger } from '@/lib/utils/logger';
import {
    unsubscribeFromChannel
} from './registry';

/**
 * World update event payload (placeholder)
 * TODO: Define actual payload structure after researching Supabase Realtime API
 */
export interface WorldUpdatePayload {
  worldId: string;
  // TODO: Add fields like updatedAt, changeType, affectedEntities, etc.
}

/**
 * Notification event payload (placeholder)
 * TODO: Define actual payload structure
 */
export interface NotificationPayload {
  notificationId: string;
  type: string;
  // TODO: Add fields like message, createdAt, read status, etc.
}

/**
 * Chat message event payload (placeholder)
 * TODO: Define actual payload structure
 */
export interface ChatMessagePayload {
  messageId: string;
  channelId: string;
  // TODO: Add fields like sender, content, timestamp, attachments, etc.
}

/**
 * Subscribe to world updates (session, members, settings changes)
 *
 * Uses the WORLD_UPDATED handler to listen for changes to a specific world.
 * (Handler implementation, Supabase schema, and event filtering TBD.)
 *
 * @param worldId - World ID to subscribe to
 * @param onUpdate - Called when world data changes
 * @returns Subscription ID for later unsubscribe
 *
 * @example
 * const subId = await subscribeToWorldUpdates('world-123', (event) => {
 *   console.log('World updated:', event);
 * });
 * // Later: await unsubscribeFromWorldUpdates(subId);
 *
 * TODO: Research Supabase Realtime API for:
 * - Table subscription syntax (postgres_changes filter)
 * - Event filtering (INSERT, UPDATE, DELETE)
 * - Authentication/RLS integration
 * - Schema (worlds table changes)
 */
export async function subscribeToWorldUpdates(
  worldId: string,
  onUpdate: (payload: WorldUpdatePayload) => void
): Promise<string> {
  // No-op — no realtime handlers are registered; real-time is not yet implemented.
  // Fails silently: returns '' so callers won't crash; unsubscribeFromChannel('') is safe.
  //
  // Phase 2 call shape (once Supabase Realtime API is researched):
  //   return subscribeToChannel('WORLD_UPDATED', `world:${worldId}`, onUpdate);
  // Channel name `world:${worldId}` maps to a postgres_changes subscription on the worlds table.
  // See supabase-realtime-adapter.ts for the handler stub.
  logger.category('realtime').warn(
    'subscribeToWorldUpdates() called — realtime not yet implemented, returning no-op',
    { worldId }
  );
  return '';
}

/**
 * Unsubscribe from world updates
 *
 * @param subscriptionId - Subscription ID from subscribeToWorldUpdates
 */
export async function unsubscribeFromWorldUpdates(subscriptionId: string): Promise<void> {
  await unsubscribeFromChannel(subscriptionId);
}

/**
 * Subscribe to notifications for the current user
 *
 * (Handler implementation, Supabase schema, and filtering TBD.)
 *
 * @param userId - User ID to subscribe notifications for
 * @param onNotification - Called when a new notification arrives
 * @returns Subscription ID
 *
 * @example
 * const subId = await subscribeToNotifications(userId, (notif) => {
 *   console.log('New notification:', notif);
 * });
 *
 * TODO: Research Supabase Realtime API for:
 * - User-scoped channels (usually 'user:{userId}' or similar)
 * - Notifications table schema
 * - RLS policies (users can only subscribe to their own notifications)
 * - Filtering by notification type/status
 */
export async function subscribeToNotifications(
  userId: string,
  onNotification: (payload: NotificationPayload) => void
): Promise<string> {
  // No-op — no realtime handlers are registered; real-time is not yet implemented.
  // Fails silently: returns '' so callers won't crash; unsubscribeFromChannel('') is safe.
  //
  // Phase 2 call shape:
  //   return subscribeToChannel('NOTIFICATION_RECEIVED', `user:${userId}:notifications`, onNotification);
  logger.category('realtime').warn(
    'subscribeToNotifications() called — realtime not yet implemented, returning no-op',
    { userId }
  );
  return '';
}

/**
 * Unsubscribe from notifications
 *
 * @param subscriptionId - Subscription ID from subscribeToNotifications
 */
export async function unsubscribeFromNotifications(subscriptionId: string): Promise<void> {
  await unsubscribeFromChannel(subscriptionId);
}

/**
 * Subscribe to chat messages in a channel
 *
 * (Handler implementation, Supabase schema, and filtering TBD.)
 *
 * @param channelId - Chat channel ID
 * @param onMessage - Called when a new message arrives
 * @returns Subscription ID
 *
 * @example
 * const subId = await subscribeToChatMessages('channel-123', (msg) => {
 *   console.log('New message:', msg);
 * });
 *
 * TODO: Research Supabase Realtime API for:
 * - Chat table schema (messages, channels, members)
 * - Channel subscription syntax
 * - RLS policies (only channel members can subscribe)
 * - Filtering by channel and message order
 * - Potential: presence data (who's currently typing)
 */
export async function subscribeToChatMessages(
  channelId: string,
  onMessage: (payload: ChatMessagePayload) => void
): Promise<string> {
  // No-op — no realtime handlers are registered; real-time is not yet implemented.
  // Fails silently: returns '' so callers won't crash; unsubscribeFromChannel('') is safe.
  //
  // Phase 2 call shape:
  //   return subscribeToChannel('CHAT_MESSAGE', `chat:${channelId}`, onMessage);
  logger.category('realtime').warn(
    'subscribeToChatMessages() called — realtime not yet implemented, returning no-op',
    { channelId }
  );
  return '';
}

/**
 * Unsubscribe from chat messages
 *
 * @param subscriptionId - Subscription ID from subscribeToChatMessages
 */
export async function unsubscribeFromChatMessages(subscriptionId: string): Promise<void> {
  await unsubscribeFromChannel(subscriptionId);
}
