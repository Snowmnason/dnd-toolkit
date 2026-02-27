import { getAppConfig } from '@/config';
import { useCrashConsentReport } from '@/hooks/analytics/use-crash-consent-report';
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
 * 
 * When consent is 'none', shows an additional button to opt-in and send the crash report
 */
export function CrashFallBack({ error, onRetry }: CrashFallBackProps) {
  const config = getAppConfig();
  const isDev = (process.env.EXPO_PUBLIC_ENVIRONMENT || 'production') === 'development';
  const { canOptIn, sendCrashReport } = useCrashConsentReport();
  
  // Use verboseErrorMessages config if available, otherwise fall back to isDev check
  const showDetailedErrors = config.overrides?.verboseErrorMessages ?? isDev;

  const handleRestart = () => {
    // Force reload the app
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  const handleSendReportAndRestart = async () => {
    if (error) {
      // Await the report send to ensure it's flushed before restarting
      await sendCrashReport(error);
    }
    // Now safe to restart — report has been sent and flushed
    handleRestart();
  };

  return (
    <View style={{ flex: 1 }}>
      <ErrorFallbackShell
        error={error || undefined}
        showDetails={showDetailedErrors && !!error}
        recoveryMessage={
          canOptIn
            ? "We encountered a critical error. Help us fix it by sending a crash report (error, stack trace, breadcrumbs, and device info), or restart without sending."
            : "Don't worry - your adventure is safe! Try rolling for initiative (restarting) or contact your DM (support) if this keeps happening."
        }
        primaryButtonText={canOptIn ? 'Send Report & Restart' : onRetry ? 'Try Again' : 'Restart App'}
        onPrimaryAction={canOptIn ? handleSendReportAndRestart : onRetry || handleRestart}
        secondaryButtonText={canOptIn ? 'Restart Without Sending' : onRetry ? 'Restart App' : undefined}
        onSecondaryAction={canOptIn ? handleRestart : onRetry ? handleRestart : undefined}
        footer={<VersionDisplay />}
      />
    </View>
  );
}
