import { AppModal, Body, Button } from '@/components/ui'
import {
    createWorldNameChangeHandler,
    isValidWorldNameForSubmission,
    type WorldNameValidationResult,
} from '@/lib/auth/validation'
import { logger } from '@/lib/utils/logger'
import { $, useScale, UseTheme } from '@/theme'
import React, { useState } from 'react'
import { Platform, TextInput, View } from 'react-native'

interface EditWorldModalProps {
  visible: boolean
  onClose: () => void
  worldName: string
  originalWorldName?: string
  onWorldNameChange: (name: string) => void
  onConfirmWorldName: () => void
  onGenerateInviteLink: () => Promise<void>
  onDeleteWorld: () => Promise<void>
  generatingLink: boolean
}

/**
 * 🌍 EditWorldModal
 * Fully featured world editor with validation, invite links, and safe deletion.
 */
export function EditWorldModal({
  visible,
  onClose,
  worldName,
  originalWorldName,
  onWorldNameChange,
  onConfirmWorldName,
  onGenerateInviteLink,
  onDeleteWorld,
  generatingLink,
}: EditWorldModalProps) {
  const S = useScale()
  const { theme } = UseTheme()
  const [worldNameValidation, setWorldNameValidation] =
    useState<WorldNameValidationResult | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteDisabled, setDeleteDisabled] = useState(false)

  const isDesktop =
    Platform.OS === 'web' ||
    Platform.OS === 'windows' ||
    Platform.OS === 'macos'

  const handleGenerateInviteLinkClick = async () => {
    if (generatingLink) return
    try {
      await onGenerateInviteLink()
    } catch (error) {
      logger.error('edit-world-modal', 'Failed to generate invite link:', error)
    }
  }

  const handleDeleteClick = async () => {
    if (deleteDisabled) return

    if (!deleting) {
      // 🕓 First click: trigger shake + disable briefly
      setDeleting(true)
      setDeleteDisabled(true)
      setTimeout(() => setDeleteDisabled(false), 1500)
    } else {
      // 🗑️ Second click: confirm delete
      try {
        setDeleteDisabled(true)
        await onDeleteWorld()
        onClose()
      } catch (error) {
        logger.error('edit-world-modal', 'Failed to delete world:', error)
        setDeleteDisabled(false)
      }
    }
  }

  const validName = isValidWorldNameForSubmission(worldName, originalWorldName)

  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      heading={worldName ? `Edit ${worldName}` : 'Edit This World'}
      body="Rename your world, share it with others, or delete it permanently."
      borderTone="accent"
      animateOnDestruction={deleting} // 💥 modal shakes on delete confirmation
    >
      {/* 🏷️ Edit Name Section */}
      <Body style={{ marginBottom: S.space.xs, fontWeight: '600' }}>
        Edit World Name
      </Body>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: S.space.md,
          gap: S.space.sm,
        }}
      >
        <TextInput
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: $('border', theme),
            borderRadius: S.radius.md,
            padding: S.space.sm,
            color: $('textPrimary', theme),
            backgroundColor: $('surface', theme),
            fontSize: isDesktop ? 18 : 16,
          }}
          placeholder="Enter world name..."
          placeholderTextColor={$('textSecondary', theme)}
          value={worldName}
          onChangeText={createWorldNameChangeHandler(
            onWorldNameChange,
            setWorldNameValidation
          )}
        />
        <Button
          text="Confirm"
          variant="primary"
          onPress={onConfirmWorldName}
          disabled={!validName}
        />
      </View>

      {/* ⚠️ Validation Errors */}
      {worldNameValidation && !worldNameValidation.isValid && (
        <View style={{ marginBottom: S.space.md }}>
          {worldNameValidation.errors.map((err, i) => (
            <Body
              key={i}
              style={{
                color: $('danger', theme),
                fontSize: 14,
                marginBottom: S.space.xs,
              }}
            >
              ⚠️ {err}
            </Body>
          ))}
        </View>
      )}

      {/* 🔗 Invite Section */}
      <Body style={{ marginBottom: S.space.xs, fontWeight: '600' }}>
        Share {worldName || 'this world'} with others
      </Body>

      <Button
        text={
          generatingLink ? '📋 Link Saved to Clipboard' : '🔗 Generate Invite Link'
        }
        variant="secondary"
        onPress={handleGenerateInviteLinkClick}
        disabled={generatingLink}
        style={{
          marginBottom: S.space.sm,
        }}
      />

      <Body
        style={{
          fontSize: 14,
          color: $('textSecondary', theme),
          textAlign: 'center',
          marginBottom: S.space.md,
        }}
      >
        Creates a shareable link that’s copied to your clipboard.
      </Body>

      {/* 💀 Delete Button */}
      <Button
        text={deleting ? 'Confirm Delete' : 'Delete'}
        variant="destructive"
        onPress={handleDeleteClick}
        disabled={deleteDisabled}
        style={{
          opacity: deleteDisabled ? 0.7 : 1,
          marginTop: S.space.sm,
        }}
      />

      {/* Close Button */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-end',
          marginTop: S.space.md,
        }}
      >
        <Button text="Close" variant="secondary" onPress={onClose} />
      </View>
    </AppModal>
  )
}
