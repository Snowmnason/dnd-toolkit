import { useEffect, useState } from 'react';
import { FeatureFlags } from '../lib/feature-flags';
import { useAppBootstrap } from './use-app-bootstrap';

/**
 * Manages splash screen visibility
 * - Waits for bootstrap to complete
 * - Adds 1 second buffer after bootstrap for smooth transition
 * - Respects feature flag toggle
 */
export function useSplashScreen() {
  const bootstrap = useAppBootstrap();
  const [showSplash, setShowSplash] = useState(true);
  const [bufferComplete, setBufferComplete] = useState(false);

  useEffect(() => {
    // Check if splash screen feature is enabled
    const splashEnabled = FeatureFlags.isEnabled('splashScreen');
    
    if (!splashEnabled) {
      setShowSplash(false);
      setBufferComplete(true);
      return;
    }

    // Wait for bootstrap to complete
    if (!bootstrap.isReady) {
      return;
    }

    // Add 1 second buffer after bootstrap completes
    const timer = setTimeout(() => {
      setBufferComplete(true);
      setShowSplash(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, [bootstrap.isReady]);

  return {
    showSplash,
    bufferComplete,
    bootstrapReady: bootstrap.isReady,
    bootstrapError: bootstrap.error,
  };
}
