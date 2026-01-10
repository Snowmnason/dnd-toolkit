import {
  AuthActionGroup,
  AuthBody,
  AuthBodyFooter,
  AuthButton,
  AuthCaption, AuthError, AuthForm, AuthRoot, AuthSubTitle,
  AuthSuccess,
  AuthTitle,
  FormAuthInput,
} from '@/components/auth_components';
import { useResetPasswordConfirm } from '@/lib';
import { useScale } from '@/theme';
import { useRef } from 'react';
import { TextInput } from 'react-native';
import { getPasswordHintColor, getPasswordRequirementsText } from '@/lib/auth/validation';

export default function ResetPasswordScreen() {
  const S = useScale();
  // Refs for keyboard navigation
  const confirmPasswordInputRef = useRef<TextInput>(null);
  const {
    control,
    isValid,
    password,
    confirmPassword,
    loading,
    error,
    success,
    successMessage,
    showPassword,
    userEmail,
    doPasswordsMatch,
    fieldErrors,
    handleResetPassword,
    setShowPassword,
    goToSignIn,
  } = useResetPasswordConfirm();

  const getPasswordMatchText = () => {
    if (confirmPassword.length === 0) return '';
    return doPasswordsMatch ? '✓ Passwords match' : '✗ Passwords do not match';
  };

   return (
    <AuthRoot>
      {/* 🔐 Header */}
      <AuthTitle>Reset Password</AuthTitle>

      <AuthSubTitle>
        {userEmail
          ? `${userEmail} is ready to reset your password. Please enter a new password below.`
          : 'Please enter a new password below.'}
      </AuthSubTitle>

      {/* 🧾 Form */}
      <AuthForm>
        {/* Success Message */}
        {success && <AuthSuccess message={successMessage} />}

        {/* Password Input */}
        <FormAuthInput
          control={control}
          name="password"
          placeholder="Password"
          secureTextEntry={!showPassword}
          editable={!loading && !success}
          showPasswordToggle={true}
          onTogglePassword={() => setShowPassword(!showPassword)}
          showPassword={showPassword}
          returnKeyType="next"
          onSubmitEditing={() => confirmPasswordInputRef.current?.focus()}
        />

        {/* Password Requirements */}
        <AuthSubTitle
          color={getPasswordHintColor(password)}
          align="left"
          fontSize='$caption'
            style={{
              lineHeight: 16,
              marginBottom: S.space.xs,
              marginTop: (S.space.sm*-1),
              marginLeft: S.space.xs,
              opacity: 0.9,
            }}
        >
          {getPasswordRequirementsText(password)}
        </AuthSubTitle>

        {/* Confirm Password Input */}
        <FormAuthInput
          control={control}
          name="confirmPassword"
          ref={confirmPasswordInputRef}
          placeholder="Confirm Password"
          secureTextEntry={!showPassword}
          editable={!loading && !success}
          returnKeyType="go"
          onSubmitEditing={handleResetPassword}
        />

        {/* Password Match Indicator */}
        {confirmPassword.length > 0 && (
          <AuthSubTitle
            color={doPasswordsMatch ? '#A3D4A0' : '#F5A5A5'}
            align="left"
            fontSize={11}
            style={{
              lineHeight: 16,
              opacity: 0.9,
              marginBottom: 6,
              marginTop: -14,
            }}
          >
            {getPasswordMatchText()}
          </AuthSubTitle>
        )}

        {/* Authentication Error */}
        <AuthError error={error} />
      </AuthForm>

      {/* 🔘 Action Buttons */}
      <AuthActionGroup>
        {!success && (
          <AuthButton
            text="Reset Password"
            onPress={handleResetPassword}
            disabled={!isValid}
            loading={loading}
          />
        )}

        <AuthBody
          color="#D4AF37"
          align="center"
          deco="underline"
          style={{ marginTop: success ? 0 : 8 }}
          onPress={goToSignIn}
        >
          {success ? 'Continue to Sign In →' : '← Back to Sign In'}
        </AuthBody>
      </AuthActionGroup>

      {/* 🧩 Footer */}
      <AuthBodyFooter>
        {success
          ? 'Your password has been updated successfully!'
          : "After changing your password, you'll be returned to the sign-in page."}
      </AuthBodyFooter>

      <AuthCaption>
        © 2025 The Snow Post · Forged for storytellers & adventurers
      </AuthCaption>
    </AuthRoot>
  )
}