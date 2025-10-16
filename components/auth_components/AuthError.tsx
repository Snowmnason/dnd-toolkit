import { View } from 'react-native';
import { Button, Text } from 'tamagui';

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
        <View style={{ 
          backgroundColor: 'rgba(245, 230, 211, 0.1)',
          padding: 12,
          borderRadius: 4,
          borderWidth: 1,
          borderColor: 'rgba(245, 230, 211, 0.2)'
        }}>
          <Text 
            style={{ 
              textAlign: 'center', 
              fontSize: 12, 
              color: '#F5E6D3', 
              fontWeight: '500', 
              lineHeight: 16,
              opacity: 0.9,
              marginBottom: 8
            }}
          >
            ❌ Please check your email and click the confirmation link before signing in.
          </Text>
          
          <Button
            //variant="primary"
            //size="sm"
            onPress={onResendEmail}
            disabled={isResending}
          >
            {isResending ? '📧 Sending...' : '📧 Resend Email'}
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View style={{ marginBottom: 8 }}>
      <Text 
        style={{ 
          textAlign: 'center', 
          fontSize: 12, 
          color: isSuccess ? '#A3D4A0' : '#F5E6D3', 
          fontWeight: '500', 
          lineHeight: 16,
          opacity: 0.9,
          backgroundColor: 'rgba(245, 230, 211, 0.1)',
          padding: 8,
          borderRadius: 4,
          borderWidth: 1,
          borderColor: 'rgba(245, 230, 211, 0.2)'
        }}
      >
        {isSuccess ? error : `❌ ${error}`}
      </Text>
    </View>
  );
}