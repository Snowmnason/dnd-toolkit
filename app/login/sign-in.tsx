import {
  AuthActionGroup, AuthBackButtonContainer,
  AuthBodyFooter,
  AuthButton, AuthButtonBack,
  AuthButtonSecondary, AuthCaption, AuthError, AuthForm, AuthRoot, AuthSubTitle, AuthTitle,
  FormAuthInput
} from '@/components/auth_components';
import { logger, supabase, useSignInForm } from '@/lib';
import { useScale } from '@/theme';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { TextInput } from 'react-native';

export default function SignInScreen() {
  const S = useScale();
  const router = useRouter();
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  
  // Refs for keyboard navigation
  const passwordInputRef = useRef<TextInput>(null);
  
  const {
    // Form
    control,
    isValid,
    email,
    
    // State
    loading,
    authError,
    showPassword,
    
    // Handlers
    handleSignIn,
    setShowPassword,
  } = useSignInForm();

  const handleResendConfirmationFromError = async (email: string) => {
    setIsResendingEmail(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email
      });
      
      if (error) {
        // Note: This would need to be handled differently since authError is managed by the hook
        logger.error('sign-in', 'Failed to resend email:', error.message);
      } else {
        logger.info('sign-in', 'Confirmation email sent!');
      }
    } catch {
      logger.error('sign-in', 'Failed to resend confirmation email.');
    } finally {
      setIsResendingEmail(false);
    }
  };

  return (
    <AuthRoot>
      {/* 🧭 Back Button*/}
      <AuthBackButtonContainer>
        <AuthButtonBack
          text="← Back"
          onPress={() => router.replace('/login/welcome')}
          disabled={loading}
        />
      </AuthBackButtonContainer>

      {/* 🧙 Header */}
      <AuthTitle>Welcome Back</AuthTitle>

      <AuthSubTitle fontSize='$para'>Sign in to access your saved worlds and characters</AuthSubTitle>

      {/* 🧾 Form*/}
      <AuthForm>
        <FormAuthInput
          control={control}
          name="email"
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!loading}
          returnKeyType="next"
          onSubmitEditing={() => passwordInputRef.current?.focus()}
        />

        <FormAuthInput
          control={control}
          name="password"
          placeholder="Password"
          secureTextEntry={true}
          editable={!loading}
          showPasswordToggle={true}
          onTogglePassword={() => setShowPassword(!showPassword)}
          showPassword={showPassword}
          returnKeyType="go"
          onSubmitEditing={handleSignIn}
        />

        {/* Error Display (with resend option) */}
        <AuthError
          error={authError}
          onResendEmail={
            authError === 'RESEND_EMAIL'
              ? () => handleResendConfirmationFromError(email)
              : undefined
          }
          isResending={isResendingEmail}
        />

        {/* Forgot Password */}
        <AuthSubTitle
          color="#D4AF37"
          align="right"
          style={{ marginBottom: 4, marginTop: (S.space.sm*-1) }}
          onPress={() => router.push('/login/forgot-password')}
        >
          Forgot Password?
        </AuthSubTitle>
      </AuthForm>

      {/* 🔘 Buttons*/}
      <AuthActionGroup>
        <AuthButton
          text="Sign In"
          onPress={handleSignIn}
          disabled={!isValid}
          loading={loading}
        />

        <AuthButtonSecondary
          text="Need an account? Sign Up"
          onPress={() => router.push('/login/sign-up')}
          disabled={loading}
        />
      </AuthActionGroup>

      {/* 🧩 Footer */}
      <AuthBodyFooter>
        Secure authentication powered by Supabase
      </AuthBodyFooter>

      <AuthCaption>
        © 2025 The Snow Post · Forged for storytellers & adventurers
      </AuthCaption>
    </AuthRoot>
  )
}