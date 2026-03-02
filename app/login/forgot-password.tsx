import {
  AuthActionGroup,
  AuthBody,
  AuthBodyFooter,
  AuthButton, AuthButtonBack,
  AuthCaption, AuthError, AuthForm,
  AuthModal,
  AuthRoot,
  AuthSubTitle,
  AuthSuccess,
  AuthTitle,
  FormAuthInput,
} from '@/components/auth_components';
import { sendPasswordReset } from '@/lib';
import { forgotPasswordSchema, type ForgotPasswordFormData } from '@/validation/auth.schema';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  
  const { control, handleSubmit, formState: { isValid }, watch } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: 'onChange',
    defaultValues: {
      email: '',
    },
  });
  const email = watch('email') || '';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showEmailNotFoundModal, setShowEmailNotFoundModal] = useState(false);

  // Handle password reset
  const onSubmit = async (values: ForgotPasswordFormData) => {
    setError('');
    setSuccess(false);
    
    setLoading(true);
    
    try {
      const result = await sendPasswordReset(values.email);
      
      if (result.success && result.message) {
        setSuccess(true);
        setSuccessMessage(result.message);
      } else if (result.showEmailNotFoundModal) {
        setShowEmailNotFoundModal(true);
      } else if (result.error) {
        setError(result.error);
      }
    } finally {
      setLoading(false);
    }
  };


  return (
    <AuthRoot>
      {/* 🔙 Back Button*/}
      <View style={{ position: 'absolute', top: 50, left: 20, zIndex: 10 }}>
        <AuthButtonBack
          text="← Back"
          onPress={() => router.replace('/login/sign-in')}
          disabled={loading}
        />
      </View>

      {/* 🧠 Header*/}
      <AuthTitle>Forgot Password</AuthTitle>

      <AuthSubTitle>Enter your email to receive password reset instructions.</AuthSubTitle>

      {/* 🧾 Form*/}
      <AuthForm>
        <FormAuthInput
          control={control}
          name="email"
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!loading}
          returnKeyType="go"
          onSubmitEditing={handleSubmit(onSubmit)}
        />

        {/* Error Display */}
        <AuthError error={error} />

        {/* Success Display */}
        {success && <AuthSuccess message={successMessage} />}
      </AuthForm>

      {/* 🔘 Buttons*/}
      <AuthActionGroup>
        <AuthButton
          text="Send New Password Email"
          onPress={handleSubmit(onSubmit)}
          disabled={!isValid}
          loading={loading}
        />

        <AuthBody
          align="center"
          color="#D4AF37"
          deco="underline"
          onPress={() => router.replace('/login/sign-in')}
        >
          ← Back to Sign In
        </AuthBody>
      </AuthActionGroup>

      {/* 🧩 Footer*/}
      <AuthBodyFooter>
        Secure authentication powered by Supabase
      </AuthBodyFooter>

      <AuthCaption>
        © 2025 The Snow Post · Forged for storytellers & adventurers
      </AuthCaption>

      {/* 📬 Email Not Found Modal */}
      <AuthModal
        visible={showEmailNotFoundModal}
        onClose={() => setShowEmailNotFoundModal(false)}
        title="No Account Found 🤔"
        message={`We couldn't find an account with ${email}. Would you like to create a new account instead?`}
        buttons={[
          {
            text: 'Cancel',
            onPress: () => setShowEmailNotFoundModal(false),
            variant: 'cancel',
          },
          {
            text: 'Create Account',
            onPress: () => {
              setShowEmailNotFoundModal(false)
              router.push('/login/sign-up')
            },
            variant: 'primary',
          },
        ]}
      />
    </AuthRoot>
  )
}