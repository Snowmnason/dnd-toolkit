/**
 * Real-Time Module
 *
 * Provides semantic real-time event subscriptions with backend-agnostic registry pattern.
 *
 * **When to Use:**
 * - Subscribing to world updates, notifications, or chat messages
 * - Building features that react to live database changes
 * - Implementing collaborative/multiplayer features
 *
 * **When NOT to Use:**
 * - Polling-based updates (prefer QueryCache for periodic API calls)
 * - One-time data fetches (use repositories or GraphQL)
 * - Local-only state changes (use React hooks/context)
 *
 * **Current Status:**
 * - Registry pattern implemented and functional
 * - High-level operations defined (subscribeToWorldUpdates, etc.)
 * - React hook placeholder created
 * - Supabase adapter skeleton created (not registered)
 * - Actual Supabase Realtime API integration pending Phase 2
 *
 * **Examples:**
 *
 * Subscribe to world updates:
 * ```ts
 * import { subscribeToWorldUpdates, unsubscribeFromWorldUpdates } from '@/lib/realtime';
 *
 * const subId = await subscribeToWorldUpdates('world-123', (payload) => {
 *   console.log('World updated:', payload);
 * });
 * // Later: await unsubscribeFromWorldUpdates(subId);
 * ```
 *
 * Subscribe in React component:
 * ```tsx
 * import { useRealtimeChannel } from '@/hooks/realtime/useRealtimeChannel';
 *
 * export function WorldListener({ worldId }: { worldId: string }) {
 *   const { data, error, isConnected } = useRealtimeChannel(
 *     'WORLD_UPDATED',
 *     `world-${worldId}`,
 *     { debug: true }
 *   );
 *
 *   if (error) return <div>Error: {error.message}</div>;
 *   if (!isConnected) return <div>Connecting...</div>;
 *
 *   return <div>World: {JSON.stringify(data)}</div>;
 * }
 * ```
 *
 * @see lib/realtime/registry.ts - Handler registration and subscription management
 * @see lib/realtime/operations.ts - High-level semantic operations
 * @see hooks/realtime/useRealtimeChannel.ts - React hooks
 * @see lib/services/supabase/supabase-realtime-adapter.ts - Supabase implementation (pending)
 */

// Registry API (for testing and advanced usage)
export { getRealtimeHandler, registerRealtimeHandler } from './registry';
export type { RealtimeHandler } from './registry';

// High-level operations (typical usage)
export {
    subscribeToChatMessages, subscribeToNotifications, subscribeToWorldUpdates, unsubscribeFromChatMessages, unsubscribeFromNotifications, unsubscribeFromWorldUpdates
} from './operations';
export type {
    ChatMessagePayload, NotificationPayload, WorldUpdatePayload
} from './operations';

