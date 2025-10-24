import {
  AuthActionGroup, AuthBackButtonContainer, AuthBody,
  AuthBodyFooter,
  AuthButton, AuthButtonBack,
  AuthButtonSecondary, AuthCaption, AuthError, AuthForm, AuthInput,
  AuthModal,
  AuthRoot, AuthSubTitle, AuthTitle
} from '@/components/auth_components';
import { useSignUpForm } from '@/lib';
import { useRouter } from 'expo-router';
import { useRef } from 'react';
import { TextInput } from 'react-native';

export default function SignUpScreen() {
  const router = useRouter();
  
  // Refs for keyboard navigation
  const passwordInputRef = useRef<TextInput>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);
  const {
    // Form data
    email,
    password,
    confirmPassword,
    loading,
    authError,
    showPassword,
    showEmailExistsModal,
    
    // Validation state
    passwordValidation,
    emailValidation,
    passwordsMatch,
    isFormValid,
    
    // Handlers
    handleSignUp,
    handleEmailChange,
    handlePasswordChange,
    handleConfirmPasswordChange,
    setShowPassword,
    setShowEmailExistsModal,
    
    // UI helpers
    getPasswordHintColor,
    getPasswordRequirementsText,
    getPasswordMatchText,
  } = useSignUpForm();

  return (
    <AuthRoot>
      {/* Back Button */}
      <AuthBackButtonContainer>
        <AuthButtonBack
          text="← Back"
          onPress={() => router.replace('/login/welcome')}
          disabled={loading}
        />
      </AuthBackButtonContainer>

      {/* Header */}
      <AuthTitle>Create Account</AuthTitle>

      <AuthBody>
        Join the adventure and sync your worlds across devices
      </AuthBody>

      {/* Form Inputs */}
      <AuthForm>
        <AuthInput
          placeholder="Email"
          value={email}
          onChangeText={handleEmailChange}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!loading}
          returnKeyType="next"
          onSubmitEditing={() => passwordInputRef.current?.focus()}
          style={{
            borderColor:
              !emailValidation.isValid && email.length > 0
                ? '#dc3545'
                : undefined,
            borderWidth:
              !emailValidation.isValid && email.length > 0 ? 2 : undefined,
          }}
        />

        <AuthInput
          ref={passwordInputRef}
          placeholder="Password"
          value={password}
          onChangeText={handlePasswordChange}
          secureTextEntry={true}
          editable={!loading}
          showPasswordToggle={true}
          onTogglePassword={() => setShowPassword(!showPassword)}
          showPassword={showPassword}
          returnKeyType="next"
          onSubmitEditing={() => confirmPasswordInputRef.current?.focus()}
          style={{
            borderColor:
              !passwordValidation.isValid && password.length > 0
                ? '#dc3545'
                : undefined,
            borderWidth:
              !passwordValidation.isValid && password.length > 0 ? 2 : undefined,
          }}
        />

        {/* Password Requirements */}
        <AuthSubTitle
          color={getPasswordHintColor()}
          align="left"
          fontSize={11}
          style={{
            lineHeight: 16,
            marginBottom: 6,
            marginTop: -14,
            opacity: 0.9,
          }}
        >
          {getPasswordRequirementsText()}
        </AuthSubTitle>

        <AuthInput
          ref={confirmPasswordInputRef}
          placeholder="Confirm Password"
          value={confirmPassword}
          onChangeText={handleConfirmPasswordChange}
          secureTextEntry={true}
          showPassword={showPassword}
          editable={!loading}
          returnKeyType="go"
          onSubmitEditing={handleSignUp}
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
            color={passwordsMatch ? '#A3D4A0' : '#F5A5A5'}
            align="left"
            fontSize={11}
            style={{ lineHeight: 16, opacity: 0.9, marginBottom: 6, marginTop: -14 }}
          >
            {getPasswordMatchText()}
          </AuthSubTitle>
        )}

        {/* Authentication Error Display */}
        <AuthError error={authError} />
      </AuthForm>

      {/* Action Buttons */}
      <AuthActionGroup>
        <AuthButton
          text="Create Account"
          onPress={handleSignUp}
          disabled={!isFormValid}
          loading={loading}
        />

        <AuthButtonSecondary
          text="Already have an account? Sign In"
          onPress={() => router.push('/login/sign-in')}
          disabled={loading}
        />
      </AuthActionGroup>

      {/* Info / Footer */}
      <AuthBodyFooter>
        After confirming your email, you’ll choose a username to complete your account setup.
      </AuthBodyFooter>

      <AuthCaption>
        © 2025 The Snow Post · Forged for storytellers & adventurers
      </AuthCaption>

      {/* Email Already Exists Modal */}
      <AuthModal
        visible={showEmailExistsModal}
        onClose={() => setShowEmailExistsModal(false)}
        title="Account Already Exists! 🤔"
        message={`An account with ${email} already exists. Would you like to sign in instead?`}
        buttons={[
          {
            text: 'Cancel',
            onPress: () => setShowEmailExistsModal(false),
            variant: 'cancel',
          },
          {
            text: 'Sign In',
            onPress: () => {
              setShowEmailExistsModal(false)
              router.push('/login/sign-in')
            },
            variant: 'primary',
          },
        ]}
      />
    </AuthRoot>
  )
}