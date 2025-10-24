import { AppModal, Body, Button } from '@/components/ui'
import { $, S } from '@/theme'
import React from 'react'
import { View } from 'react-native'

interface CreateWorldModalProps {
  visible: boolean
  onClose: () => void
  onConfirmCreate: () => void
  userId?: string | null
}

/**
 * 🌍 CreateWorldModal
 * Confirms world creation and checks for valid user authentication.
 */
export function CreateWorldModal({
  visible,
  onClose,
  onConfirmCreate,
  userId,
}: CreateWorldModalProps) {
  const isSignedIn = Boolean(userId)

  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      heading="Create New World"
      body={
        isSignedIn
          ? 'Ready to forge a new world?'
          : 'You must be signed in to create a world.'
      }
      borderTone={isSignedIn ? 'accent' : 'warning'}
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
          text="Create"
          variant="primary"
          disabled={!isSignedIn}
          onPress={onConfirmCreate}
        />
      </View>

      {/* Optional hint for unauthenticated users */}
      {!isSignedIn && (
        <Body
          style={{
            marginTop: S.space.sm,
            color: $('textSecondary'),
            textAlign: 'right',
            fontSize: 12,
          }}
        >
          Please sign in and try again.
        </Body>
      )}
    </AppModal>
  )
}
