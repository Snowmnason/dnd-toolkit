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
  /** When true, shows secondary button alongside failure/warning type defaults */
  canGoBack?: boolean
  /** Custom label override for the primary button */
  primaryButtonLabel?: string
  /** Custom label override for the secondary button. Also causes the secondary button to appear */
  secondaryButtonLabel?: string
  /** Callback for secondary action. Presence also causes the secondary button to appear */
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
  primaryButtonLabel: customPrimaryLabel,
  secondaryButtonLabel: customSecondaryLabel,
  secondaryAction,
  primaryAction,
}: NavModalProps) {
  // Derive defaults from modalResponseType
  let defaultHeading: string;
  let defaultPrimaryLabel: string;
  let defaultSecondaryLabel: string | null;
  let borderTone: BorderTone;
  let primaryButtonVariant: 'primary' | 'destructive' | 'secondary' = 'primary';
  let showSecondaryByType: boolean = false;

  switch (modalResponseType) {
    case 'failure':
      defaultHeading = 'Navigation Failed!';
      defaultPrimaryLabel = 'Go Home';
      defaultSecondaryLabel = 'Go Back';
      borderTone = 'danger';
      primaryButtonVariant = 'destructive';
      showSecondaryByType = canGoBack;
      break;
    case 'success':
      defaultHeading = 'Action Successful!';
      defaultPrimaryLabel = 'Continue';
      defaultSecondaryLabel = null;
      borderTone = 'success';
      primaryButtonVariant = 'primary';
      showSecondaryByType = false;
      break;
    case 'warning':
      defaultHeading = 'Warning!';
      defaultPrimaryLabel = 'Understood';
      defaultSecondaryLabel = 'Go Back';
      borderTone = 'warning';
      primaryButtonVariant = 'secondary';
      showSecondaryByType = canGoBack;
      break;
    case 'general':
    default:
      defaultHeading = 'Notice';
      defaultPrimaryLabel = 'OK';
      defaultSecondaryLabel = null;
      borderTone = 'accent';
      primaryButtonVariant = 'primary';
      showSecondaryByType = false;
      break;
  }

  const S = useScale();
  const finalHeading = customHeading ?? defaultHeading;
  const finalPrimaryLabel = customPrimaryLabel ?? defaultPrimaryLabel;
  // Show secondary when: type-driven (canGoBack), secondaryAction provided, or custom label given
  const showSecondaryButton = showSecondaryByType || !!secondaryAction || !!customSecondaryLabel;
  const finalSecondaryLabel = customSecondaryLabel ?? defaultSecondaryLabel;

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
        {showSecondaryButton && finalSecondaryLabel && (
          <Button
            text={finalSecondaryLabel}
            onPress={secondaryAction ?? onClose}
            variant="ghost"
          />
        )}
        <Button
          text={finalPrimaryLabel}
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
