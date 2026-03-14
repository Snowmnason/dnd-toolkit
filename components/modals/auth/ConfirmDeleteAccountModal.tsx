import AuthError from '@/components/auth_components/AuthError'
import AuthInput from '@/components/auth_components/AuthInput'
import { AppModal, Button } from '@/components/ui'
import { registerModal } from '@/contexts'
import { useScale } from '@/theme'
import { useState } from 'react'
import { View } from 'react-native'

interface ConfirmDeleteAccountModalProps {
  onCancel: () => void
  onConfirm: (password: string) => Promise<void>
  loading?: boolean
  errorText?: string
}

/**
 * 💀 ConfirmDeleteAccountModal
 * Confirms permanent account deletion. Requires password entry.
 */
export function ConfirmDeleteAccountModal({
  onCancel,
  onConfirm,
  loading = false,
  errorText = '',
}: ConfirmDeleteAccountModalProps) {
  const S = useScale()
  const [password, setPassword] = useState('')

  const isPasswordStrong = (pwd: string): boolean =>
    pwd.length >= 8 && /[a-zA-Z]/.test(pwd) && /[0-9]/.test(pwd)

  return (
    <AppModal
      visible={true}
      onClose={onCancel}
      heading="Delete Account?"
      body="This action is permanent. Please enter your password to confirm."
      borderTone="danger"
    >
      <View style={{ width: '100%', marginTop: S.space.sm, gap: S.space.sm }}>
        <AuthInput
          placeholder="Enter your password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!loading}
        />

        {!!errorText && <AuthError error={errorText} />}

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'flex-end',
            gap: S.space.sm,
            marginTop: S.space.md,
          }}
        >
          <Button
            text="Cancel"
            variant="secondary"
            onPress={onCancel}
            disabled={loading}
          />
          <Button
            text={loading ? 'Processing...' : 'Delete Account'}
            variant="destructive"
            onPress={() => onConfirm(password.trim())}
            disabled={loading || !isPasswordStrong(password)}
          />
        </View>
      </View>
    </AppModal>
  )
}

// Register modal for centralized management
registerModal('confirm-delete', ConfirmDeleteAccountModal)
