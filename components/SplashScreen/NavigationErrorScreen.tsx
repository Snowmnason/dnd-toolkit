import { getAppConfig } from '@/config';
import { useNavigation } from '@/hooks/navigation';
import { ErrorFallbackShell } from '../ui';

export interface NavigationErrorScreenProps {
  error?: Error;
  fallbackRoute?: string;
}

/**
 * Navigation Error Screen
 *
 * Displayed when a route-level error boundary catches an error.
 * Provides a "go back to safe route" recovery path.
 *
 * Uses ErrorFallbackShell (the base error UI component).
 */
export function NavigationErrorScreen({
  error,
  fallbackRoute = '/select/world-selection',
}: NavigationErrorScreenProps) {
  const navigate = useNavigation();
  const config = getAppConfig();
  const showDetailedErrors =
    config.overrides?.verboseErrorMessages ??
    process.env.NODE_ENV === 'development';

  const handleRecover = () => {
    navigate.replace(fallbackRoute);
  };

  return (
    <ErrorFallbackShell
      errorTitle="Navigation Error"
      explanation="Don't worry — your adventure is safe! Try returning to continue your quest."
      error={error}
      showDetails={showDetailedErrors && !!error}
      messagePack="navigation"
      primaryButtonText="Return to Safe Path"
      onPrimaryAction={handleRecover}
    />
  );
}
