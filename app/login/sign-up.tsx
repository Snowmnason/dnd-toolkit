import {
  AuthActionGroup, AuthBackButtonContainer,
  AuthBodyFooter,
  AuthButton, AuthButtonBack,
  AuthButtonSecondary, AuthCaption, AuthError, AuthForm,
  AuthModal,
  AuthRoot, AuthSubTitle, AuthTitle,
  FormAuthInput
} from '@/components/auth_components';
import { AppToast } from '@/components/ui';
import { useSignUpForm } from '@/lib';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { TextInput } from 'react-native';

export default function SignUpScreen() {
  const router = useRouter();
  const [showValidationToast, setShowValidationToast] = useState(false);
  
  // Refs for keyboard navigation
  const passwordInputRef = useRef<TextInput>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);
  const {
    control,
    isValid,
    email,
    confirmPassword,
    loading,
    authError,
    validationWarning,
    showPassword,
    showEmailExistsModal,
    passwordsMatch,
    handleSignUp,
    setShowPassword,
    setShowEmailExistsModal,
    getPasswordMatchText,
  } = useSignUpForm();

  // Show toast when validation warning occurs
  useEffect(() => {
    if (validationWarning) {
      setShowValidationToast(true);
    }
  }, [validationWarning]);

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

      <AuthSubTitle>
        Join the adventure and sync your worlds across devices
      </AuthSubTitle>

      {/* Form Inputs */}
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
          ref={passwordInputRef}
          placeholder="Password"
          secureTextEntry={true}
          editable={!loading}
          showPasswordToggle={true}
          onTogglePassword={() => setShowPassword(!showPassword)}
          showPassword={showPassword}
          returnKeyType="next"
          onSubmitEditing={() => confirmPasswordInputRef.current?.focus()}
        />

        <FormAuthInput
          control={control}
          name="confirmPassword"
          ref={confirmPasswordInputRef}
          placeholder="Confirm Password"
          secureTextEntry={true}
          showPassword={showPassword}
          editable={!loading}
          returnKeyType="go"
          onSubmitEditing={handleSignUp}
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
          disabled={!isValid}
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