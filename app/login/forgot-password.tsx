import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'tamagui';
import AuthButton from '../../components/auth_components/AuthButton';
import AuthInput from '../../components/auth_components/AuthInput';
import CustomModal from '../../components/modals/CustomModal';
import { sendPasswordReset } from '../../lib/auth/authService';
import { validateEmail } from '../../lib/auth/validation';

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
        
        <Text 
          style={{ marginBottom: 20, textAlign: 'center', color: '#F5E6D3', fontSize: 32, fontWeight: '700' }}
        >
          Forgot Password
        </Text>
        
        <Text style={{ marginBottom: 40, textAlign: 'center', fontSize: 16, opacity: 0.8, color: '#F5E6D3', lineHeight: 22, paddingHorizontal: 20 }}>
          Enter your email to receive password reset instructions.
        </Text>

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
        {error && (
          <View style={{ 
            width: '100%', 
            maxWidth: 300, 
            backgroundColor: 'rgba(220, 53, 69, 0.1)', 
            borderColor: '#dc3545', 
            borderWidth: 1, 
            borderRadius: 8, 
            padding: 12, 
            marginBottom: 16 
          }}>
            <Text style={{ 
              color: '#dc3545', 
              fontSize: 14, 
              textAlign: 'center',
              fontWeight: '500'
            }}>
              {error}
            </Text>
          </View>
        )}

        {/* Success Display */}
        {success && (
          <View style={{ 
            width: '100%', 
            maxWidth: 300, 
            backgroundColor: 'rgba(40, 167, 69, 0.1)', 
            borderColor: '#28a745', 
            borderWidth: 1, 
            borderRadius: 8, 
            padding: 12, 
            marginBottom: 16 
          }}>
            <Text style={{ 
              color: '#28a745', 
              fontSize: 14, 
              textAlign: 'center',
              fontWeight: '500'
            }}>
              {successMessage}
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={{ width: '100%', maxWidth: 300, gap: 16, backgroundColor: 'transparent' }}>
          {/* Reset Password Button */}
          <AuthButton
            title="Send New Password Email"
            onPress={handleForgotPassword}
            disabled={!isFormValid}
            loading={loading}
          />
          
          {/* Back to Welcome Button */}
          <Text
            style={{ 
              textAlign: 'center', 
              fontSize: 14, 
              color: '#D4AF37', 
              fontWeight: '500',
              marginTop: 8,
              textDecorationLine: 'underline'
            }}
            onPress={() => router.replace('/login/sign-in')}
          >
            ← Back to Sign In
          </Text>
        </View>

        <Text style={{ marginTop: 30, textAlign: 'center', fontSize: 12, opacity: 0.6, color: '#F5E6D3', lineHeight: 18, paddingHorizontal: 20 }}>
          Secure authentication powered by Supabase
        </Text>
        
        <Text style={{ marginTop: 8, textAlign: 'center', fontSize: 11, opacity: 0.5, color: '#F5E6D3', lineHeight: 16, paddingHorizontal: 20 }}>
          © 2025 The Snow Post · Forged for storytellers & adventurers
        </Text>
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