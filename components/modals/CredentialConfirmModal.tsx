import { CoreColors } from '@/constants/corecolors';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Spacing } from '../../constants/theme';
import PrimaryButton from '../custom_components/PrimaryButton';
import TextInput from '../custom_components/TextInput';
import CustomModal from '../CustomModal';
import { ThemedText } from '../themed-text';

export interface CredentialConfirmModalProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  errorText?: string;
  onConfirm: (password: string) => void | Promise<void>;
  onCancel: () => void;
}

/**
 * CredentialConfirmModal
 * - Self-contained modal that asks the user to enter their password to confirm a sensitive action
 * - Easy to reuse for delete account, change email, change username, etc.
 */
export default function CredentialConfirmModal({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  destructive = false,
  loading = false,
  errorText,
  onConfirm,
  onCancel,
}: CredentialConfirmModalProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!visible) {
      setPassword('');
      setShowPassword(false);
    }
  }, [visible]);

  // CustomModal handles container spacing; use theme spacing directly for inner elements

  return (
    <CustomModal
      visible={visible}
      onClose={onCancel}
      title={title}
      message={message}
      buttons={[]} // We'll use children instead
    >
      {/* Password field */}
  <View style={{ marginBottom: Spacing.sm }}>
        <TextInput
          placeholder="Enter your password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          style={{ marginBottom: 8 }}
        />
        <ThemedText
          onPress={() => setShowPassword((s) => !s)}
          style={{
            textAlign: 'right',
            color: CoreColors.textSecondary,
            fontSize: 12,
            marginBottom: Spacing.sm,
          }}
        >
          {showPassword ? 'Hide password' : 'Show password'}
        </ThemedText>

        {!!errorText && (
          <ThemedText
            style={{
              color: CoreColors.destructive,
              fontSize: 13,
              marginBottom: Spacing.sm,
              textAlign: 'center',
            }}
          >
            {errorText}
          </ThemedText>
        )}
      </View>

      {/* Action buttons */}
      <View
        style={{
          flexDirection: 'row',
          gap: Spacing.sm,
          justifyContent: 'center',
        }}
     >
        <PrimaryButton
          style={{
            backgroundColor: CoreColors.cancel,
            borderColor: CoreColors.cancelBoarder,
            opacity: loading ? 0.6 : 1,
          }}
          textStyle={{ color: CoreColors.cancelText, fontWeight: '500' }}
          disabled={loading}
          onPress={onCancel}
        >
          Cancel
        </PrimaryButton>

        <PrimaryButton
          style={{
            backgroundColor: destructive ? CoreColors.destructive : CoreColors.primary,
            borderColor: destructive ? CoreColors.destructiveBoarder : CoreColors.primary,
            opacity: loading || !password ? 0.6 : 1,
          }}
          textStyle={{ color: CoreColors.destructiveText, fontWeight: '600' }}
          disabled={loading || !password}
          onPress={() => onConfirm(password)}
        >
          {confirmLabel}
        </PrimaryButton>
      </View>
    </CustomModal>
  );
}
