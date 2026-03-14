import { AppModal, Body, Button, FormTextInput, IconButton } from '@/components/ui'
import { registerModal } from '@/contexts'
import { $, useScale, UseTheme } from '@/theme'
import { type ChangePasswordFormData } from '@/validation/auth.schema'
import { Ionicons } from '@expo/vector-icons'
import React from 'react'
import { Control } from 'react-hook-form'
import { View } from 'react-native'

interface UpdatePasswordModalProps {
  onCancel: () => void
  loading?: boolean
  error?: string | null
  passwordControl: Control<ChangePasswordFormData>
  passwordIsValid: boolean
  passwordHandleSubmit: () => void
}

/**
 * 🔑 UpdatePasswordModal
 * Single-purpose modal for changing a user's password.
 * Three fields: current, new, confirm — with a shared show/hide toggle.
 */
export function UpdatePasswordModal({
  onCancel,
  loading = false,
  error,
  passwordControl,
  passwordIsValid,
  passwordHandleSubmit,
}: UpdatePasswordModalProps) {
  const S = useScale()
  const { theme } = UseTheme()
  const [showPasswords, setShowPasswords] = React.useState(false)

  return (
    <AppModal
      visible={true}
      onClose={onCancel}
      heading="Change Password"
      body="Update your password."
      borderTone="accent"
    >
      <View style={{ width: '100%', marginTop: S.space.sm, gap: S.space.md }}>
        {/* Show/Hide Toggle */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Body variant="semi" fontSize="$body">
            Passwords
          </Body>
          <IconButton
            content={
              <Ionicons
                name={showPasswords ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={$('textPrimary', theme)}
              />
            }
            variant="icon"
            onPress={() => setShowPasswords(!showPasswords)}
            size="sm"
          />
        </View>

        <FormTextInput
          control={passwordControl}
          name="currentPassword"
          placeholder="Current password"
          secureTextEntry={!showPasswords}
          editable={!loading}
        />
        <FormTextInput
          control={passwordControl}
          name="newPassword"
          placeholder="New password"
          secureTextEntry={!showPasswords}
          editable={!loading}
        />
        <FormTextInput
          control={passwordControl}
          name="confirmPassword"
          placeholder="Confirm new password"
          secureTextEntry={!showPasswords}
          editable={!loading}
        />

        {error && (
          <Body
            style={{
              color: $('danger', theme),
              marginTop: S.space.xs,
              fontSize: S.s(13),
              fontWeight: '600',
            }}
          >
            {error}
          </Body>
        )}

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'flex-end',
            gap: S.space.sm,
            marginTop: S.space.md,
          }}
        >
          <Button text="Cancel" variant="secondary" onPress={onCancel} />
          <Button
            text={loading ? 'Updating...' : 'Update'}
            variant="primary"
            disabled={!passwordIsValid || loading}
            onPress={passwordHandleSubmit}
          />
        </View>
      </View>
    </AppModal>
  )
}

// Register modal for centralized management
registerModal('update-password', UpdatePasswordModal)
