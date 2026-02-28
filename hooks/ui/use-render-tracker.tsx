import { getAppConfig } from '@/config';
import { logger } from '@/lib/utils';
import { useMemo, useRef } from 'react';

export function useRenderTracker(componentName: string) {
  const renderCount = useRef(0);
  const config = useMemo(() => getAppConfig(), []);

  // Increment render count on every render
  renderCount.current += 1;

  // Log render count if performance logger is enabled (development tool)
  if (config.devTools.enablePerformanceLogger) {
    logger.category('performance').debug(`${componentName} rendered ${renderCount.current} times`);
  }

  return renderCount.current;
}