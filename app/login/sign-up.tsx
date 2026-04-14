import {
  AuthActionGroup,
  AuthBackButtonContainer,
  AuthBodyFooter,
  AuthButton,
  AuthButtonBack,
  AuthButtonSecondary,
  AuthCaption,
  AuthError,
  AuthForm,
  AuthModal,
  AuthRoot,
  AuthSubTitle,
  AuthTitle,
  FormAuthInput,
} from "@/components/auth_components";
import { useNavigation } from "@/hooks/navigation";
import { useSignUpFlow } from "@/hooks/auth";
import { useRef } from "react";
import { TextInput } from "react-native";

export default function SignUpScreen() {
  const navigate = useNavigation();

  // Refs for keyboard navigation
  const passwordInputRef = useRef<TextInput>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);

  const { state, form, handlers } = useSignUpFlow();

  return (
    <AuthRoot>
      {/* Back Button */}
      <AuthBackButtonContainer>
        <AuthButtonBack
          text="← Back"
          onPress={() => navigate.replace("/")}
          disabled={state.loading}
        />
      </AuthBackButtonContainer>

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

      {/* Email Already Exists Modal */}
      <AuthModal
        visible={state.modal === 'email-exists'}
        onClose={handlers.dismissModal}
        title="Account Already Exists! 🤔"
        message={`An account with ${form.email} already exists. Would you like to sign in instead?`}
        buttons={[
          {
            text: "Cancel",
            onPress: handlers.dismissModal,
            variant: "cancel",
          },
          {
            text: "Sign In",
            onPress: () => {
              handlers.dismissModal();
              navigate.to("/login/sign-in");
            },
            variant: "primary",
          },
        ]}
      />
    </AuthRoot>
  );
}


