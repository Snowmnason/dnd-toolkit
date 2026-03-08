import { NetworkManager, type NetworkStatus } from '@/lib/network/network-manager';
import React from 'react';

/**
 * Hook for detecting network status changes in React components
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const status = useNetworkStatus();
 *   
 *   if (!status) {
 *     return <div>Network detection not ready</div>;
 *   }
 *
 *   if (status?.isOnline === false) {
 *     return <div>Offline - showing cached data</div>;
 *   }
 *
 *   return <div>Online</div>;
 * }
 * ```
 */
export function useNetworkStatus(): NetworkStatus | undefined {
  const [status, setStatus] = React.useState<NetworkStatus | undefined>(
    NetworkManager.getStatus(),
  );

  React.useEffect(() => {
    // Subscribe to changes
    const unsubscribe = NetworkManager.subscribe(setStatus);
    return unsubscribe;
  }, []);

  return status;
}
