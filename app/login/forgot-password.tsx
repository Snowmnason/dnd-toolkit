import { AuthError, AuthInput, AuthSuccess } from '@/components/auth_components';
import { Body, BodyLogin, Button, Caption, Title } from '@/components/ui';
import { sendPasswordReset, validateEmail } from '@/lib';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import CustomModal from '../../components/modals/CustomModal';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  
  // Form state
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showEmailNotFoundModal, setShowEmailNotFoundModal] = useState(false);

  // Validation
  const emailValidation = validateEmail(email);
  const isFormValid = emailValidation.isValid && email.trim().length > 0;

  // Handle password reset
  const handleForgotPassword = async () => {
    setError('');
    setSuccess(false);
    
    // Client-side validation
    if (!emailValidation.isValid) {
      if (!email.trim()) {
        setError('Email is required');
      } else {
        setError('Please enter a valid email address');
      }
      return;
    }
    
    setLoading(true);
    
    try {
      const result = await sendPasswordReset(email);
      
      if (result.success && result.message) {
        setSuccess(true);
        setSuccessMessage(result.message);
      } else if (result.showEmailNotFoundModal) {
        setShowEmailNotFoundModal(true);
      } else if (result.error) {
        setError(result.error);
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle email change
  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (error) setError('');
    if (success) setSuccess(false);
  };


  return (
    <View style={{ flex: 1, backgroundColor: '#2f353d' }}>
      
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: 'transparent' }}>
        
        <Title>Forgot Password</Title>
        
        <BodyLogin opacity={0.8}>Enter your email to receive password reset instructions.</BodyLogin>

        {/* Form Inputs */}
        <View style={{ width: '100%', maxWidth: 300, marginBottom: 15, backgroundColor: 'transparent' }}>
          <AuthInput
            placeholder="Email"
            value={email}
            onChangeText={handleEmailChange}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!loading}
            style={{
              borderColor: !emailValidation.isValid && email.length > 0 ? '#dc3545' : undefined,
              borderWidth: !emailValidation.isValid && email.length > 0 ? 2 : undefined
            }}
          />
        </View>

        {/* Error Display */}
        <View style={{ width: '100%', maxWidth: 300 }}>
          <AuthError error={error} />
        </View>

        {/* Success Display */}
        {success && <AuthSuccess message={successMessage} />}

        {/* Action Buttons */}
        <View style={{ width: '100%', maxWidth: 300, gap: 16, backgroundColor: 'transparent' }}>
          {/* Reset Password Button */}
          <Button
            variant="auth"
            text="Send New Password Email"
            onPress={handleForgotPassword}
            disabled={!isFormValid} loading={loading}
          />
          
          {/* Back to Welcome Button */}
          <Body align='center' color='D4AF37' deco='underline' style={{ marginTop: 8 }} onPress={() => router.replace('/login/sign-in')} >
            ← Back to Sign In
          </Body>
        </View>

        <Body variant="semi" fontSize="$sm" color='#F5E6D3' align='center' opacity={0.6}
          style={{ marginTop: 30, lineHeight: 18, paddingHorizontal: 20 }}>
          Secure authentication powered by Supabase
        </Body>

        <Caption color='#F5E6D3' align='center' style={{ marginTop: 8, opacity: 0.5, lineHeight: 16, paddingHorizontal: 20 }}>
          © 2025 The Snow Post · Forged for storytellers & adventurers
        </Caption>
      </View>

      {/* Email Not Found Modal */}
      <CustomModal
        visible={showEmailNotFoundModal}
        onClose={() => setShowEmailNotFoundModal(false)}
        title="No Account Found 🤔"
        message={`We couldn't find an account with ${email}. Would you like to create a new account instead?`}
        buttons={[
          {
            text: 'Cancel',
            onPress: () => setShowEmailNotFoundModal(false),
            style: 'cancel'
          },
          {
            text: 'Create Account',
            onPress: () => {
              setShowEmailNotFoundModal(false);
              router.push('/login/sign-up');
            },
            style: 'primary'
          }
        ]}
      />
    </View>
  );
}