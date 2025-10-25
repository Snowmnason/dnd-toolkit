import { AppModal, Body, Button, TextInput } from '@/components/ui'
import { validateUsername } from '@/lib/auth/validation'
import { $, useScale } from '@/theme'
import React, { useEffect, useState } from 'react'
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
  const [newUsername, setNewUsername] = useState('')

  // ✅ Reset field when modal closes
  useEffect(() => {
    if (!visible) {
      setNewUsername('')
    }
  }, [visible])

  const usernameValidation = validateUsername(newUsername)
  const isValid =
    usernameValidation.isValid && newUsername.trim() !== currentUsername.trim()

  const handleConfirm = async () => {
    if (isValid && !loading) {
      await onConfirm(newUsername.trim())
      setNewUsername('')
    }
  }

  const handleCancel = () => {
    setNewUsername('')
    onCancel()
  }

  const getUsernameHint = () => {
    if (newUsername.length === 0) return ''
    if (newUsername === currentUsername)
      return 'New username must be different'
    if (!usernameValidation.minLength || !usernameValidation.maxLength)
      return 'Username must be 3–20 characters'
    if (!usernameValidation.startsWithLetter)
      return 'Username must start with a letter'
    if (!usernameValidation.validChars)
      return 'Only letters, numbers, and underscores allowed'
    if (usernameValidation.isValid)
      return `✅ "${newUsername}" looks great!`
    return 'Invalid username'
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
        <TextInput
          value={newUsername}
          onChangeText={setNewUsername}
          placeholder="New username"
          autoCapitalize="none"
          editable={!loading}
          style={{
            borderColor:
              newUsername.length > 0 && !isValid
                ? $('danger')
                : $('border'),
            borderWidth: 1.5,
          }}
        />

        {/* Validation Hint */}
        {newUsername.length > 0 && (
          <Body
            style={{
              marginTop: S.space.xs,
              fontSize: 12,
              color: isValid ? $('success') : $('danger'),
              fontWeight: '500',
              lineHeight: 16,
            }}
          >
            {getUsernameHint()}
          </Body>
        )}

        {/* Error Display */}
        {!!errorText && (
          <Body
            style={{
              color: $('danger'),
              marginTop: S.space.xs,
              fontSize: 13,
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
            onPress={handleConfirm}
          />
        </View>
      </View>
    </AppModal>
  )
}
