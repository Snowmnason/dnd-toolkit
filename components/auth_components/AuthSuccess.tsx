import { Body } from '@/components/ui';
import { useScale } from '@/theme';
import React from 'react';
import { View } from 'react-native';

interface AuthSuccessProps {
  message: string;
}

const AuthSuccess: React.FC<AuthSuccessProps> = ({ message }) => {
  const S = useScale()
  if (!message) return null;

  return (
    <View
      style={{
        backgroundColor: 'rgba(163, 212, 160, 0.1)',
        borderColor: '#82cc7eff',//'#A3D4A0'
        borderWidth: 1,
        borderRadius: S.radius.sm,
        padding: S.space.sm,
        marginBottom: S.space.md,
        width: '95%',
        alignSelf: 'center',
      }}
    >
    <Body
      fontSize="$para"
      color='#82cc7eff'//'#A3D4A0'
      style={{
        textAlign: 'center',
        fontWeight: '500',
        lineHeight: S.font.para + 2,
      }}
    >
      ✓ {message}
    </Body>
    </View>
  );
};

export default AuthSuccess;