import { AppModal, Button } from '@/components/ui'; // ✅ unified import
import { S } from '@/theme'
import React from 'react'
import { View } from 'react-native'

interface SuccessModalProps {
  visible: boolean
  onClose: () => void
  heading: string
  body?: string
  confirmLabel?: string
  onConfirm?: () => void
}

/**
 * ✅ SuccessModal
 * A minimal modal for successful or positive actions.
 * Example: "World Created!", "Profile Updated!"
 */
export function SuccessModal({
  visible,
  onClose,
  heading,
  body = '',
  confirmLabel = 'Confirm',
  onConfirm,
}: SuccessModalProps) {
  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      heading={heading}
      body={body}
      borderTone="success"
    >
      <View
        style={{
          width: '100%',
          flexDirection: 'row',
          justifyContent: 'flex-end', // ✅ aligns to right
          marginTop: S.space.md,
        }}
      >
        <Button
          text={confirmLabel}
          onPress={onConfirm ?? onClose}
          variant="primary" // ✅ unified button variant
          style={{ minWidth: 120 }}
        />
      </View>
    </AppModal>
  )
}
