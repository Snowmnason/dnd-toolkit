import {
  AuthActionGroup,
  AuthBody,
  AuthBodyFooter,
  AuthButton, AuthButtonBack,
  AuthCaption, AuthError, AuthForm, AuthInput,
  AuthModal,
  AuthRoot,
  AuthSuccess,
  AuthTitle
} from '@/components/auth_components';
import { sendPasswordReset, validateEmail } from '@/lib';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

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
    <AuthRoot>
      {/* 🔙 Back Button*/}
      <View style={{ position: 'absolute', top: 50, left: 20, zIndex: 10 }}>
        <AuthButtonBack
          text="← Back"
          onPress={() => router.replace('/login/sign-in')}
          disabled={loading}
        />
      </View>

      {/* 🧠 Header*/}
      <AuthTitle>Forgot Password</AuthTitle>

      <AuthBody>Enter your email to receive password reset instructions.</AuthBody>

      {/* 🧾 Form*/}
      <AuthForm>
        <AuthInput
          placeholder="Email"
          value={email}
          onChangeText={handleEmailChange}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!loading}
          returnKeyType="go"
          onSubmitEditing={handleForgotPassword}
          style={{
            borderColor:
              !emailValidation.isValid && email.length > 0 ? '#dc3545' : undefined,
            borderWidth:
              !emailValidation.isValid && email.length > 0 ? 2 : undefined,
          }}
        />

        {/* Error Display */}
        <AuthError error={error} />

        {/* Success Display */}
        {success && <AuthSuccess message={successMessage} />}
      </AuthForm>

      {/* 🔘 Buttons*/}
      <AuthActionGroup>
        <AuthButton
          text="Send New Password Email"
          onPress={handleForgotPassword}
          disabled={!isFormValid}
          loading={loading}
        />

        <AuthBody
          align="center"
          color="#D4AF37"
          deco="underline"
          onPress={() => router.replace('/login/sign-in')}
        >
          ← Back to Sign In
        </AuthBody>
      </AuthActionGroup>

      {/* 🧩 Footer*/}
      <AuthBodyFooter>
        Secure authentication powered by Supabase
      </AuthBodyFooter>

      <AuthCaption>
        © 2025 The Snow Post · Forged for storytellers & adventurers
      </AuthCaption>

      {/* 📬 Email Not Found Modal */}
      <AuthModal
        visible={showEmailNotFoundModal}
        onClose={() => setShowEmailNotFoundModal(false)}
        title="No Account Found 🤔"
        message={`We couldn't find an account with ${email}. Would you like to create a new account instead?`}
        buttons={[
          {
            text: 'Cancel',
            onPress: () => setShowEmailNotFoundModal(false),
            variant: 'cancel',
          },
          {
            text: 'Create Account',
            onPress: () => {
              setShowEmailNotFoundModal(false)
              router.push('/login/sign-up')
            },
            variant: 'primary',
          },
        ]}
      />
    </AuthRoot>
  )
}