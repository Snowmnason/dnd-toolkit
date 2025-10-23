import { Body, Button, ButtonText } from '@/components/ui';
import { View } from 'react-native';

interface AuthErrorProps {
  error: string;
  onResendEmail?: () => void;
  isResending?: boolean;
}

export default function AuthError({ error, onResendEmail, isResending }: AuthErrorProps) {
  if (!error) return null;

  const isSuccess = error.startsWith('✅');
  const isResendError = error === 'RESEND_EMAIL';
  if (isResendError && onResendEmail) {
      return (
        <View style={{ marginBottom: 8 }}>
          <View
            style={{
              backgroundColor: 'rgba(245, 230, 211, 0.1)',
              padding: 12,
              borderRadius: 4,
              borderWidth: 1,
              borderColor: 'rgba(245, 230, 211, 0.2)',
            }}
          >
            <Body
              fontSize="$sm"
              style={{
                textAlign: 'center',
                color: '#F5E6D3',
                fontWeight: '500',
                lineHeight: 16,
                opacity: 0.9,
                marginBottom: 8,
              }}
            >
              ❌ Please check your email and click the confirmation link before signing in.
            </Body>
          
          <Button
            style={{
              backgroundColor: '#D4AF37',
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 4,
              alignSelf: 'center',
            }}
            onPress={onResendEmail}
            disabled={isResending}
          >
            <ButtonText
              fontSize="$xs"
              color="#2f353d"
              variant="semi"
              style={{ fontWeight: '600' }}
            >
              {isResending ? '📧 Sending...' : '📧 Resend Email'}
            </ButtonText>
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View style={{ marginBottom: 8 }}>
      <Body
        fontSize="$xs"
        style={{
          textAlign: 'center',
          color: isSuccess ? '#82cc7eff' : '#F5E6D3', //'#A3D4A0'
          fontWeight: '500',
          lineHeight: 16,
          opacity: 0.9,
          backgroundColor: 'rgba(245, 230, 211, 0.1)',
          padding: 8,
          borderRadius: 4,
          borderWidth: 1,
          borderColor: 'rgba(245, 230, 211, 0.2)',
        }}
      >
        {isSuccess ? error : `❌ ${error}`}
      </Body>
    </View>
  );
}