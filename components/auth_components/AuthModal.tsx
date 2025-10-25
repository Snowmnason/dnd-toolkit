import { AppModal, Button } from '@/components/ui'
import { Body } from '@/components/ui/AppText'
import { $, useScale } from '@/theme'
import React from 'react'
import { View } from 'react-native'

interface AuthModalButton {
  text: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'cancel'
}

interface AuthModalProps {
  visible: boolean
  onClose: () => void
  title: string
  message?: string
  buttons: AuthModalButton[]
  tone?: 'accent' | 'success' | 'warning' | 'danger'
}

/**
 * 🪄 AuthModal (v2)
 * A themed authentication modal using AppModal styling.
 * Acts as a drop-in for all auth-related screens (redirect, error, success).
 */
export default function AuthModal({
  visible,
  onClose,
  title,
  message,
  buttons,
  tone = 'accent',
}: AuthModalProps) {
  const S = useScale()
  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      heading={title}
      borderTone={tone}
      >
        <View
          style={{
            width: '100%',
            alignItems: 'center',
            gap: S.space.md,
          }}
        >
          {message && (
            <Body
              align="center"
              color={$('textPrimary')}
              style={{
                opacity: 0.9,
                marginBottom: S.space.sm,
                lineHeight: 22,
              }}
            >
              {message}
            </Body>
          )}

          {/* Buttons */}
          <View
            style={{
              width: '100%',
              gap: S.space.sm,
              marginTop: S.space.sm,
            }}
          >
            {buttons.map((btn, i) => (
              <Button
                key={i}
                text={btn.text}
                variant={btn.variant ?? 'primary'}
                onPress={btn.onPress}
              />
            ))}
          </View>
        </View>
    </AppModal>
  )
}
