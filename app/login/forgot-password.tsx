import {
  AuthActionGroup,
  AuthBody,
  AuthBodyFooter,
  AuthButton,
  AuthCaption, AuthError, AuthForm,
  AuthRoot,
  AuthSubTitle,
  AuthSuccess,
  AuthTitle,
  FormAuthInput
} from '@/components/auth_components';
import { useModal } from '@/contexts';
import { useAuthActions } from '@/hooks/auth';
import { useNavigation } from '@/hooks/navigation';
import { forgotPasswordSchema, type ForgotPasswordFormData } from '@/validation/auth.schema';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

export default function ForgotPasswordScreen() {
  const navigate = useNavigation();
  const { openModal, closeModal } = useModal();
  const { resetPassword } = useAuthActions();
  
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
  const [showEmailNotFound, setShowEmailNotFound] = useState(false);

  // Manage email-not-found modal via context
  useEffect(() => {
    if (showEmailNotFound) {
      openModal('login-message', {
        heading: 'No Account Found 🤔',
        message: `We couldn't find an account with ${email}. Would you like to create a new account instead?`,
        buttons: [
          {
            text: 'Cancel',
            onPress: () => {
              closeModal();
              setShowEmailNotFound(false);
            },
            variant: 'cancel' as const,
          },
          {
            text: 'Create Account',
            onPress: () => {
              closeModal();
              setShowEmailNotFound(false);
              navigate.to('/login/sign-up');
            },
            variant: 'primary' as const,
          },
        ],
      });
    } else {
      closeModal();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showEmailNotFound, email, openModal, closeModal]);

  // Handle password reset
  const onSubmit = async (values: ForgotPasswordFormData) => {
    setError('');
    setSuccess(false);
    
    setLoading(true);
    
    try {
      const result = await resetPassword(values.email);
      
      if (result.success && result.message) {
        setSuccess(true);
        setSuccessMessage(result.message);
      } else if (result.showEmailNotFoundModal) {
        setShowEmailNotFound(true);
      } else if (result.error) {
        setError(result.error);
      }
    } finally {
      setLoading(false);
    }
  };


  return (
    <AuthRoot>

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
          onPress={() => navigate.replace('/login/sign-in')}
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
    </AuthRoot>
  )
}