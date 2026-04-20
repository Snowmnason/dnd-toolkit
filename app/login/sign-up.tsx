import {
  AuthActionGroup,
  AuthBodyFooter,
  AuthButton,
  AuthButtonSecondary,
  AuthCaption,
  AuthError,
  AuthForm,
  AuthRoot,
  AuthSubTitle,
  AuthTitle,
  FormAuthInput,
} from "@/components/auth_components";
import { useModal } from "@/contexts";
import { useSignUpFlow } from "@/hooks/auth";
import { useNavigation } from "@/hooks/navigation";
import { useEffect, useRef } from "react";
import { TextInput } from "react-native";

export default function SignUpScreen() {
  const navigate = useNavigation();
  const { openModal, closeModal } = useModal();

  // Refs for keyboard navigation
  const passwordInputRef = useRef<TextInput>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);

  const { state, form, handlers } = useSignUpFlow();

  // Manage email-exists modal via context
  useEffect(() => {
    if (state.modal === 'email-exists') {
      openModal('login-message', {
        heading: 'Account Already Exists! 🤔',
        message: `An account with ${form.email} already exists. Would you like to sign in instead?`,
        buttons: [
          {
            text: 'Cancel',
            onPress: () => {
              closeModal();
              handlers.dismissModal();
            },
            variant: 'cancel' as const,
          },
          {
            text: 'Sign In',
            onPress: () => {
              closeModal();
              handlers.dismissModal();
              navigate.to('/login/sign-in');
            },
            variant: 'primary' as const,
          },
        ],
      });
    } else if (state.modal === null) {
      closeModal();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.modal, form.email, openModal, closeModal, handlers]);

  return (
    <AuthRoot>
      {/* Header */}
      <AuthTitle>Create Account</AuthTitle>

      <AuthSubTitle>
        Join the adventure and sync your worlds across devices
      </AuthSubTitle>

      {/* Form Inputs */}
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
          ref={passwordInputRef}
          placeholder="Password"
          secureTextEntry={true}
          autoCapitalize="none"
          editable={!state.loading}
          showPasswordToggle={true}
          onTogglePassword={() => form.setShowPassword(!form.showPassword)}
          showPassword={form.showPassword}
          returnKeyType="next"
          onSubmitEditing={() => confirmPasswordInputRef.current?.focus()}
        />

        <FormAuthInput
          control={form.control}
          name="confirmPassword"
          ref={confirmPasswordInputRef}
          placeholder="Confirm Password"
          secureTextEntry={true}
          autoCapitalize="none"
          showPassword={form.showPassword}
          editable={!state.loading}
          returnKeyType="go"
          onSubmitEditing={form.handleSubmit}
        />

        {/* Authentication Error Display */}
        {state.error && <AuthError error={state.error} />}
      </AuthForm>

      {/* Action Buttons */}
      <AuthActionGroup>
        <AuthButton
          text="Create Account"
          onPress={form.handleSubmit}
          disabled={!form.isValid}
          loading={state.loading}
        />

        <AuthButtonSecondary
          text="Already have an account? Sign In"
          onPress={() => navigate.to("/login/sign-in")}
          disabled={state.loading}
        />
      </AuthActionGroup>

      {/* Info / Footer */}
      <AuthBodyFooter>
        After confirming your email, you&apos;ll choose a username to complete your
        account setup.
      </AuthBodyFooter>

      <AuthCaption>
        © 2025 The Snow Post · Forged for storytellers & adventurers
      </AuthCaption>
    </AuthRoot>
  );
}


