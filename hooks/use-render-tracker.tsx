import { getAppConfig } from '@/lib/config/loader';
import { useMemo, useRef } from 'react';

export function useRenderTracker(componentName: string) {
  const renderCount = useRef(0);
  const config = useMemo(() => getAppConfig(), []);

  // Increment render count on every render
  renderCount.current += 1;

  // Log render count if performance logger is enabled (development tool)
  if (config.devTools.enablePerformanceLogger) {
    console.log(`${componentName} rendered ${renderCount.current} times`);
  }

  return renderCount.current;
}