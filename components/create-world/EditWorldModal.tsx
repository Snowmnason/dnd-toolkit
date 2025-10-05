import React, { useState } from 'react';
import { Modal, Platform, TextInput, TouchableOpacity, View } from 'react-native';
import { CoreColors, Spacing } from '../../constants/theme';
import { ThemedText } from '../themed-text';

interface EditWorldModalProps {
  visible: boolean;
  onClose: () => void;
  worldName: string;
  onWorldNameChange: (name: string) => void;
  onConfirmWorldName: () => void;
  onGenerateInviteLink: () => Promise<void>;
  onDeleteWorld: () => Promise<void>;
}

export default function EditWorldModal({
  visible,
  onClose,
  worldName,
  onWorldNameChange,
  onConfirmWorldName,
  onGenerateInviteLink,
  onDeleteWorld,
}: EditWorldModalProps) {
  const isDesktop = Platform.OS === 'web' || Platform.OS === 'windows' || Platform.OS === 'macos';
  const modalWidth = {
    width: isDesktop ? 500 : 350,
    maxWidth: '90%' as const,
  };
  const fontSize = {
    title: isDesktop ? 24 : 20,
    button: isDesktop ? 17 : 16,
    input: isDesktop ? 18 : 16,
  };
  const scaledSpacing = {
    lg: Spacing.lg * (isDesktop ? 1.5 : 1.2),
    md: Spacing.md * (isDesktop ? 1.5 : 1.2),
    sm: Spacing.sm * (isDesktop ? 1.5 : 1.2),
  };

  // Button states
  const [generatingLink, setGeneratingLink] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteDisabled, setDeleteDisabled] = useState(false);

  const handleGenerateInviteLinkClick = async () => {
    if (generatingLink) return;
    
    try {
      setGeneratingLink(true);
      await onGenerateInviteLink();
    } catch (error) {
      console.error('Failed to generate invite link:', error);
    } finally {
      setGeneratingLink(false);
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
        console.error('Failed to delete world:', error);
        setDeleteDisabled(false);
      }
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
      accessibilityViewIsModal={true}
    >
        <TouchableOpacity 
        style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'center',
            alignItems: 'center',
        }}
        activeOpacity={1}
        onPress={onClose}
        >
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={{
            backgroundColor: CoreColors.backgroundLight,
            borderRadius: 16,
            padding: scaledSpacing.lg,
            width: modalWidth.width,
            maxWidth: modalWidth.maxWidth,
            borderWidth: 2,
            borderColor: CoreColors.secondary,
            shadowColor: '#000',
            shadowOpacity: 0.2,
            shadowRadius: 8,
            elevation: 8,
            position: 'relative',
          }}>
          {/* Close button */}
          <TouchableOpacity
            style={{
              position: 'absolute',
              top: scaledSpacing.sm,
              right: scaledSpacing.sm,
              zIndex: 1,
              padding: scaledSpacing.sm,
            }}
            onPress={onClose}
          >
            <ThemedText style={{
              fontSize: fontSize.title,
              fontWeight: 'bold',
              color: CoreColors.textSecondary,
            }}>
              ×
            </ThemedText>
          </TouchableOpacity>

          <ThemedText style={{
            fontSize: fontSize.title,
            fontWeight: 'bold',
            marginBottom: scaledSpacing.md,
            textAlign: 'center',
            color: CoreColors.textOnLight,
          }}>
            {worldName ? `Edit ${worldName}` : 'Edit World'}
          </ThemedText>

          {/* Textbox and inline button */}
          <ThemedText>Edit World Name</ThemedText>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: scaledSpacing.md }}>
            <TextInput
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: CoreColors.borderPrimary,
                borderRadius: 8,
                padding: scaledSpacing.sm,
                marginRight: scaledSpacing.sm,
                color: CoreColors.textPrimary,
                backgroundColor: CoreColors.backgroundDark,
                fontSize: fontSize.input,
              }}
              placeholder="Enter world name..."
              placeholderTextColor={CoreColors.textSecondary}
              value={worldName}
              onChangeText={onWorldNameChange}
            />
            <TouchableOpacity
              style={{
                backgroundColor: CoreColors.secondary,
                paddingVertical: scaledSpacing.sm,
                paddingHorizontal: scaledSpacing.md,
                borderRadius: 8,
              }}
              onPress={onConfirmWorldName}
            >
              <ThemedText style={{ color: CoreColors.textPrimary, fontWeight: 'bold', fontSize: fontSize.button }}>Confirm</ThemedText>
            </TouchableOpacity>
          </View>

          {/* Invite Section */}
          <ThemedText>Share {worldName || 'this world'} with others</ThemedText>
          <TouchableOpacity
            style={{
              backgroundColor: !generatingLink ? CoreColors.secondary : '#6c757d',
              paddingVertical: scaledSpacing.md,
              borderRadius: 8,
              marginBottom: scaledSpacing.md,
              opacity: !generatingLink ? 1 : 0.6,
            }}
            onPress={handleGenerateInviteLinkClick}
            disabled={generatingLink}
          >
            <ThemedText style={{ 
              color: CoreColors.textPrimary, 
              textAlign: 'center', 
              fontWeight: 'bold', 
              fontSize: fontSize.button 
            }}>
              {generatingLink ? 'Generating Link...' : '🔗 Generate Invite Link'}
            </ThemedText>
          </TouchableOpacity>
          <ThemedText style={{ 
            fontSize: fontSize.input - 2, 
            color: CoreColors.textSecondary, 
            textAlign: 'center',
            marginBottom: scaledSpacing.sm,
            marginTop: -20
          }}>
            Creates a shareable link that&apos;s copied to your clipboard
          </ThemedText>

          {/* Delete button below */}
          <TouchableOpacity
            style={{
              backgroundColor: deleteDisabled ? '#6c757d' : '#FF6B6B',
              paddingVertical: scaledSpacing.sm,
              borderRadius: 8,
              marginTop: scaledSpacing.md,
              opacity: deleteDisabled ? 0.6 : 1,
            }}
            onPress={handleDeleteClick}
            disabled={deleteDisabled}
          >
            <ThemedText style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold', fontSize: fontSize.button }}>
              {deleting ? 'Confirm Delete' : 'Delete'}
            </ThemedText>
          </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}