import React from 'react';
import { TextInput as RNTextInput, TouchableOpacity, View } from 'react-native';

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
  onSubmitEditing?: () => void;
  returnKeyType?: 'done' | 'next' | 'go' | 'send';
  submitBehavior?: 'submit' | 'blurAndSubmit' | 'newline';
}

const AuthInput = React.forwardRef<RNTextInput, AuthInputProps>(({
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
  onSubmitEditing,
  returnKeyType = 'next',
  submitBehavior = 'blurAndSubmit',
}, ref) => {
  return (
    <View style={{ position: 'relative', marginBottom: 2 }}>
      <RNTextInput
        ref={ref}
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        secureTextEntry={secureTextEntry && !showPassword}
        editable={editable}
        placeholderTextColor='#a77e44'
        onSubmitEditing={onSubmitEditing}
        returnKeyType={returnKeyType}
        submitBehavior={submitBehavior}
        style={[
          {
            borderWidth: 2,
            borderColor: '#D4AF37',
            borderRadius: 6,
            paddingVertical: 8,
            paddingHorizontal: 10,
            backgroundColor: '#F5E6D3',
            color: '#2f353d',
            marginBottom: 16,
          },
          showPasswordToggle ? { paddingRight: 40 } : null,
          style,
        ]}
      />
      
      {/* Password Toggle Button */}
      {showPasswordToggle && onTogglePassword && (
        <TouchableOpacity
          style={{
              position: 'absolute',
              right: 4,
              top: 3,
              paddingHorizontal: 4,
              paddingVertical: 4,
              minWidth: 24,
              maxWidth: 30,
              height: 32,
              opacity: editable ? 1 : 0.5,
          }}
          onPress={onTogglePassword}
          disabled={!editable}
          activeOpacity={0.7}
        >
          {showPassword ? '👁️' : '👁️‍🗨️'}
        </TouchableOpacity>
      )}
    </View>
  );
});

AuthInput.displayName = 'AuthInput';

export default AuthInput;