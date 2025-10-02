import React from 'react';
import { View } from 'react-native';
import { ThemedText } from '../../themed-text';

interface AuthSuccessProps {
  message: string;
}

const AuthSuccess: React.FC<AuthSuccessProps> = ({ message }) => {
  if (!message) return null;

  return (
    <View
      style={{
        backgroundColor: 'rgba(163, 212, 160, 0.1)',
        borderColor: '#A3D4A0',
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
        width: '100%',
        maxWidth: 300
      }}
    >
      <ThemedText
        style={{
          color: '#A3D4A0',
          fontSize: 14,
          textAlign: 'center',
          fontWeight: '500',
          lineHeight: 20
        }}
      >
        ✓ {message}
      </ThemedText>
    </View>
  );
};

export default AuthSuccess;