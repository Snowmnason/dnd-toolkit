import {
  AuthActionGroup,
  AuthBodyFooter,
  AuthButton,
  AuthButtonSecondary, AuthCaption, AuthError, AuthForm, AuthRoot, AuthSubTitle, AuthTitle,
  FormAuthInput
} from '@/components/auth_components';
import { useAuthActions, useAuthFlow } from "@/hooks/auth";
import { useNavigation } from '@/hooks/navigation';
import { logger } from "@/hooks/utils";
import { useScale } from '@/theme';
import { useRef, useState } from 'react';
import { TextInput } from 'react-native';

export default function SignInScreen() {
  const S = useScale();
  const navigate = useNavigation();
  const { resendConfirmation } = useAuthActions();
  const [isResendingEmail, setIsResendingEmail] = useState(false);

  // Refs for keyboard navigation
  const passwordInputRef = useRef<TextInput>(null);

  const { state, form } = useAuthFlow();

  // Auth redirect for authenticated users is handled by useBootstrapRouteGuard
  // in the root layout. No screen-level redirect needed here — doing so caused
  // infinite loops on web (replace → remount → re-detect auth → replace again).

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
      {/*  Header */}
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
          onPress={() => navigate.to('/login/forgot-password')}
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
          onPress={() => navigate.replace('/login/sign-up')}
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