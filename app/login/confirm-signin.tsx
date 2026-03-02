import {
  AuthActionGroup,
  AuthBackButtonContainer,
  AuthBody,
  AuthBodyFooter,
  AuthButton, AuthButtonBack,
  AuthCaption,
  AuthError,
  AuthForm,
  AuthRoot,
  AuthSubTitle,
  AuthTitle,
  FormAuthInput
} from '@/components/auth_components';
import { useSignInForm } from "@/hooks/auth";
import { useScale } from '@/theme';
import { useRouter } from 'expo-router';

export default function SignInScreen() {
  const S = useScale();
  const router = useRouter();
  
  const {
    control,
    isValid,
    loading,
    authError,
    showPassword,
    handleSignIn,
    setShowPassword,
  } = useSignInForm();

  return (
    <AuthRoot>
      {/* 🔙 Back Button */}
      <AuthBackButtonContainer>
        <AuthButtonBack
          text="← Back"
          onPress={() => router.replace('/')}
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
        <FormAuthInput
          control={control}
          name="email"
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!loading}
          returnKeyType="next"
        />

        <FormAuthInput
          control={control}
          name="password"
          placeholder="Password"
          secureTextEntry={true}
          editable={!loading}
          showPasswordToggle={true}
          onTogglePassword={() => setShowPassword(!showPassword)}
          showPassword={showPassword}
          returnKeyType="go"
          onSubmitEditing={handleSignIn}
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
          disabled={!isValid}
          loading={loading}
        />

        <AuthBody
          align="center"
          color="#D4AF37"
          deco="underline"
          style={{ marginTop: 8 }}
          onPress={() => router.replace('/')}
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