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
  /**
   * If true, this subscription is skipped during the registration phase and
   * activated in runPostReadyTasks() after appReady. Use for subscriptions
   * whose module-load cost (import graph) would otherwise block bootstrap.
   */
  postReady?: boolean;
}

/**
 * All app-level subscriptions.
 * Activated during the registration phase, after all domain phases complete.
 */
export const SUBSCRIPTIONS: SubscriptionRegistryEntry[] = [
  {
    name: "analytics-network-integration",
    postReady: true,
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
    postReady: true,
    activate: async () => {
      const { reportRecovery } = await import("@/lib/error/degrade/degrade-manager");
      const { DegradeCapability } = await import("@/type-definitions/degrade");
      const { NetworkDetection } = await import("@/system/Network/network-detection");
      const { logger } = await import("@/lib/utils");

      // Track previous online state so we only fire on offline → online transitions,
      // not on every periodic ping while already connected.
      let wasOnline = NetworkDetection.getStatus().isOnline;

      NetworkDetection.subscribe((status) => {
        const isNowOnline = status.isOnline;
        if (!wasOnline && isNowOnline) {
          logger
            .category("bootstrap")
            .debug("Network recovered (offline→online), reporting to degradation manager");
          reportRecovery(DegradeCapability.CONNECTIVITY, "Network connection restored");
        }
        wasOnline = isNowOnline;
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
