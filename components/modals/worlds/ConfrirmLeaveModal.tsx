import { AppModal, Button } from '@/components/ui'
import { registerModal } from '@/contexts'
import { useScale } from '@/theme'
import { View } from 'react-native'

interface ConfirmLeaveModalProps {
  visible: boolean
  onClose: () => void
  worldName?: string
  onConfirmLeave: () => void
}

/**
 * ⚠️ ConfirmLeaveModal
 * Simple confirmation modal for leaving a world.
 */
export function ConfirmLeaveModal({
  visible,
  onClose,
  worldName,
  onConfirmLeave,
}: ConfirmLeaveModalProps) {
  const S = useScale()
  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      heading="Leave World?"
      body={
        worldName
          ? `Are you sure you want to leave "${worldName}"? You’ll lose access to its data.`
          : 'Are you sure you want to leave this world?'
      }
      borderTone="danger"
      animateOnDestruction // 👈 adds shake animation + haptics
    >
      <View
        style={{
          width: '100%',
          flexDirection: 'row',
          justifyContent: 'flex-end',
          gap: S.space.sm,
          marginTop: S.space.md,
        }}
      >
        <Button text="Cancel" variant="secondary" onPress={onClose} />
        <Button
          text="Leave"
          variant="destructive"
          onPress={onConfirmLeave}
        />
      </View>
    </AppModal>
  )
}

// Register modal for centralized management
registerModal('confirm-leave', ConfirmLeaveModal)
