import { View } from 'react-native';
import PrimaryButton from '../custom_components/PrimaryButton';
import { ThemedText } from '../themed-text';

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
          <ThemedText 
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
          </ThemedText>
          
          <PrimaryButton
            style={{ 
              backgroundColor: '#D4AF37', 
              paddingVertical: 8, 
              paddingHorizontal: 12, 
              borderRadius: 4,
              alignSelf: 'center'
            }}
            textStyle={{ color: '#2f353d', fontSize: 11, fontWeight: '600' }}
            onPress={onResendEmail}
            disabled={isResending}
          >
            {isResending ? '📧 Sending...' : '📧 Resend Email'}
          </PrimaryButton>
        </View>
      </View>
    );
  }

  return (
    <View style={{ marginBottom: 8 }}>
      <ThemedText 
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
      </ThemedText>
    </View>
  );
}