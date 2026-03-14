/**
 * Auth Subscription Manager
 *
 * Centralized registry for auth-related subscriptions (onAuthStateChange listeners).
 * Provides bulk unsubscribe during sign-out to prevent zombie guard subscriptions
 * from interfering with re-login flows.
 *
 * Usage:
 *   // Register a subscription (e.g., in useAuthGuard)
 *   const unsubscribe = listenToAuthStateChanges(callback);
 *   AuthSubscriptionManager.register(instanceId, unsubscribe);
 *
 *   // On component unmount
 *   AuthSubscriptionManager.unregister(instanceId);
 *
 *   // On sign-out (kills all zombie subscriptions)
 *   AuthSubscriptionManager.unsubscribeAll();
 */

import { logger } from '@/lib/utils/logger';

// Global flag indicating sign-out is in progress.
// Auth guards check this to avoid acting on stale state during sign-out transitions.
let _isSigningOut = false;

const _subscriptions = new Map<string, () => void>();

export const AuthSubscriptionManager = {
  /**
   * Register an auth subscription with a unique ID.
   * The unsubscribe function will be called on bulk unsubscribe or individual removal.
   */
  register(id: string, unsubscribe: () => void): void {
    // If there's already a subscription with this ID, clean up the old one first
    if (_subscriptions.has(id)) {
      const oldUnsubscribe = _subscriptions.get(id)!;
      try {
        oldUnsubscribe();
      } catch {
        // Ignore cleanup errors on old subscription
      }
    }
    _subscriptions.set(id, unsubscribe);
    logger.category('auth').debug(`[SubscriptionManager] Registered: ${id} (total: ${_subscriptions.size})`);
  },

  /**
   * Unregister and unsubscribe a single subscription by ID.
   * Called during component unmount.
   */
  unregister(id: string): void {
    const unsubscribe = _subscriptions.get(id);
    if (unsubscribe) {
      try {
        unsubscribe();
      } catch {
        // Ignore cleanup errors
      }
      _subscriptions.delete(id);
      logger.category('auth').debug(`[SubscriptionManager] Unregistered: ${id} (total: ${_subscriptions.size})`);
    }
  },

  /**
   * Unsubscribe and remove ALL auth subscriptions.
   * Called during sign-out to kill zombie guard listeners.
   */
  unsubscribeAll(): void {
    const count = _subscriptions.size;
    if (count === 0) return;

    logger.category('auth').info(`[SubscriptionManager] Unsubscribing all ${count} auth subscriptions`);

    for (const [id, unsubscribe] of _subscriptions) {
      try {
        unsubscribe();
      } catch {
        logger.category('auth').debug(`[SubscriptionManager] Failed to unsubscribe: ${id}`);
      }
    }
    _subscriptions.clear();
  },

  /** Number of currently active subscriptions */
  get activeCount(): number {
    return _subscriptions.size;
  },
};

/**
 * Check if a sign-out is currently in progress.
 * Auth guards should skip redirect logic when this returns true.
 */
export function isSigningOut(): boolean {
  return _isSigningOut;
}

/**
 * Mark sign-out as started. Called at the beginning of sign-out Phase 2.
 * Unsubscribes all auth listeners to prevent zombie guard interference.
 */
export function beginSignOut(): void {
  _isSigningOut = true;
  AuthSubscriptionManager.unsubscribeAll();
  logger.category('auth').info('[SubscriptionManager] Sign-out started, all subscriptions cleared');
}

/**
 * Mark sign-out as complete. Called after sign-out navigation finishes.
 * Allows new subscriptions (from the login screen) to function normally.
 */
export function endSignOut(): void {
  _isSigningOut = false;
  logger.category('auth').debug('[SubscriptionManager] Sign-out complete, ready for new subscriptions');
}
