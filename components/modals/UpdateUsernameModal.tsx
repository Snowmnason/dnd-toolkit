import { CoreColors } from '@/constants/corecolors';
import React, { useState } from 'react';
import { View } from 'react-native';
import { Spacing } from '../../constants/theme';
import { validateUsername } from '../../lib/auth/validation';
import CustomModal from '../CustomModal';
import AuthError from '../auth_components/AuthError';
import AuthInput from '../auth_components/AuthInput';
import { ThemedText } from '../themed-text';

interface UpdateUsernameModalProps {
  visible: boolean;
  currentUsername: string;
  onCancel: () => void;
  onConfirm: (newUsername: string) => Promise<void>;
  loading?: boolean;
  errorText?: string;
}

export default function UpdateUsernameModal({
  visible,
  currentUsername,
  onCancel,
  onConfirm,
  loading = false,
  errorText = ''
}: UpdateUsernameModalProps) {
  const [newUsername, setNewUsername] = useState('');
  
  const usernameValidation = validateUsername(newUsername);
  const isValid = usernameValidation.isValid && newUsername !== currentUsername;

  const handleConfirm = async () => {
    if (isValid) {
      await onConfirm(newUsername);
    }
  };

  const handleCancel = () => {
    setNewUsername('');
    onCancel();
  };

  const getUsernameHint = () => {
    if (newUsername.length === 0) return '';
    if (newUsername === currentUsername) return 'New username must be different';
    if (!usernameValidation.minLength || !usernameValidation.maxLength) {
      return 'Username must be 3-20 characters';
    }
    if (!usernameValidation.startsWithLetter) {
      return 'Username must start with a letter';
    }
    if (!usernameValidation.validChars) {
      return 'Only letters, numbers, and underscores allowed';
    }
    if (usernameValidation.isValid) {
      return `✅ "${newUsername}" is available!`;
    }
    return 'Invalid username';
  };

  const buttons = [
    {
      text: 'Cancel',
      onPress: handleCancel,
      style: 'cancel' as const
    },
    {
      text: loading ? 'Updating...' : 'Update',
      onPress: handleConfirm,
      style: 'primary' as const
    }
  ];

  return (
    <CustomModal
      visible={visible}
      onClose={handleCancel}
      title="Update Username"
      buttons={buttons}
    >
      <View style={{ width: '100%', paddingHorizontal: Spacing.md }}>
        <ThemedText
          style={{
            marginBottom: Spacing.lg,
            color: CoreColors.textSecondary,
            textAlign: 'center',
            fontSize: 14,
            lineHeight: 20
          }}
        >
          Current username: <ThemedText style={{ fontWeight: '600' }}>{currentUsername}</ThemedText>
        </ThemedText>

        {/* Username Input */}
        <View style={{ marginBottom: Spacing.md }}>
          <AuthInput
            placeholder="New username"
            value={newUsername}
            onChangeText={setNewUsername}
            autoCapitalize="none"
            editable={!loading}
            style={{
              borderColor: newUsername.length > 0 && !isValid ? '#dc3545' : undefined,
              borderWidth: newUsername.length > 0 && !isValid ? 2 : undefined
            }}
          />

          {/* Validation Hint */}
          {newUsername.length > 0 && (
            <ThemedText
              style={{
                marginTop: Spacing.xs,
                fontSize: 12,
                color: isValid ? '#A3D4A0' : '#F5A5A5',
                fontWeight: '500',
                lineHeight: 16
              }}
            >
              {getUsernameHint()}
            </ThemedText>
          )}

          {/* Error Display */}
          <AuthError error={errorText} />
        </View>
      </View>
    </CustomModal>
  );
}
