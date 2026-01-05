import AuthError from '@/components/auth_components/AuthError'
import AuthInput from '@/components/auth_components/AuthInput'
import { AppModal, Button } from '@/components/ui'
import { useScale } from '@/theme'
import React, { useEffect, useState } from 'react'
import { View } from 'react-native'

interface CredentialConfirmModalProps {
  visible: boolean
  title: string
  message: string
  confirmLabel: string
  destructive?: boolean
  loading?: boolean
  errorText?: string
  onCancel: () => void
  onConfirm: (password: string) => Promise<void>
}

/**
 * 🔐 CredentialConfirmModal
 * Used for account-sensitive actions like deleting an account or changing email.
 */
export function CredentialConfirmModal({
  visible,
  title,
  message,
  confirmLabel,
  destructive = false,
  loading = false,
  errorText = '',
  onCancel,
  onConfirm,
}: CredentialConfirmModalProps) {
  const S = useScale()
  const [password, setPassword] = useState('')

  // Reset when modal closes
  useEffect(() => {
    if (!visible) setPassword('')
  }, [visible])

  const handleConfirm = async () => {
    if (password.trim().length > 0) {
      await onConfirm(password.trim())
    }
  }

  return (
    <AppModal
      visible={visible}
      onClose={onCancel}
      heading={title}
      body={message}
      borderTone={destructive ? 'danger' : 'accent'}
    >
      <View
        style={{
          width: '100%',
          marginTop: S.space.sm,
          gap: S.space.sm,
        }}
      >
        {/* Password Input */}
        <AuthInput
          placeholder="Enter your password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!loading}
        />

        {/* Error Display */}
        {!!errorText && <AuthError error={errorText} />}

        {/* Buttons */}
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
            text={loading ? 'Processing...' : confirmLabel}
            variant={destructive ? 'destructive' : 'primary'}
            onPress={handleConfirm}
            disabled={loading || password.trim().length === 0}
          />
        </View>
      </View>
    </AppModal>
  )
}
