import { AppModal, AppView, Button } from '@/components/ui'
import { $, tone, useScale } from '@/theme'
import React from 'react'
import { Platform } from 'react-native'

interface SettingsMenuProps {
  visible: boolean
  onClose: () => void
  onAccountSettings: () => void
  onReturnToWorldSelection: () => void
}

export default function SettingsModal({
  visible,
  onClose,
  onAccountSettings,
  onReturnToWorldSelection,
}: SettingsMenuProps) {
  const S = useScale()
  const isDesktop =
    Platform.OS === 'web' ||
    Platform.OS === 'windows' ||
    Platform.OS === 'macos'
  const scale = isDesktop ? 1.25 : 1.0

  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      heading="Settings"
      borderTone="accent"
      width={280 * scale}
    >
      <AppView
        gap="sm"
        style={{
          minWidth: 260 * scale,
        }}
      >
        {/* Account Settings */}
        <Button
          text="Account Settings"
          variant="secondary"
          onPress={() => {
            onClose()
            onAccountSettings()
          }}
          style={{
            paddingVertical: S.space.md * scale,
            borderColor: tone($('border'), 'subtle'),
            borderWidth: 1,
          }}
        />

        {/* Return to World Selection */}
        <Button
          text="Return to World Selection"
          variant="solid"
          onPress={() => {
            onClose()
            onReturnToWorldSelection()
          }}
          style={{
            backgroundColor: tone($('accent'), 'alt'),
            paddingVertical: S.space.md * scale,
          }}
        />

        {/* Cancel */}
        <Button
          text="Cancel"
          variant="cancel"
          onPress={onClose}
          style={{
            paddingVertical: S.space.md * scale,
          }}
        />
      </AppView>
    </AppModal>
  )
}
