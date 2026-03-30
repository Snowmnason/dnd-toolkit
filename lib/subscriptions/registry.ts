/**
 * Subscription Registry
 *
 * Explicit registry of all app-level subscriptions that should be activated
 * after all kernel phases complete (but before appReady).
 *
 * Subscriptions are long-lived listeners/integrations that:
 * - React to runtime state changes (network, auth, etc.)
 * - Flush buffers on events (analytics on reconnect)
 * - Monitor system health
 *
 * Used by registration-phase.ts to activate all subscriptions in one place.
 *
 * To add a new subscription:
 * 1. Create the subscription module
 * 2. Add an entry here with name + activate function
 * 3. Done — registration phase auto-discovers it
 */

/**
 * A registrable subscription entry.
 * - name: human-readable identifier for logging
 * - activate: async function that sets up the subscription
 */
export interface SubscriptionRegistryEntry {
  name: string;
  activate: () => Promise<void>;
}

/**
 * All app-level subscriptions.
 * Activated during the registration phase, after all domain phases complete.
 */
export const SUBSCRIPTIONS: SubscriptionRegistryEntry[] = [
  {
    name: "analytics-network-integration",
    activate: async () => {
      const { initializeAnalyticsNetworkIntegration } = await import(
        "@/lib/analytics/exporters/analytics-network-integration"
      );
      initializeAnalyticsNetworkIntegration();
    },
  },
];
