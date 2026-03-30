import { useScale } from '@/theme';
import React from 'react';
import { Pressable, TextInput as RNTextInput, Text, View } from 'react-native';

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
  const S = useScale()
  return (
    <View style={{ position: 'relative' }}>
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
            height: S.s(48),
            borderColor: '#D4AF37',
            borderRadius: S.radius.lg,
            paddingVertical: S.space.xs,
            paddingHorizontal: S.space.sm,
            backgroundColor: '#F5E6D3',
            color: '#2f353d',
            fontSize: S.font.para,
            marginBottom: -S.space.xs * .5,
          },
          showPasswordToggle ? { paddingRight: S.s(40) } : null,
          style,
        ]}
      />
      
      {/* Password Toggle Button */}
      {showPasswordToggle && onTogglePassword && (
        <Pressable
          style={{
              position: 'absolute',
              right: S.space.xs,
              top: S.space.xxs,
              paddingHorizontal: S.space.xxs,
              paddingVertical: S.space.xxs,
              minWidth: S.s(28),
              maxWidth: S.s(38),
              height: S.s(48),
              opacity: editable ? 1 : 0.5,
          }}
          onPress={onTogglePassword}
          disabled={!editable}
        >
          <Text style={{ fontSize: S.s(18) }}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
        </Pressable>
      )}
    </View>
  );
});

AuthInput.displayName = 'AuthInput';

export default AuthInput;