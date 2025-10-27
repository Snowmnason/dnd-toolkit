import { AppModal, Body, Button } from '@/components/ui'
import { $, useScale, UseTheme } from '@/theme'
import React from 'react'
import { View } from 'react-native'

interface CreateWorldModalsProps {
  showSignInModal: boolean
  setShowSignInModal: (value: boolean) => void
  showValidationModal: boolean
  setShowValidationModal: (value: boolean) => void
  showSuccessModal: boolean
  setShowSuccessModal: (value: boolean) => void
  successWorldName: string
  onSuccessNavigate: () => void
}

/**
 * 🌍 CreateWorldModals
 * Handles sign-in check, validation failure, and success confirmation modals.
 */
export function CreateWorldModals({
  showSignInModal,
  setShowSignInModal,
  showValidationModal,
  setShowValidationModal,
  showSuccessModal,
  setShowSuccessModal,
  successWorldName,
  onSuccessNavigate,
}: CreateWorldModalsProps) {
  const { theme } = UseTheme()
  const S = useScale()
  return (
    <>
      {/* ─────────────── Sign In Required ─────────────── */}
      <AppModal
        visible={showSignInModal}
        onClose={() => setShowSignInModal(false)}
        heading="Sign In Required"
        body="You must be signed in to create a world."
        borderTone="warning"
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
          <Button text="Close" variant="secondary" onPress={() => setShowSignInModal(false)} />
        </View>
      </AppModal>

      {/* ─────────────── Validation Error ─────────────── */}
      <AppModal
        visible={showValidationModal}
        onClose={() => setShowValidationModal(false)}
        heading="Invalid World Name"
        body="Please enter a valid world name before continuing."
        borderTone="danger"
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
          <Button text="Close" variant="secondary" onPress={() => setShowValidationModal(false)} />
        </View>
      </AppModal>

      {/* ─────────────── Success Modal ─────────────── */}
      <AppModal
        visible={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        heading="World Created!"
        body={`Your world "${successWorldName}" has been successfully created.`}
        borderTone="accent"
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
          <Button text="Close" variant="secondary" onPress={() => setShowSuccessModal(false)} />
          <Button text="Enter World" variant="primary" onPress={onSuccessNavigate} />
        </View>
        <Body
          style={{
            marginTop: S.space.sm,
            color: $('textSecondary', theme),
            textAlign: 'right',
            fontSize: 12,
          }}
        >
          Adventure awaits!
        </Body>
      </AppModal>
    </>
  )
}
