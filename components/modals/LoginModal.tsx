import { AppModal, Button } from '@/components/ui'
import { registerModal } from '@/contexts'
import { useScale } from '@/theme'
import { View } from 'react-native'

export interface LoginModalButton {
  text: string
  onPress: () => void
  variant: 'primary' | 'cancel' | 'secondary'
}

export interface LoginModalProps {
  visible: boolean
  onClose: () => void
  heading: string
  message: string
  buttons: LoginModalButton[]
}

/**
 * 🔐 LoginModal
 * Generic modal for login/auth flow notifications.
 * Used for email confirmations, error states, and account actions.
 *
 * Examples:
 * - "Email Sent! 📧" with confirmation button
 * - "No Account Found 🤔" with create/cancel buttons
 * - "Account Exists!" with sign-in/cancel buttons
 */
export function LoginModal({
  visible,
  onClose,
  heading,
  message,
  buttons,
}: LoginModalProps) {
  const S = useScale()

  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      heading={heading}
      body={message}
    >
      <View
        style={{
          width: '100%',
          flexDirection: 'row',
          gap: S.space.md,
          marginTop: S.space.md,
          justifyContent: buttons.length === 1 ? 'flex-end' : 'space-between',
        }}
      >
        {buttons.map((button, index) => (
          <Button
            key={index}
            text={button.text}
            onPress={button.onPress}
            variant={button.variant}
            style={{ flex: buttons.length > 1 ? 1 : undefined }}
          />
        ))}
      </View>
    </AppModal>
  )
}

// Register modal for centralized management
registerModal('login-message', LoginModal)
