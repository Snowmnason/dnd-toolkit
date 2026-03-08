/**
 * useAnalytics
 *
 * Exposes Analytics and sessionManager to screens/layouts without them
 * importing directly from @/lib/analytics.
 */

import { Analytics, sessionManager } from "@/lib/analytics";

export function useAnalytics() {
  return { Analytics, sessionManager };
}

// Re-export for direct usage in effects where calling the hook isn't needed
export { Analytics, sessionManager };

