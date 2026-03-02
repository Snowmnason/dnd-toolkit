import { useAppKernel } from "@/hooks/kernel";
import { FeatureFlags } from "@/lib/feature-flags";
import { logger } from "@/lib/utils/logger";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

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
  const SPLASH_BUFFER_MS = Platform.OS === "web" ? 100 : 1000;

  useEffect(() => {
    // Check if splash screen feature is enabled
    const splashEnabled = FeatureFlags.isEnabled("splashScreen");

    if (!splashEnabled) {
      logger.category('ui').debug("🎬 Splash screen disabled via feature flag");
      setShowSplash(false);
      setBufferComplete(true);
      return;
    }

    // Wait for kernel to become ready
    if (!kernel.phases.appReady) {
      return;
    }

    // Add platform-specific buffer after kernel completes
    const timer = setTimeout(() => {
      setBufferComplete(true);
      setShowSplash(false);
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
