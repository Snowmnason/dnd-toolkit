import { useEffect, useRef } from 'react';
import { getAppConfig } from '@/lib/config/loader';

export function useRenderTracker(componentName: string) {
  const renderCount = useRef(0);
  const config = getAppConfig();

  useEffect(() => {
    renderCount.current += 1;
    if (config.devTools.enablePerformanceLogger) {
      console.log(`${componentName} rendered ${renderCount.current} times`);
    }
  });

  return renderCount.current;
}