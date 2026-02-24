/**
 * Real-Time Handler Registry
 *
 * Manages semantic real-time event handlers and routes them to registered backend
 * implementations (Supabase Realtime, Firebase Realtime Database, Socket.io, etc).
 *
 * Architecture mirrors lib/database/edge/registry.ts and lib/storage/buckets/registry.ts:
 * - Registry maps handler names to implementations
 * - Subscriptions are backend-agnostic (semantic names: WORLD_UPDATED, not supabaseWorldUpdate)
 * - Implementations registered at app bootstrap
 * - Tests can register mock handlers without touching production code
 */

import { logger } from '@/lib/utils/logger';

/**
 * Generic real-time handler interface
 * Represents a backend-specific implementation of a semantic real-time subscription
 */
export interface RealtimeHandler<Payload = any> {
  /**
   * Note: `name` is intentionally absent — keyed by the string passed to
   * registerRealtimeHandler(). Use getRegisteredRealtimeHandlers() for introspection.
   */
  subscribe: (channel: string, onMessage: (payload: Payload) => void) => Promise<string>; // returns subscription ID
  unsubscribe: (subscriptionId: string) => Promise<void>;
}

/**
 * Service registry for real-time handlers
 * Singleton that holds all registered real-time handler implementations
 */
// Note on type erasure: Map<string, RealtimeHandler<any>> erases the Payload generic at the
// registry boundary — all handlers are stored as RealtimeHandler<any>. This is intentional:
// type safety is enforced at the operations layer (subscribeToWorldUpdates, etc.) where each
// function knows its specific payload type. The registry itself is payload-agnostic by design.
let registeredHandlers: Map<string, RealtimeHandler<any>> = new Map();
let activeSubscriptions: Map<string, { channel: string; cleanup: () => Promise<void> }> =
  new Map();

/**
 * Register a real-time handler implementation
 *
 * Called during app bootstrap to wire up backend-specific implementations.
 * Can be called multiple times; later registrations override earlier ones.
 *
 * @param handlerName - Semantic name (e.g., 'WORLD_UPDATED', 'INVITE_RECEIVED')
 * @param handler - Implementation with subscribe/unsubscribe functions
 *
 * @example
 * registerRealtimeHandler('WORLD_UPDATED', supabaseAdapter.createWorldUpdatedHandler());
 */
export function registerRealtimeHandler(
  handlerName: string,
  handler: RealtimeHandler
): void {
  registeredHandlers.set(handlerName, handler);
  logger.category('realtime').debug(`Registered realtime handler: ${handlerName}`);
}

/**
 * Get a registered real-time handler by name
 *
 * @param handlerName - Semantic name (e.g., 'WORLD_UPDATED')
 * @returns The handler, or undefined if not registered
 */
export function getRealtimeHandler(handlerName: string): RealtimeHandler | undefined {
  return registeredHandlers.get(handlerName);
}

/**
 * Check if a real-time handler is registered
 *
 * @param handlerName - Semantic name
 * @returns true if the handler has been registered
 */
export function isRealtimeHandlerRegistered(handlerName: string): boolean {
  return registeredHandlers.has(handlerName);
}

/**
 * Get all registered real-time handler names
 *
 * @returns Array of registered handler names
 */
export function getRegisteredRealtimeHandlers(): string[] {
  return Array.from(registeredHandlers.keys());
}

/**
 * Subscribe to a real-time channel
 *
 * @param handlerName - Semantic handler name (e.g., 'WORLD_UPDATED')
 * @param channel - Channel/topic name to subscribe to (e.g., 'world-123')
 * @param onMessage - Callback invoked when message arrives
 * @returns Subscription ID for later unsubscribe
 *
 * @throws Error if the handler is not registered
 *
 * @example
 * const subId = await subscribeToChannel('WORLD_UPDATED', 'world-123', (payload) => {
 *   console.log('World updated:', payload);
 * });
 * // Later: await unsubscribeFromChannel(subId);
 */
export async function subscribeToChannel<T = any>(
  handlerName: string,
  channel: string,
  onMessage: (payload: T) => void
): Promise<string> {
  const handler = getRealtimeHandler(handlerName);

  if (!handler) {
    logger.category('realtime').error(`Realtime handler not registered: ${handlerName}`, {
      handlerName,
      availableHandlers: getRegisteredRealtimeHandlers(),
    });
    throw new Error(
      `Realtime handler "${handlerName}" is not registered. ` +
        `Available handlers: ${getRegisteredRealtimeHandlers().join(', ')}`
    );
  }

  try {
    logger.category('realtime').debug(`Subscribing to realtime handler: ${handlerName}`, {
      handlerName,
      channel,
    });

    const subscriptionId = await handler.subscribe(channel, onMessage);
    activeSubscriptions.set(subscriptionId, {
      channel,
      cleanup: () => handler.unsubscribe(subscriptionId),
    });

    logger.category('realtime').debug(`Subscribed to realtime: ${handlerName}`, {
      handlerName,
      channel,
      subscriptionId,
    });

    return subscriptionId;
  } catch (err) {
    logger.category('realtime').error(`Failed to subscribe to realtime: ${handlerName}`, {
      handlerName,
      channel,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/**
 * Unsubscribe from a real-time channel
 *
 * @param subscriptionId - Subscription ID returned from subscribeToChannel
 */
export async function unsubscribeFromChannel(subscriptionId: string): Promise<void> {
  const subscription = activeSubscriptions.get(subscriptionId);

  if (!subscription) {
    logger.category('realtime').warn(`Subscription not found: ${subscriptionId}`);
    return;
  }

  try {
    logger.category('realtime').debug(`Unsubscribing from realtime: ${subscriptionId}`, {
      subscriptionId,
      channel: subscription.channel,
    });

    await subscription.cleanup();
    activeSubscriptions.delete(subscriptionId);

    logger.category('realtime').debug(`Unsubscribed from realtime: ${subscriptionId}`);
  } catch (err) {
    logger.category('realtime').error(`Failed to unsubscribe from realtime: ${subscriptionId}`, {
      subscriptionId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/**
 * Get all active subscriptions (for debugging/cleanup)
 *
 * @returns Array of subscription IDs
 * @internal
 */
export function getActiveSubscriptions(): string[] {
  return Array.from(activeSubscriptions.keys());
}

/**
 * Clear all realtime handlers and subscriptions (for testing)
 *
 * @internal
 */
export function clearRealtimeRegistry(): void {
  registeredHandlers.clear();
  activeSubscriptions.clear();
  logger.category('realtime').debug('Cleared realtime registry and subscriptions');
}
