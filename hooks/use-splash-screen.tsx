import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { FeatureFlags } from '../lib/feature-flags';
import { useAppKernel } from '../lib/kernel';
import { logger } from '../lib/utils/logger';

/**
 * Manages splash screen visibility
 * - Waits for kernel to become ready
 * - Adds platform-specific buffer after kernel ready (shorter on web, longer on mobile)
 * - Respects feature flag toggle
 */
export function useSplashScreen() {
  const kernel = useAppKernel();
  const [showSplash, setShowSplash] = useState(true);
  const [bufferComplete, setBufferComplete] = useState(false);

  // Platform-specific buffer timing
  // Web: minimal buffer (100ms) for snappy feel
  // Mobile: longer buffer (1000ms) for smoother animation
  const SPLASH_BUFFER_MS = Platform.OS === 'web' ? 100 : 1000;

  useEffect(() => {
    // Check if splash screen feature is enabled
    const splashEnabled = FeatureFlags.isEnabled('splashScreen');
    
    if (!splashEnabled) {
      logger.debug('ui', '🎬 Splash screen disabled via feature flag');
      setShowSplash(false);
      setBufferComplete(true);
      return;
    }

    // Wait for kernel to become ready
    if (!kernel.phases.appReady) {
      logger.debug('ui', '⏳ Waiting for app kernel to complete...');
      return;
    }

    logger.debug('ui', `✅ Kernel ready, starting ${SPLASH_BUFFER_MS}ms buffer on ${Platform.OS}`);

    // Add platform-specific buffer after kernel completes
    const timer = setTimeout(() => {
      setBufferComplete(true);
      setShowSplash(false);
      logger.debug('ui', '🎬 Splash screen hidden, app ready');
    }, SPLASH_BUFFER_MS);

    return () => clearTimeout(timer);
  }, [SPLASH_BUFFER_MS, kernel.phases.appReady]);

  return {
    showSplash,
    bufferComplete,
    kernelReady: kernel.phases.appReady,
    kernelError: kernel.error,
  };
}
