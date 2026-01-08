import { useEffect, useMemo, useRef } from 'react';
import { useSegments } from 'expo-router';
import { Analytics, Performance } from '@/lib/analytics';

/**
 * Tracks basic navigation analytics and coarse screen duration.
 * This runs at the root layout level and uses route segments as the screen name.
 * For finer-grained per-screen timings, use Performance.useScreenDuration in individual screens.
 */
export function useAnalyticsNavigation() {
  const segments = useSegments();

  const screenName = useMemo(() => {
    const s = (segments as string[]).filter(Boolean);
    return s.length ? s.join('/') : 'root';
  }, [segments]);

  const lastTrackedRef = useRef<string | null>(null);

  useEffect(() => {
    // Debounce rapid transitions: only track if different from last tracked
    if (screenName && lastTrackedRef.current !== screenName) {
      Analytics.track('screen_view', { screen: screenName });
      lastTrackedRef.current = screenName;
    }
  }, [screenName]);

  // Measure time spent on the current route (mount → unmount); coarse duration, not load time
  Performance.useScreenDuration(screenName);
}

export default useAnalyticsNavigation;
