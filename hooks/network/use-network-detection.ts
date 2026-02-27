import { NetworkDetection, NetworkStatus } from '@/lib/network/network-detection';
import React from 'react';

/**
 * Hook for detecting network status changes in React components
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isOnline, connectionQuality } = useNetworkStatus();
 *
 *   if (connectionQuality === ConnectionQuality.OFFLINE) {
 *     return <div>Offline - showing cached data</div>;
 *   }
 *
 *   if (connectionQuality === ConnectionQuality.BAD) {
 *     return <div>Poor connection - reduced features</div>;
 *   }
 *
 *   return <div>Online</div>;
 * }
 * ```
 */
export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = React.useState<NetworkStatus>(
    NetworkDetection.getStatus(),
  );

  React.useEffect(() => {
    // Subscribe to changes
    const unsubscribe = NetworkDetection.subscribe(setStatus);
    return unsubscribe;
  }, []);

  return status;
}
