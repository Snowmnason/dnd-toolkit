/**
 * Network Detection Utilities
 * 
 * Provides cross-platform network status detection for web, iOS, and Android.
 * Currently used for graceful degradation (return stale cache on network errors).
 * Will be extended for future offline mode (Milestone 3+).
 */

import * as React from 'react';
import { Platform } from 'react-native';

/**
 * Network status information
 */
export interface NetworkStatus {
  isOnline: boolean;
  type: 'wifi' | 'cellular' | 'none' | 'unknown';
  isExpensive: boolean; // e.g., cellular is expensive
  isInternetReachable?: boolean; // More accurate than isOnline
}

/**
 * Callback when network status changes
 */
export type NetworkStatusCallback = (status: NetworkStatus) => void;

/**
 * Network detection service (cross-platform)
 * 
 * Handles:
 * - Web: navigator.onLine, visibilitychange events
 * - Native: expo-network package integration
 * - Graceful degradation on both platforms
 */
class NetworkDetectionClass {
  private currentStatus: NetworkStatus = {
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    type: 'unknown',
    isExpensive: false,
  };

  private listeners: Set<NetworkStatusCallback> = new Set();
  private isInitialized = false;

  /**
   * Initialize network detection
   * Call this once at app startup
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Web: Use navigator.onLine
    if (typeof window !== 'undefined') {
      this.setupWebNetworkDetection();
    }

    // Native: Use network detection if available (expo-network package)
    // This is optional - web works fine without it
    // Skip native detection on web platform
    if (typeof window === 'undefined' && Platform?.OS !== 'web') {
      try {
        // Try to load NetInfo from expo-network package
        // This is a dynamic import to avoid hard dependency
        const NetInfo = await this.loadNetInfo();
        if (NetInfo) {
          this.setupNativeNetworkDetection(NetInfo);
        }
      } catch (error) {
        // expo-network not available or import failed
        // This is OK - web detection via navigator.onLine is sufficient
      }
    }

    this.isInitialized = true;
  }

  /**
   * Safely load NetInfo from expo-network package
   * Returns null if package not available
   */
  private async loadNetInfo(): Promise<any> {
    try {
      // Try to import from @react-native-community/net-info (older)
      // or expo-network (newer)
      let module: any;
      
      try {
        
        //TODO install these packages if using native network detection
        //module = await import('@react-native-community/net-info');
      } catch {
        // Try expo-network instead
        try {
          
          //TODO install these packages if using native network detection
          //module = await import('expo-network');
        } catch {
          // Neither package available - return null
          return null;
        }
      }
      
      // Return the NetInfo export
      return module?.NetInfo || module?.default?.NetInfo || null;
    } catch {
      return null;
    }
  }

  /**
   * Setup web-based network detection
   */
  private setupWebNetworkDetection(): void {
    if (typeof window === 'undefined') return;

    // Initial status
    this.currentStatus = {
      isOnline: navigator.onLine,
      type: navigator.onLine ? 'wifi' : 'none',
      isExpensive: false,
    };

    // Listen to online/offline events
    window.addEventListener('online', () => {
      this.updateStatus({ isOnline: true });
    });

    window.addEventListener('offline', () => {
      this.updateStatus({ isOnline: false, type: 'none' });
    });

    // Also listen to visibility changes (helps detect network loss while backgrounded)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        // App came to foreground - recheck network status
        this.updateStatus({
          isOnline: navigator.onLine,
          type: navigator.onLine ? 'wifi' : 'none',
        });
      }
    });
  }

  /**
   * Setup native network detection via expo-network
   */
  private setupNativeNetworkDetection(NetInfo: any): void {
    // Subscribe to network state updates
    if (NetInfo.addEventListener) {
      NetInfo.addEventListener((state: any) => {
        this.updateStatus({
          isOnline: state.isInternetReachable !== false,
          type: state.type || 'unknown',
          isExpensive: state.details?.isConnectionExpensive || false,
          isInternetReachable: state.isInternetReachable,
        });
      });
    }
  }

  /**
   * Update status and notify listeners
   */
  private updateStatus(partial: Partial<NetworkStatus>): void {
    this.currentStatus = { ...this.currentStatus, ...partial };
    this.notifyListeners();
  }

  /**
   * Notify all listeners of status change
   */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.currentStatus);
      } catch (error) {
        console.error('Network status listener error:', error);
      }
    }
  }

  /**
   * Get current network status
   */
  getStatus(): NetworkStatus {
    return { ...this.currentStatus };
  }

  /**
   * Check if currently online
   */
  isOnline(): boolean {
    return this.currentStatus.isOnline;
  }

  /**
   * Subscribe to network status changes
   * Returns unsubscribe function
   */
  subscribe(callback: NetworkStatusCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }
}

/**
 * Singleton instance
 */
export const NetworkDetection = new NetworkDetectionClass();

/**
 * Hook for detecting network status changes in React components
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isOnline, type } = useNetworkStatus();
 *   
 *   if (!isOnline) {
 *     return <div>Offline - showing cached data</div>;
 *   }
 *   
 *   return <div>Online</div>;
 * }
 * ```
 */
export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = React.useState<NetworkStatus>(
    NetworkDetection.getStatus()
  );

  React.useEffect(() => {
    // Subscribe to changes
    const unsubscribe = NetworkDetection.subscribe(setStatus);
    return unsubscribe;
  }, []);

  return status;
}
