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
import { useAuthFlow } from "@/hooks/auth";
import { useScale } from '@/theme';
import { useRouter } from 'expo-router';

export default function SignInScreen() {
  const S = useScale();
  const router = useRouter();

  const { state, form } = useAuthFlow();

  return (
    <AuthRoot>
      {/* 🔙 Back Button */}
      <AuthBackButtonContainer>
        <AuthButtonBack
          text="← Back"
          onPress={() => router.replace('/')}
          disabled={state.loading}
        />
      </AuthBackButtonContainer>

      {/* 🧠 Header */}
      <AuthTitle>Welcome Back</AuthTitle>

      <AuthSubTitle>
        Continue the sign-in process to confirm your account and adventures.
      </AuthSubTitle>

      {/* 🧾 Form Inputs */}
      <AuthForm style={{ marginBottom: state.error ? S.space.md : S.space.xxl }}>
        <FormAuthInput
          control={form.control}
          name="email"
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!state.loading}
          returnKeyType="next"
        />

        <FormAuthInput
          control={form.control}
          name="password"
          placeholder="Password"
          secureTextEntry={true}
          editable={!state.loading}
          showPasswordToggle={true}
          onTogglePassword={() => form.setShowPassword(!form.showPassword)}
          showPassword={form.showPassword}
          returnKeyType="go"
          onSubmitEditing={form.handleSubmit}
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
      {state.error && (
        <AuthForm style={{ marginBottom: S.space.md }}>
          <AuthError error={state.error} />
        </AuthForm>
      )}

      {/* 🔘 Action Buttons */}
      <AuthActionGroup>
        <AuthButton
          text="Sign In"
          onPress={form.handleSubmit}
          disabled={!form.isValid}
          loading={state.loading}
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