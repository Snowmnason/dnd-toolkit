import { Body, Title } from '@/components/ui/AppText'
import { Button } from '@/components/ui/BaseButton'
import { S } from '@/theme'
import React from 'react'
import { Modal, TouchableOpacity, View, useWindowDimensions } from 'react-native'

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
}

/**
 * 🪄 AuthModal — simple alert modal for login/welcome flows
 * Now includes responsive width & spacing based on device size.
 */
export default function AuthModal({
  visible,
  onClose,
  title,
  message,
  buttons,
}: AuthModalProps) {
  const { width } = useWindowDimensions()
  const isDesktop = width >= 900

  // Responsive modal dimensions
  const modalWidth = {
    width: isDesktop ? 500 : 350,
    maxWidth: '90%' as const,
  }

  const fontSize = {
    title: isDesktop ? 24 : 20,
    message: isDesktop ? 18 : 16,
  }

  const scaledSpacing = {
    lg: S.space.lg * (isDesktop ? 1.5 : 1.2),
    md: S.space.md * (isDesktop ? 1.3 : 1.1),
    sm: S.space.sm * (isDesktop ? 1.2 : 1),
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      {/* Dim overlay */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.6)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: scaledSpacing.lg,
        }}
      >
        {/* Modal card */}
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <View
            style={{
              backgroundColor: '#F5E6D3',
              borderRadius: S.radius.lg,
              padding: scaledSpacing.lg,
              width: modalWidth.width,
              maxWidth: modalWidth.maxWidth,
              borderWidth: 2,
              borderColor: '#8B4513',
              alignItems: 'center',
            }}
          >
            {/* Title */}
            <Title
              color="#8B4513"
              align="center"
              fontSize={fontSize.title}
              style={{ marginBottom: scaledSpacing.sm }}
            >
              {title}
            </Title>

            {/* Message */}
            {message && (
              <Body
                color="#2F353D"
                align="center"
                fontSize={fontSize.message}
                style={{
                  opacity: 0.9,
                  marginBottom: scaledSpacing.lg,
                  lineHeight: 22,
                  paddingHorizontal: scaledSpacing.sm,
                }}
              >
                {message}
              </Body>
            )}

            {/* Buttons */}
            <View style={{ width: '100%', gap: scaledSpacing.sm }}>
              {buttons.map((btn, i) => (
                <Button
                  key={i}
                  variant={btn.variant ?? 'primary'}
                  text={btn.text}
                  onPress={btn.onPress}
                />
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}
