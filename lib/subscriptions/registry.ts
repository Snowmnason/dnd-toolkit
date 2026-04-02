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
  // TRACK 7: Post-Registration recovery signal subscriptions
  {
    name: "network-recovery-subscription",
    activate: async () => {
      const { reportRecovery } = await import("@/lib/error");
      const { DegradeCapability } = await import("@/type-definitions/degrade");
      const { NetworkDetection } = await import("@/system/Network");
      const { logger } = await import("@/lib/utils");

      // Subscribe to network reconnection events
      // When network comes back online after being offline
      NetworkDetection.subscribe((status) => {
        if (status.isOnline) {
          logger
            .category("bootstrap")
            .debug("Network recovered, reporting to degradation manager");
          reportRecovery(DegradeCapability.CONNECTIVITY, "Network connection restored");
        }
      });
    },
  },
  // TODO: Add sync recovery subscription
  // - Subscribe to sync-manager success/drain events
  // - Call reportRecovery('sync', 'queue drained' | 'synced')
  // - Track 7 Post-Registration requirement
  {
    name: "sync-recovery-subscription",
    activate: async () => {
      // PLACEHOLDER: Waiting for sync-manager recovery events API
      // When available, wire sync success/drain to reportRecovery('sync')
    },
  },
  // TODO: Add job recovery subscription
  // - Subscribe to job queue success events (retry success)
  // - Call reportRecovery('backgroundJobs', 'retry succeeded')
  // - Track 7 Post-Registration requirement
  {
    name: "job-recovery-subscription",
    activate: async () => {
      // PLACEHOLDER: Waiting for job queue recovery signals API
      // When available, wire job success to reportRecovery('backgroundJobs')
    },
  },
  // TODO: Add service health check subscription
  // - Subscribe to service health checks (database, auth, storage)
  // - Call reportRecovery(capability, 'service ready')
  // - Track 7 Post-Registration requirement
  {
    name: "service-health-subscription",
    activate: async () => {
      // PLACEHOLDER: Waiting for service health check monitoring
      // When available, wire service recovery to reportRecovery()
    },
  },
];
