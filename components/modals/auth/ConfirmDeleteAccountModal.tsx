import AuthError from '@/components/auth_components/AuthError'
import AuthInput from '@/components/auth_components/AuthInput'
import { AppModal, Button } from '@/components/ui'
import { Body } from '@/components/ui/AppText'
import { registerModal } from '@/contexts'
import { useScale } from '@/theme'
import { deleteAccountPasswordSchema, getPasswordRequirementsForUI } from '@/validation/auth.schema'
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
 * Confirms permanent account deletion. Requires password validation via passwordSchema.
 * Shows real-time password requirements feedback using centralized validation.
 */
export function ConfirmDeleteAccountModal({
  onCancel,
  onConfirm,
  loading = false,
  errorText = '',
}: ConfirmDeleteAccountModalProps) {
  const S = useScale()
  const [password, setPassword] = useState('')
  
  // Validate password using centralized schema
  const passwordRequirementsText = getPasswordRequirementsForUI(password)
  const isPasswordValid = password.length > 0 && deleteAccountPasswordSchema.safeParse({ password }).success

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

        {/* Password requirements feedback */}
        <Body fontSize={S.font.caption} opacity={0.7} style={{ marginTop: S.space.xs }}>
          {passwordRequirementsText}
        </Body>

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
            disabled={loading || !isPasswordValid}
          />
        </View>
      </View>
    </AppModal>
  )
}

// Register modal for centralized management
registerModal('confirm-delete', ConfirmDeleteAccountModal)
