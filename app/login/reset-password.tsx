import {
  AuthActionGroup,
  AuthBody,
  AuthBodyFooter,
  AuthButton,
  AuthCaption,
  AuthError,
  AuthForm,
  AuthRoot,
  AuthSubTitle,
  AuthSuccess,
  AuthTitle,
  FormAuthInput,
} from "@/components/auth_components";
import { usePasswordResetFlow } from "@/hooks/auth";
import { useScale } from "@/theme";
import { getPasswordRequirementsForUI } from "@/validation/auth.schema";
import { useRef } from "react";
import { TextInput } from "react-native";

export default function ResetPasswordScreen() {
  const S = useScale();
  // Refs for keyboard navigation
  const confirmPasswordInputRef = useRef<TextInput>(null);

  const { state, form, handlers } = usePasswordResetFlow();

  const isSuccess = state.phase === 'success';
  const isLoading = state.phase === 'loading';

  return (
    <AuthRoot>
      {/* 🔐 Header */}
      <AuthTitle>Reset Password</AuthTitle>

      <AuthSubTitle>
        {state.userEmail
          ? `${state.userEmail} is ready to reset your password. Please enter a new password below.`
          : isLoading
            ? "Verifying reset link..."
            : "Please enter a new password below."}
      </AuthSubTitle>

      {/* 🧾 Form */}
      <AuthForm>
        {/* Success Message */}
        {isSuccess && state.successMessage && <AuthSuccess message={state.successMessage} />}

        {/* Password Input */}
        <FormAuthInput
          control={form.control}
          name="password"
          placeholder="Password"
          secureTextEntry={!form.showPassword}
          autoCapitalize="none"
          editable={!state.loading && !isSuccess}
          showPasswordToggle={true}
          onTogglePassword={() => form.setShowPassword(!form.showPassword)}
          showPassword={form.showPassword}
          returnKeyType="next"
          onSubmitEditing={() => confirmPasswordInputRef.current?.focus()}
        />

        {/* Password Requirements */}
        <AuthSubTitle
          align="left"
          fontSize="$caption"
          style={{
            lineHeight: 16,
            marginBottom: S.space.xs,
            marginTop: S.space.sm * -1,
            marginLeft: S.space.xs,
            opacity: 0.9,
          }}
        >
          {getPasswordRequirementsForUI(form.password)}
        </AuthSubTitle>

        {/* Confirm Password Input */}
        <FormAuthInput
          control={form.control}
          name="confirmPassword"
          ref={confirmPasswordInputRef}
          placeholder="Confirm Password"
          secureTextEntry={!form.showPassword}
          editable={!state.loading && !isSuccess}
          autoCapitalize="none"
          returnKeyType="go"
          onSubmitEditing={form.handleSubmit}
        />

        {/* Authentication Error */}
        {state.error && <AuthError error={state.error} />}
      </AuthForm>

      {/* 🔘 Action Buttons */}
      <AuthActionGroup>
        {!isSuccess && (
          <AuthButton
            text="Reset Password"
            onPress={form.handleSubmit}
            disabled={!form.isValid || isLoading}
            loading={state.loading}
          />
        )}

        <AuthBody
          color="#D4AF37"
          align="center"
          deco="underline"
          style={{ marginTop: isSuccess ? 0 : 8 }}
          onPress={handlers.goToSignIn}
        >
          {isSuccess ? "Continue to Sign In →" : "← Back to Sign In"}
        </AuthBody>
      </AuthActionGroup>

      {/* 🧩 Footer */}
      <AuthBodyFooter>
        {isSuccess
          ? "Your password has been updated successfully!"
          : "After changing your password, you'll be returned to the sign-in page."}
      </AuthBodyFooter>

      <AuthCaption>
        © 2025 The Snow Post · Forged for storytellers & adventurers
      </AuthCaption>
    </AuthRoot>
  );
}

