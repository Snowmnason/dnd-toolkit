import { getAppConfig } from '@/lib/config/loader';
import { useEffect, useMemo, useRef } from 'react';

export function useRenderTracker(componentName: string) {
  const renderCount = useRef(0);
  const config = useMemo(() => getAppConfig(), []);

  useEffect(() => {
    renderCount.current += 1;
    if (config.devTools.enablePerformanceLogger) {
      console.log(`${componentName} rendered ${renderCount.current} times`);
    }
  }, [config.devTools.enablePerformanceLogger, componentName]);

  return renderCount.current;
}