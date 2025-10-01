import React from 'react';
import { View } from 'react-native';
import PrimaryButton from '../PrimaryButton';
import TextInput from '../TextInput';

interface AuthInputProps {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  secureTextEntry?: boolean;
  editable?: boolean;
  style?: object;
  showPasswordToggle?: boolean;
  onTogglePassword?: () => void;
  showPassword?: boolean;
}

export default function AuthInput({
  placeholder,
  value,
  onChangeText,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  secureTextEntry = false,
  editable = true,
  style,
  showPasswordToggle = false,
  onTogglePassword,
  showPassword = false,
}: AuthInputProps) {
  return (
    <View style={{ position: 'relative', marginBottom: 8 }}>
      <TextInput
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        secureTextEntry={secureTextEntry && !showPassword}
        editable={editable}
        style={showPasswordToggle ? { paddingRight: 50, ...style } : style}
      />
      
      {/* Password Toggle Button */}
      {showPasswordToggle && onTogglePassword && (
        <PrimaryButton
          style={{ 
            position: 'absolute', 
            right: 4, 
            top: 3, 
            backgroundColor: 'transparent', 
            paddingHorizontal: 4, 
            paddingVertical: 4,
            minWidth: 24,
            maxWidth: 30,
            height: 32,
            opacity: editable ? 1 : 0.5
          }}
          textStyle={{ color: '#D4AF37', fontSize: 16 }}
          onPress={onTogglePassword}
          disabled={!editable}
        >
          {showPassword ? '👁️' : '👁️‍🗨️'}
        </PrimaryButton>
      )}
    </View>
  );
}