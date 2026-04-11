import { AppModal, Button } from '@/components/ui';
import { registerModal } from '@/contexts';
import { useScale } from '@/theme';
import { View } from 'react-native';

type BorderTone = 'accent' | 'success' | 'warning' | 'danger';
type ModalResponseType = 'failure' | 'success' | 'warning' | 'general';

export interface NavModalProps {
  visible: boolean
  onClose: () => void
  modalResponseType?: ModalResponseType
  /** Custom heading override. If not provided, uses type-specific default */
  heading?: string
  /** Custom message body */
  body?: string
  /** When true, shows secondary button (failure/warning types only) */
  canGoBack?: boolean
  /** Callback for secondary action. For failure/warning: go back. For others: ignored */
  secondaryAction?: () => void
  /** Callback for primary action. For failure: go home. For others: confirm/acknowledge */
  primaryAction: () => void
}

/**
 * 🧭 NavModal
 * Generic modal for navigation outcomes with type-driven UI.
 *
 * Types auto-derive defaults:
 * - **failure**: "Navigation Failed!" | "Go Back" (conditional) + "Go Home" (destructive)
 *   - Use when navigation guard blocks access or system error occurs
 *   - primaryAction navigates to home (/select/world-selection or / for auth failures)
 *   - secondaryAction goes back in stack (if canGoBack=true)
 *
 * - **success**: "Action Successful!" | "Continue" (primary)
 *   - Use for successful operations (world created, profile updated, etc.)
 *   - primaryAction confirms and closes modal
 *   - No secondary button
 *
 * - **warning**: "Warning!" | "Go Back" (conditional) + "Understood" (secondary)
 *   - Use for under-construction pages or cautionary alerts
 *   - primaryAction confirms (typically closes modal)
 *   - secondaryAction goes back (if canGoBack=true)
 *
 * - **general**: "Notice" | "OK" (primary)
 *   - Use for informational alerts or feature introductions
 *   - primaryAction confirms and closes modal
 *   - No secondary button
 *
 * Auth guard redirects should NOT use this modal — they redirect automatically.
 */
export function NavModal({
  visible,
  onClose,
  modalResponseType = 'general',
  heading: customHeading,
  body = '',
  canGoBack = false,
  secondaryAction,
  primaryAction,
}: NavModalProps) {
  // Derive defaults from modalResponseType
  let defaultHeading: string;
  let primaryButtonLabel: string;
  let secondaryButtonLabel: string | null;
  let borderTone: BorderTone;
  let primaryButtonVariant: 'primary' | 'destructive' | 'secondary' = 'primary';
  let showSecondaryButton: boolean = false;

  switch (modalResponseType) {
    case 'failure':
      defaultHeading = 'Navigation Failed!';
      primaryButtonLabel = 'Go Home';
      secondaryButtonLabel = 'Go Back';
      borderTone = 'danger';
      primaryButtonVariant = 'destructive';
      showSecondaryButton = canGoBack;
      break;
    case 'success':
      defaultHeading = 'Action Successful!';
      primaryButtonLabel = 'Continue';
      secondaryButtonLabel = null;
      borderTone = 'success';
      primaryButtonVariant = 'primary';
      showSecondaryButton = false;
      break;
    case 'warning':
      defaultHeading = 'Warning!';
      primaryButtonLabel = 'Understood';
      secondaryButtonLabel = 'Go Back';
      borderTone = 'warning';
      primaryButtonVariant = 'secondary';
      showSecondaryButton = canGoBack;
      break;
    case 'general':
    default:
      defaultHeading = 'Notice';
      primaryButtonLabel = 'OK';
      secondaryButtonLabel = null;
      borderTone = 'accent';
      primaryButtonVariant = 'primary';
      showSecondaryButton = false;
      break;
  }

  const S = useScale();
  const finalHeading = customHeading ?? defaultHeading;

  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      heading={finalHeading}
      body={body}
      borderTone={borderTone}
    >
      <View
        style={{
          width: '100%',
          flexDirection: 'row',
          justifyContent: showSecondaryButton ? 'space-between' : 'flex-end',
          marginTop: S.space.md,
        }}
      >
        {showSecondaryButton && secondaryButtonLabel && (
          <Button
            text={secondaryButtonLabel}
            onPress={secondaryAction ?? onClose}
            variant="ghost"
          />
        )}
        <Button
          text={primaryButtonLabel}
          onPress={primaryAction ?? onClose}
          variant={primaryButtonVariant}
          style={{ minWidth: S.s(120) }}
        />
      </View>
    </AppModal>
  );
}

// Register modal for centralized management
registerModal('nav-alert', NavModal);
