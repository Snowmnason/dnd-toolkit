import React, { useEffect, useState } from 'react';
import { Button, Input, Text, View } from 'tamagui';
import { Spacing } from '../../constants/theme';
import CustomModal from './CustomModal';

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
        <Input
          placeholder="Enter your password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          style={{ marginBottom: 8 }}
        />
        <Text
          onPress={() => setShowPassword((s) => !s)}
          style={{
            textAlign: 'right',
            color: '#C8B9A1', //UPDATE TO THEME
            fontSize: 12,
            marginBottom: Spacing.sm,
          }}
        >
          {showPassword ? 'Hide password' : 'Show password'}
        </Text>

        {!!errorText && (
          <Text
            style={{
              color: '#EF4444',//UPDATE TO THEME
              fontSize: 13,
              marginBottom: Spacing.sm,
              textAlign: 'center',
            }}
          >
            {errorText}
          </Text>
        )}
      </View>

      {/* Action buttons */}
      <View style={{ flexDirection: 'row', gap: Spacing.sm, justifyContent: 'center' }}>
        <Button disabled={loading} onPress={onCancel}>
          Cancel
        </Button>

        <Button disabled={loading || !password} onPress={() => onConfirm(password)}>
          {confirmLabel}
        </Button>
      </View>
    </CustomModal>
  );
}
