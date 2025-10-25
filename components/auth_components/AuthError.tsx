import { Body, Button, ButtonText } from '@/components/ui';
import { useScale } from '@/theme';
import { View } from 'react-native';

interface AuthErrorProps {
  error: string;
  onResendEmail?: () => void;
  isResending?: boolean;
}

export default function AuthError({ error, onResendEmail, isResending }: AuthErrorProps) {
  const S = useScale()
  if (!error) return null;

  const isSuccess = error.startsWith('✅');
  const isResendError = error === 'RESEND_EMAIL';
  if (isResendError && onResendEmail) {
      return (
        <View style={{ marginBottom: 8 }}>
          <View
            style={{
              backgroundColor: 'rgba(245, 230, 211, 0.1)',
              padding: S.space.sm,
              borderRadius: S.radius.sm,
              borderWidth: 1,
              borderColor: 'rgba(245, 230, 211, 0.2)',
              width: '95%',
              alignSelf: 'center',
            }}
          >
            <Body
              fontSize="$body1"
              style={{
                textAlign: 'center',
                color: '#F5E6D3',
                fontWeight: '500',
                lineHeight: S.font.body1 + 2,
                opacity: 0.9,
                marginBottom: S.space.xs,
              }}
            >
              ❌ Please check your email and click the confirmation link before signing in.
            </Body>
          
          <Button
            style={{
              backgroundColor: '#D4AF37',
              paddingVertical: S.space.xs,
              paddingHorizontal: S.space.sm,
              borderRadius: S.radius.sm,
              alignSelf: 'center',
            }}
            onPress={onResendEmail}
            disabled={isResending}
          >
            <ButtonText
              fontSize="$body1"
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
        fontSize="$para"
        style={{
          textAlign: 'center',
          color: isSuccess ? '#82cc7eff' : '#F5E6D3', //'#A3D4A0'
          fontWeight: '500',
          lineHeight: S.font.para + 2,
          opacity: 0.9,
          backgroundColor: 'rgba(245, 230, 211, 0.1)',
          padding: S.space.sm,
          borderRadius: S.radius.sm,
          borderWidth: 1,
          width: '95%',
          alignSelf: 'center',
          borderColor: 'rgba(245, 230, 211, 0.2)',
        }}
      >
        {isSuccess ? error : `❌ ${error}`}
      </Body>
    </View>
  );
}