import {
  AuthActionGroup, AuthBackButtonContainer,
  AuthBodyFooter,
  AuthButton, AuthButtonBack,
  AuthButtonSecondary, AuthCaption, AuthError, AuthForm, AuthRoot, AuthSubTitle, AuthTitle,
  FormAuthInput
} from '@/components/auth_components';
import { AppToast } from '@/components/ui';
import { AuthStateManager, buildRoute, logger, useSignInForm } from '@/lib';
// SUPABASE_AUTH: Direct auth operations — to be migrated to getAuthProvider() in Track D
import { supabase } from '@/lib/services/supabase/supabase-client';
import { useScale } from '@/theme';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { TextInput } from 'react-native';

export default function SignInScreen() {
  const S = useScale();
  const router = useRouter();
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  const [showValidationToast, setShowValidationToast] = useState(false);
  
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
    validationWarning,
    showPassword,
    
    // Handlers
    handleSignIn,
    setShowPassword,
  } = useSignInForm();

  // Heavy-duty auth check: verify with Supabase and ensure all data exists
  useEffect(() => {
    const verifyAuthStatus = async () => {
      try {
        logger.debug('auth', 'Sign-in screen: Performing heavy-duty auth verification');
        
        // Check 1: Local storage has account flag
        const authState = await AuthStateManager.getAuthState();
        if (!authState.hasAccount) {
          logger.debug('auth', 'Sign-in screen: No account flag in storage, showing login form');
          return;
        }
        
        // Check 2: Verify with Supabase that session is still valid
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
          logger.warn('auth', 'Sign-in screen: Session invalid or expired', sessionError?.message);
          return;
        }
        
        // Check 3: Verify user data exists in storage
        const userData = await AuthStateManager.getUserData();
        if (!userData || !userData.id) {
          logger.warn('auth', 'Sign-in screen: User data missing from storage');
          return;
        }
        
        // All checks passed - user is authenticated
        logger.info('auth', 'Sign-in screen: All checks passed, redirecting to world selection');
        router.replace('/select/world-selection');
      } catch (error) {
        logger.error('auth', 'Sign-in screen: Error during verification:', error);
        // If verification fails, just show login form (no harm)
      }
    };

    verifyAuthStatus();
  }, [router]);

  const handleResendConfirmationFromError = async (email: string) => {
    setIsResendingEmail(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email
      });
      
      if (error) {
        // Note: This would need to be handled differently since authError is managed by the hook
        logger.error('auth', 'Failed to resend email:', error.message);
      } else {
        logger.info('auth', 'Confirmation email sent!');
      }
    } catch {
      logger.error('auth', 'Failed to resend confirmation email.');
    } finally {
      setIsResendingEmail(false);
    }
  };

  // Show toast when validation warning occurs
  useEffect(() => {
    if (validationWarning) {
      setShowValidationToast(true);
    }
  }, [validationWarning]);

  return (
    <AuthRoot>
      {/* 🧭 Back Button*/}
      <AuthBackButtonContainer>
        <AuthButtonBack
          text="← Back"
          onPress={() => router.replace(buildRoute('/') as Href)}
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
          autoCapitalize="none"
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
          onPress={() => router.push(buildRoute('/login/forgot-password') as Href)}
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
          onPress={() => router.push(buildRoute('/login/sign-up') as Href)}
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

      <AppToast
        message={validationWarning}
        type="warning"
        visible={showValidationToast}
        duration={4000}
        onHide={() => setShowValidationToast(false)}
      />
    </AuthRoot>
  )
}