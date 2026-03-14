import {
  AuthActionGroup, AuthBackButtonContainer,
  AuthBodyFooter,
  AuthButton, AuthButtonBack,
  AuthButtonSecondary, AuthCaption, AuthError, AuthForm, AuthRoot, AuthSubTitle, AuthTitle,
  FormAuthInput
} from '@/components/auth_components';
import { useAuthActions, useAuthFlow } from "@/hooks/auth";
import { AuthStateManager, getCurrentSession } from "@/lib/auth";
import { useNavigate } from "@/hooks/navigation";
import { logger } from "@/hooks/utils";
import { useScale } from '@/theme';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { TextInput } from 'react-native';

export default function SignInScreen() {
  const S = useScale();
  const router = useRouter();
  const { replace, push } = useNavigate();
  const { resendConfirmation } = useAuthActions();
  const [isResendingEmail, setIsResendingEmail] = useState(false);

  // Refs for keyboard navigation
  const passwordInputRef = useRef<TextInput>(null);

  const { state, form } = useAuthFlow();

  // Heavy-duty auth check: verify with Supabase and ensure all data exists
  // Use a callback instead of useEffect to avoid running on every render
  const verifyAuthStatus = async () => {
    try {
      logger.category('auth').debug('Sign-in screen: Performing heavy-duty auth verification');
      
      // Check 1: Local storage has account flag
      const authState = await AuthStateManager.getAuthState();
      if (!authState.hasAccount) {
        logger.category('auth').debug('Sign-in screen: No account flag in storage, showing login form');
        return;
      }
      
      // Check 2: Verify session is still valid using convenience function
      const session = await getCurrentSession();
      if (!session) {
        logger.category('auth').warn('Sign-in screen: Session invalid or expired');
        return;
      }
      
      // Check 3: Verify user data exists in storage
      const userData = await AuthStateManager.getUserData();
      if (!userData || !userData.id) {
        logger.category('auth').warn('Sign-in screen: User data missing from storage');
        return;
      }
      
      // All checks passed - user is authenticated
      logger.category('auth').info('Sign-in screen: All checks passed, redirecting to world selection');
      router.replace('/select/world-selection');
    } catch (error) {
      logger.category('auth').error('Sign-in screen: Error during verification:', error);
      // If verification fails, just show login form (no harm)
    }
  };

  // Run verification once on mount using a ref to prevent double-run in development
  const verifyRef = useRef(false);
  if (!verifyRef.current) {
    verifyRef.current = true;
    verifyAuthStatus();
  }

  const handleResendConfirmationFromError = async (email: string) => {
    setIsResendingEmail(true);
    try {
      const result = await resendConfirmation(email);
      
      if (!result.success) {
        logger.category('auth').error('Failed to resend email:', result.error);
      } else {
        logger.category('auth').info('Confirmation email sent!');
      }
    } catch (err) {
      logger.category('auth').error('Failed to resend confirmation email.', err);
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
          onPress={() => replace('/')}
          disabled={state.loading}
        />
      </AuthBackButtonContainer>

      {/* 🧙 Header */}
      <AuthTitle>Welcome Back</AuthTitle>

      <AuthSubTitle fontSize='$para'>Sign in to access your saved worlds and characters</AuthSubTitle>

      {/* 🧾 Form*/}
      <AuthForm>
        <FormAuthInput
          control={form.control}
          name="email"
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!state.loading}
          returnKeyType="next"
          onSubmitEditing={() => passwordInputRef.current?.focus()}
        />

        <FormAuthInput
          control={form.control}
          name="password"
          placeholder="Password"
          secureTextEntry={true}
          autoCapitalize="none"
          editable={!state.loading}
          showPasswordToggle={true}
          onTogglePassword={() => form.setShowPassword(!form.showPassword)}
          showPassword={form.showPassword}
          returnKeyType="go"
          onSubmitEditing={form.handleSubmit}
        />

        {/* Error Display (with resend option) */}
        {state.error && (
          <AuthError
            error={state.error}
            onResendEmail={
              state.error === 'RESEND_EMAIL'
                ? () => handleResendConfirmationFromError(form.email)
                : undefined
            }
            isResending={isResendingEmail}
          />
        )}

        {/* Forgot Password */}
        <AuthSubTitle
          color="#D4AF37"
          align="right"
          style={{ marginBottom: 4, marginTop: (S.space.sm*-1) }}
          onPress={() => push('/login/forgot-password')}
        >
          Forgot Password?
        </AuthSubTitle>
      </AuthForm>

      {/* 🔘 Buttons*/}
      <AuthActionGroup>
        <AuthButton
          text="Sign In"
          onPress={form.handleSubmit}
          disabled={!form.isValid}
          loading={state.loading}
        />

        <AuthButtonSecondary
          text="Need an account? Sign Up"
          onPress={() => replace('/login/sign-up')}
          disabled={state.loading}
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