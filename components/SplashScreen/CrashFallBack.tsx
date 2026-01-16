import { getAppConfig } from '@/lib/config/loader';
import { View } from 'react-native';
import VersionDisplay from '../VersionDisplay';
import { ErrorFallbackShell } from './ErrorFallbackShell';

export interface CrashFallBackProps {
  error: Error | null;
  onRetry?: () => void;
}

/**
 * Crash Fallback Screen
 *
 * Displayed when the app encounters an unrecoverable error caught by ErrorBoundary
 * Provides user-friendly error messaging and recovery options
 */
export function CrashFallBack({ error, onRetry }: CrashFallBackProps) {
  const config = getAppConfig();
  const isDev = (process.env.EXPO_PUBLIC_ENVIRONMENT || 'production') === 'development';
  
  // Use verboseErrorMessages config if available, otherwise fall back to isDev check
  const showDetailedErrors = config.overrides?.verboseErrorMessages ?? isDev;

  const handleRestart = () => {
    // Force reload the app
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ErrorFallbackShell
        error={error || undefined}
        showDetails={showDetailedErrors && !!error}
        recoveryMessage="Don't worry - your adventure is safe! Try rolling for initiative (restarting) or contact your DM (support) if this keeps happening."
        primaryButtonText={onRetry ? 'Try Again' : 'Restart App'}
        onPrimaryAction={onRetry || handleRestart}
        secondaryButtonText={onRetry ? 'Restart App' : undefined}
        onSecondaryAction={onRetry ? handleRestart : undefined}
        footer={<VersionDisplay />}
      />
    </View>
  );
}
