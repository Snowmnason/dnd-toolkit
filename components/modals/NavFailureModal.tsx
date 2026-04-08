import { AppModal, Button } from '@/components/ui'; // ✅ unified import
import { registerModal } from '@/contexts';
import { useScale } from '@/theme';
import { View } from 'react-native';

interface NavFailureModalProps {
  visible: boolean
  onClose: () => void
  heading?: string
  body?: string
  confirmLabel?: string
  onConfirm?: () => void
}

/**
 * ⚠️ NavFailureModal
 * A minimal modal for navigation failure or error actions.
 * Example: "Navigation Failed!", "Action Could Not Be Completed!"
 */
export function NavFailureModal({
  visible,
  onClose,
  heading = 'Navigation Failed!',
  body = "This action isn't available right now.",
  confirmLabel = 'Dismiss',
  onConfirm,
}: NavFailureModalProps) {
  const S = useScale()
  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      heading={heading}
      body={body}
      borderTone="danger"
      animateOnDestruction // 👈 adds shake animation + haptics
    >
      <View
        style={{
          width: '100%',
          flexDirection: 'row',
          justifyContent: 'flex-end', // ✅ aligns to right
          marginTop: S.space.md,
        }}
      >
        <Button
          text={confirmLabel}
          onPress={onConfirm ?? onClose}
          variant="primary" // ✅ unified button variant
          style={{ minWidth: S.s(120) }}
        />
      </View>
    </AppModal>
  )
}

// Register modal for centralized management
registerModal('nav-failure', NavFailureModal)
