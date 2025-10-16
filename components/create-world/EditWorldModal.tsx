import { logger } from '@/lib/utils/logger';
import React, { useState } from 'react';
import { Platform } from 'react-native';
import { Button, Input, Text, View } from 'tamagui';
import { BorderRadius, Spacing } from '../../constants/theme';
import { createWorldNameChangeHandler, isValidWorldNameForSubmission, type WorldNameValidationResult } from '../../lib/auth/validation';
import CustomModal from '../modals/CustomModal';

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
      <Text>Edit World Name</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md }}>
        <Input
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: '#888',//UPDATE TO THEME
            borderRadius: BorderRadius.md,
            padding: Spacing.sm,
            marginRight: Spacing.sm,
            color: '#F5E6D3',
            backgroundColor: '#2f353d',//UPDATE TO THEME
            fontSize: isDesktop ? 18 : 16,
          }}
          placeholder="Enter world name..."
          placeholderTextColor={'#C8B9A1'}
          value={worldName}
          onChangeText={createWorldNameChangeHandler(onWorldNameChange, setWorldNameValidation)}
        />
        <Button
          style={{
            backgroundColor: (worldName.length > 3) ? '#D4AF37' : '#6c757d',
            paddingVertical: Spacing.sm,
            paddingHorizontal: Spacing.md,
            borderRadius: BorderRadius.md,
            opacity: (worldName.length > 3) ? 1 : 0.6,
          }}
          onPress={onConfirmWorldName}
          disabled={!isValidWorldNameForSubmission(worldName, originalWorldName)}
        >
          <Text style={{ color: '#2f353d', fontWeight: 'bold', fontSize: isDesktop ? 17 : 16 }}>Confirm</Text>
        </Button>
      </View>

      {/* Validation errors */}
      {worldNameValidation && !worldNameValidation.isValid && (
        <View style={{ marginBottom: Spacing.md }}>
          {worldNameValidation.errors.map((error, index) => (
            <Text key={index} style={{
              color: '#FF6B6B',
              fontSize: 14,
              marginBottom: Spacing.xs
            }}>
              ⚠️ {error}
            </Text>
          ))}
        </View>
      )}

      {/* Invite Section */}
      <Text>Share {worldName || 'this world'} with others</Text>
      <Button
        style={{
          backgroundColor: !generatingLink ? '#D4AF37' : '#6c757d',
          paddingVertical: Spacing.md,
          borderRadius: BorderRadius.md,
          marginBottom: Spacing.md,
          opacity: !generatingLink ? 1 : 0.6,
        }}
        onPress={handleGenerateInviteLinkClick}
        disabled={generatingLink}
      >
        <Text style={{ 
          color: '#2f353d', 
          textAlign: 'center', 
          fontWeight: 'bold', 
          fontSize: isDesktop ? 17 : 16 
        }}>
          {generatingLink ? '📋 Link Saved to Clipboard' : '🔗 Generate Invite Link'}
        </Text>
      </Button>
      <Text style={{ 
        fontSize: (isDesktop ? 18 : 16) - 2,
        color: '#C8B9A1',
        textAlign: 'center',
        marginBottom: Spacing.sm,
        marginTop: -20
      }}>
        Creates a shareable link that&apos;s copied to your clipboard
      </Text>

      {/* Delete button below */}
      <Button
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
        <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold', fontSize: isDesktop ? 17 : 16 }}>
          {deleting ? 'Confirm Delete' : 'Delete'}
        </Text>
      </Button>
    </CustomModal>
  );
}