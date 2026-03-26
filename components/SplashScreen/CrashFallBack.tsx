import { getAppConfig } from '@/config';
import { useCrashConsentReport } from '@/hooks/analytics/use-crash-consent-report';
import { ErrorFallbackShell } from '../ui';

export interface CrashFallBackProps {
  error: Error | null;
  onRetry?: () => void;
}

/**
 * Crash Fallback Screen
 *
 * Displayed when the app encounters an unrecoverable error caught by ErrorBoundary.
 * Provides user-friendly error messaging and recovery options.
 *
 * Uses ErrorFallbackShell (the base error UI component).
 * Button layout:
 *   1. Primary: "Try Again" or "Restart App" (go back / easiest fix)
 *   2. Secondary: "Send Report & Restart" (when consent allows opt-in)
 *   3. Tertiary: "Restart Without Sending" (action without data)
 */
export function CrashFallBack({ error, onRetry }: CrashFallBackProps) {
  const config = getAppConfig();
  const isDev = (process.env.EXPO_PUBLIC_ENVIRONMENT || 'production') === 'development';
  const { canOptIn, sendCrashReport } = useCrashConsentReport();

  const showDetailedErrors = config.overrides?.verboseErrorMessages ?? isDev;

  const handleRestart = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  const handleSendReportAndRestart = async () => {
    if (error) {
      await sendCrashReport(error);
    }
    handleRestart();
  };

  // Button 1: easiest recovery
  const primaryButtonText = onRetry ? 'Try Again' : 'Restart App';
  const onPrimaryAction = onRetry || handleRestart;

  // Buttons 2+3: only when consent opt-in is available
  const secondaryButtonText = canOptIn ? 'Send Report & Restart' : undefined;
  const onSecondaryAction = canOptIn ? handleSendReportAndRestart : undefined;
  const tertiaryButtonText = canOptIn ? 'Restart Without Sending' : undefined;
  const onTertiaryAction = canOptIn ? handleRestart : undefined;

  const explanation = canOptIn
    ? "We encountered a critical error. Help us fix it by sending a crash report, or restart without sending."
    : "Don't worry — your adventure is safe! Try rolling for initiative (restarting) or contact your DM (support) if this keeps happening.";

  return (
    <ErrorFallbackShell
      errorTitle="Critical Error"
      explanation={explanation}
      error={error || undefined}
      showDetails={showDetailedErrors && !!error}
      primaryButtonText={primaryButtonText}
      onPrimaryAction={onPrimaryAction}
      secondaryButtonText={secondaryButtonText}
      onSecondaryAction={onSecondaryAction}
      tertiaryButtonText={tertiaryButtonText}
      onTertiaryAction={onTertiaryAction}
    />
  );
}
