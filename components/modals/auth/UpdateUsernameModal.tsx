import { AppModal, Body, Button, FormTextInput } from '@/components/ui'
import { registerModal } from '@/contexts'
import { $, useScale, UseTheme } from '@/theme'
import { type UpdateUsernameFormData } from '@/validation/auth.schema'
import { Control } from 'react-hook-form'
import { View } from 'react-native'

interface UpdateUsernameModalProps {
  onCancel: () => void
  loading?: boolean
  error?: string | null
  usernameControl: Control<UpdateUsernameFormData>
  usernameIsValid: boolean
  usernameHandleSubmit: () => void
}

/**
 * ✏️ UpdateUsernameModal
 * Single-purpose modal for changing a user's username.
 */
export function UpdateUsernameModal({
  onCancel,
  loading = false,
  error,
  usernameControl,
  usernameIsValid,
  usernameHandleSubmit,
}: UpdateUsernameModalProps) {
  const S = useScale()
  const { theme } = UseTheme()

  return (
    <AppModal
      visible={true}
      onClose={onCancel}
      heading="Change Username"
      body="Update your username."
      borderTone="accent"
    >
      <View style={{ width: '100%', marginTop: S.space.sm, gap: S.space.md }}>
        <FormTextInput
          control={usernameControl}
          name="username"
          placeholder="New username"
          autoCapitalize="none"
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
            disabled={!usernameIsValid || loading}
            onPress={usernameHandleSubmit}
          />
        </View>
      </View>
    </AppModal>
  )
}

// Register modal for centralized management
registerModal('update-username', UpdateUsernameModal)
