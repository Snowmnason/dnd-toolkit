import {
  AuthActionGroup,
  AuthBody,
  AuthBodyFooter,
  AuthButton,
  AuthCaption, AuthError, AuthForm, AuthInput, AuthRoot, AuthSubTitle,
  AuthSuccess,
  AuthTitle
} from '@/components/auth_components';
import { useResetPasswordConfirm } from '@/lib';
import { useRef } from 'react';
import { TextInput } from 'react-native';

export default function ResetPasswordScreen() {
  // Refs for keyboard navigation
  const confirmPasswordInputRef = useRef<TextInput>(null);
  const {
    // Form data
    password,
    confirmPassword,
    loading,
    error,
    success,
    successMessage,
    showPassword,
    userEmail,
    
    // Validation state
    isPasswordValid,
    doPasswordsMatch,
    isFormValid,
    
    // Handlers
    handleResetPassword,
    handlePasswordChange,
    handleConfirmPasswordChange,
    setShowPassword,
    goToSignIn,
  } = useResetPasswordConfirm();

  // Helper functions for UI state
  const getPasswordHintColor = () => {
    if (password.length === 0) return '#A3D4A0';
    return isPasswordValid ? '#A3D4A0' : '#F5A5A5';
  };

  const getPasswordRequirementsText = () => {
    if (password.length === 0) return 'Password must be at least 6 characters';
    return isPasswordValid ? '✓ Password meets requirements' : '✗ Password must be at least 6 characters';
  };

  const getPasswordMatchText = () => {
    return doPasswordsMatch ? '✓ Passwords match' : '✗ Passwords do not match';
  };

   return (
    <AuthRoot>
      {/* 🔐 Header */}
      <AuthTitle>Reset Password</AuthTitle>

      <AuthBody>
        {userEmail
          ? `${userEmail} is ready to reset your password. Please enter a new password below.`
          : 'Please enter a new password below.'}
      </AuthBody>

      {/* 🧾 Form */}
      <AuthForm>
        {/* Success Message */}
        {success && <AuthSuccess message={successMessage} />}

        {/* Password Input */}
        <AuthInput
          placeholder="Password"
          value={password}
          onChangeText={handlePasswordChange}
          secureTextEntry={!showPassword}
          editable={!loading && !success}
          showPasswordToggle={true}
          onTogglePassword={() => setShowPassword(!showPassword)}
          showPassword={showPassword}
          returnKeyType="next"
          onSubmitEditing={() => confirmPasswordInputRef.current?.focus()}
          style={{
            borderColor:
              !isPasswordValid && password.length > 0 ? '#dc3545' : undefined,
            borderWidth:
              !isPasswordValid && password.length > 0 ? 2 : undefined,
          }}
        />

        {/* Password Requirements */}
        <AuthSubTitle
          color={getPasswordHintColor()}
          align="left"
          fontSize={11}
          style={{
            lineHeight: 16,
            opacity: 0.9,
            marginBottom: 6,
            marginTop: -14,
          }}
        >
          {getPasswordRequirementsText()}
        </AuthSubTitle>

        {/* Confirm Password Input */}
        <AuthInput
          ref={confirmPasswordInputRef}
          placeholder="Confirm Password"
          value={confirmPassword}
          onChangeText={handleConfirmPasswordChange}
          secureTextEntry={!showPassword}
          editable={!loading && !success}
          returnKeyType="go"
          onSubmitEditing={handleResetPassword}
          style={{
            borderColor:
              confirmPassword.length > 0 && password !== confirmPassword
                ? '#dc3545'
                : undefined,
            borderWidth:
              confirmPassword.length > 0 && password !== confirmPassword
                ? 2
                : undefined,
          }}
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
            disabled={!isFormValid}
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