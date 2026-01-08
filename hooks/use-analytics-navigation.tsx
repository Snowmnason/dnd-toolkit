import { useEffect, useMemo } from 'react';
import { useSegments } from 'expo-router';
import { Analytics, Performance } from '@/lib/analytics';

/**
 * Tracks basic navigation analytics and coarse screen load time.
 * This runs at the root layout level and uses route segments as the screen name.
 * For finer-grained per-screen timings, use Performance.useScreenLoadTime in individual screens.
 */
export function useAnalyticsNavigation() {
  const segments = useSegments();

  const screenName = useMemo(() => {
    const s = (segments as string[]).filter(Boolean);
    return s.length ? s.join('/') : 'root';
  }, [segments]);

  useEffect(() => {
    Analytics.track('screen_view', { screen: screenName });
  }, [screenName]);

  // Measure time spent on the current route in a coarse way
  Performance.useScreenLoadTime(screenName);
}

export default useAnalyticsNavigation;
