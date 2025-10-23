import { Body } from '@/components/ui';
import React from 'react';
import { View } from 'react-native';

interface AuthSuccessProps {
  message: string;
}

const AuthSuccess: React.FC<AuthSuccessProps> = ({ message }) => {
  if (!message) return null;

  return (
    <View
      style={{
        backgroundColor: 'rgba(163, 212, 160, 0.1)',
        borderColor: '#82cc7eff',//'#A3D4A0'
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
        width: '100%',
        maxWidth: 300
      }}
    >
    <Body
      fontSize="$sm"
      color='#82cc7eff'//'#A3D4A0'
      style={{
        textAlign: 'center',
        fontWeight: '500',
        lineHeight: 20,
      }}
    >
      ✓ {message}
    </Body>
    </View>
  );
};

export default AuthSuccess;