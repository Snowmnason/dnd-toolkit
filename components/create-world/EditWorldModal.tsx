import { logger } from '@/lib/utils/logger';
import React, { useState } from 'react';
import { Platform, TextInput, TouchableOpacity, View } from 'react-native';
import { BorderRadius, CoreColors, Spacing } from '../../constants/theme';
import { createWorldNameChangeHandler, isValidWorldNameForSubmission, type WorldNameValidationResult } from '../../lib/auth/validation';
import CustomModal from '../CustomModal';
import { ThemedText } from '../themed-text';

interface EditWorldModalProps {
  visible: boolean;
  onClose: () => void;
  worldName: string;
  originalWorldName?: string; // Add original name for comparison
  onWorldNameChange: (name: string) => void;
  onConfirmWorldName: () => void;
  onGenerateInviteLink: () => Promise<void>;
  onDeleteWorld: () => Promise<void>;
  generatingLink: boolean;
}

export default function EditWorldModal({
  visible,
  onClose,
  worldName,
  originalWorldName,
  onWorldNameChange,
  onConfirmWorldName,
  onGenerateInviteLink,
  generatingLink,
  onDeleteWorld,
}: EditWorldModalProps) {
  const isDesktop = Platform.OS === 'web' || Platform.OS === 'windows' || Platform.OS === 'macos';
  
  // Validation state
  const [worldNameValidation, setWorldNameValidation] = useState<WorldNameValidationResult | null>(null);

  // Button states
  const [deleting, setDeleting] = useState(false);
  const [deleteDisabled, setDeleteDisabled] = useState(false);

  const handleGenerateInviteLinkClick = async () => {
    if (generatingLink) return;
    
    try {
      await onGenerateInviteLink();
    } catch (error) {
      logger.error('edit-world-modal', 'Failed to generate invite link:', error);
    }finally {
      //setGeneratingLink(false);
    }
  };

  const handleDeleteClick = async () => {
    if (deleteDisabled) return;
    
    if (!deleting) {
      setDeleting(true);
      setDeleteDisabled(true);
      setTimeout(() => {
        setDeleteDisabled(false);
      }, 1500);
    } else {
      try {
        setDeleteDisabled(true);
        await onDeleteWorld();
      } catch (error) {
        logger.error('edit-world-modal', 'Failed to delete world:', error);
        setDeleteDisabled(false);
      }
    }
  };

  return (
    <CustomModal
      visible={visible}
      onClose={onClose}
      title={worldName ? `Edit ${worldName}` : 'Edit This World'}
      buttons={[]} // We'll use children instead
    >
      {/* Textbox and inline button */}
      <ThemedText>Edit World Name</ThemedText>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md }}>
        <TextInput
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: CoreColors.borderPrimary,
            borderRadius: BorderRadius.md,
            padding: Spacing.sm,
            marginRight: Spacing.sm,
            color: CoreColors.textPrimary,
            backgroundColor: CoreColors.backgroundDark,
            fontSize: isDesktop ? 18 : 16,
          }}
          placeholder="Enter world name..."
          placeholderTextColor={CoreColors.textSecondary}
          value={worldName}
          onChangeText={createWorldNameChangeHandler(onWorldNameChange, setWorldNameValidation)}
        />
        <TouchableOpacity
          style={{
            backgroundColor: (worldName.length > 3) ? CoreColors.secondary : '#6c757d',
            paddingVertical: Spacing.sm,
            paddingHorizontal: Spacing.md,
            borderRadius: BorderRadius.md,
            opacity: (worldName.length > 3) ? 1 : 0.6,
          }}
          onPress={onConfirmWorldName}
          disabled={!isValidWorldNameForSubmission(worldName, originalWorldName)}
        >
          <ThemedText style={{ color: CoreColors.textPrimary, fontWeight: 'bold', fontSize: isDesktop ? 17 : 16 }}>Confirm</ThemedText>
        </TouchableOpacity>
      </View>

      {/* Validation errors */}
      {worldNameValidation && !worldNameValidation.isValid && (
        <View style={{ marginBottom: Spacing.md }}>
          {worldNameValidation.errors.map((error, index) => (
            <ThemedText key={index} style={{
              color: '#FF6B6B',
              fontSize: 14,
              marginBottom: Spacing.xs
            }}>
              ⚠️ {error}
            </ThemedText>
          ))}
        </View>
      )}

      {/* Invite Section */}
      <ThemedText>Share {worldName || 'this world'} with others</ThemedText>
      <TouchableOpacity
        style={{
          backgroundColor: !generatingLink ? CoreColors.secondary : '#6c757d',
          paddingVertical: Spacing.md,
          borderRadius: BorderRadius.md,
          marginBottom: Spacing.md,
          opacity: !generatingLink ? 1 : 0.6,
        }}
        onPress={handleGenerateInviteLinkClick}
        disabled={generatingLink}
      >
        <ThemedText style={{ 
          color: CoreColors.textPrimary, 
          textAlign: 'center', 
          fontWeight: 'bold', 
          fontSize: isDesktop ? 17 : 16 
        }}>
          {generatingLink ? '📋 Link Saved to Clipboard' : '🔗 Generate Invite Link'}
        </ThemedText>
      </TouchableOpacity>
      <ThemedText style={{ 
        fontSize: (isDesktop ? 18 : 16) - 2,
        color: CoreColors.textSecondary,
        textAlign: 'center',
        marginBottom: Spacing.sm,
        marginTop: -20
      }}>
        Creates a shareable link that&apos;s copied to your clipboard
      </ThemedText>

      {/* Delete button below */}
      <TouchableOpacity
        style={{
          backgroundColor: deleteDisabled ? '#6c757d' : '#FF6B6B',
          paddingVertical: Spacing.sm,
          borderRadius: BorderRadius.md,
          marginTop: Spacing.md,
          opacity: deleteDisabled ? 0.6 : 1,
        }}
        onPress={handleDeleteClick}
        disabled={deleteDisabled}
      >
        <ThemedText style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold', fontSize: isDesktop ? 17 : 16 }}>
          {deleting ? 'Confirm Delete' : 'Delete'}
        </ThemedText>
      </TouchableOpacity>
    </CustomModal>
  );
}