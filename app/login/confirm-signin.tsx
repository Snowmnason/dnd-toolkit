import {
  AuthActionGroup,
  AuthBackButtonContainer,
  AuthBody,
  AuthBodyFooter,
  AuthButton, AuthButtonBack,
  AuthCaption,
  AuthError,
  AuthForm,
  AuthInput,
  AuthRoot,
  AuthSubTitle,
  AuthTitle
} from '@/components/auth_components';
import { useSignInForm } from '@/lib';
import { useScale } from '@/theme';
import { useRouter } from 'expo-router';

export default function SignInScreen() {
  const S = useScale();
  const router = useRouter();
  
  const {
    // Form data
    email,
    password,
    loading,
    authError,
    showPassword,
    
    // Validation state
    emailValidation,
    isFormValid,
    
    // Handlers
    handleSignIn,
    handleEmailChange,
    handlePasswordChange,
    setShowPassword,
  } = useSignInForm();

  return (
    <AuthRoot>
      {/* 🔙 Back Button */}
      <AuthBackButtonContainer>
        <AuthButtonBack
          text="← Back"
          onPress={() => router.replace('/login/welcome')}
          disabled={loading}
        />
      </AuthBackButtonContainer>

      {/* 🧠 Header */}
      <AuthTitle>Welcome Back</AuthTitle>

      <AuthSubTitle>
        Continue the sign-in process to confirm your account and adventures.
      </AuthSubTitle>

      {/* 🧾 Form Inputs */}
      <AuthForm style={{ marginBottom: authError ? S.space.md : S.space.xxl }}>
        <AuthInput
          placeholder="Email"
          value={email}
          onChangeText={handleEmailChange}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!loading}
          style={{
            borderColor:
              !emailValidation.isValid && email.length > 0 ? '#dc3545' : undefined,
            borderWidth:
              !emailValidation.isValid && email.length > 0 ? 2 : undefined,
          }}
        />

        <AuthInput
          placeholder="Password"
          value={password}
          onChangeText={handlePasswordChange}
          secureTextEntry={true}
          editable={!loading}
          showPasswordToggle={true}
          onTogglePassword={() => setShowPassword(!showPassword)}
          showPassword={showPassword}
          style={{
            borderColor:
              !password.trim() && password.length > 0 ? '#dc3545' : undefined,
            borderWidth:
              !password.trim() && password.length > 0 ? 2 : undefined,
          }}
        />

        {/* Forgot Password Link */}
        <AuthSubTitle
          color="#D4AF37"
          cursor="pointer"
          align="right"
          style={{ marginBottom: S.space.xs,
                        marginTop: (S.space.sm*-1), }}
          onPress={() => router.push('/login/forgot-password')}
        >
          Forgot Password?
        </AuthSubTitle>
      </AuthForm>

      {/* ❌ Error Display */}
      <AuthForm style={{ marginBottom: authError ? S.space.md : 0 }}>
        <AuthError error={authError} />
      </AuthForm>

      {/* 🔘 Action Buttons */}
      <AuthActionGroup>
        <AuthButton
          text="Sign In"
          onPress={handleSignIn}
          disabled={!isFormValid}
          loading={loading}
        />

        <AuthBody
          align="center"
          color="#D4AF37"
          deco="underline"
          style={{ marginTop: 8 }}
          onPress={() => router.replace('/login/welcome')}
        >
          ← Back to Welcome
        </AuthBody>
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