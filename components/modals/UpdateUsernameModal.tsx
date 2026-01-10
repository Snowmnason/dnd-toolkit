import { AppModal, Body, Button, FormTextInput } from '@/components/ui'
import { $, useScale, UseTheme } from '@/theme'
import React, { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { updateUsernameSchema, type UpdateUsernameFormData } from '@/lib/schemas/auth.schema'
import { View } from 'react-native'

interface UpdateUsernameModalProps {
  visible: boolean
  currentUsername: string
  onCancel: () => void
  onConfirm: (newUsername: string) => Promise<void>
  loading?: boolean
  errorText?: string
}

/**
 * ✏️ UpdateUsernameModal
 * Themed + validated modal for changing username
 */
export function UpdateUsernameModal({
  visible,
  currentUsername,
  onCancel,
  onConfirm,
  loading = false,
  errorText = '',
}: UpdateUsernameModalProps) {
  const S = useScale()
  const { theme } = UseTheme()
  const { control, handleSubmit, formState: { isValid, errors }, reset, watch } = useForm<UpdateUsernameFormData>({
    resolver: zodResolver(updateUsernameSchema),
    mode: 'onChange',
    defaultValues: {
      username: '',
      originalUsername: currentUsername,
    },
  })

  const username = watch('username') || ''

  // Reset when modal opens/closes or username changes
  useEffect(() => {
    reset({ username: '', originalUsername: currentUsername })
  }, [visible, currentUsername, reset])

  const handleConfirm = async (values: UpdateUsernameFormData) => {
    if (loading) return
    await onConfirm(values.username.trim())
    reset({ username: '', originalUsername: currentUsername })
  }

  const handleCancel = () => {
    reset({ username: '', originalUsername: currentUsername })
    onCancel()
  }

  const getUsernameHint = () => {
    if (username.length === 0) return ''
    if (errors.username?.message) return errors.username.message
    return `✅ "${username}" looks great!`
  }

  return (
    <AppModal
      visible={visible}
      onClose={handleCancel}
      heading="Change Username"
      body={`Your current username is "${currentUsername}".`}
      borderTone="accent"
    >
      <View
        style={{
          width: '100%',
          marginTop: S.space.sm,
          gap: S.space.md,
        }}
      >
        {/* Username Input */}
        <FormTextInput
          control={control}
          name="username"
          placeholder="New username"
          autoCapitalize="none"
          editable={!loading}
          onSubmitEditing={handleSubmit(handleConfirm)}
        />

        {/* Validation Hint */}
        {username.length > 0 && (
          <Body
            style={{
              marginTop: S.space.xs,
              fontSize: S.s(12),
              color: isValid ? $('success', theme) : $('danger', theme),
              fontWeight: '500',
              lineHeight: S.s(16),
            }}
          >
            {getUsernameHint()}
          </Body>
        )}

        {/* Error Display */}
        {!!errorText && (
          <Body
            style={{
              color: $('danger', theme),
              marginTop: S.space.xs,
              fontSize: S.s(13),
              fontWeight: '600',
            }}
          >
            {errorText}
          </Body>
        )}

        {/* Buttons */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'flex-end',
            gap: S.space.sm,
            marginTop: S.space.md,
          }}
        >
          <Button text="Cancel" variant="secondary" onPress={handleCancel} />
          <Button
            text={loading ? 'Updating...' : 'Update'}
            variant="primary"
            disabled={!isValid || loading}
            onPress={handleSubmit(handleConfirm)}
          />
        </View>
      </View>
    </AppModal>
  )
}
