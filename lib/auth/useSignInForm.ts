import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signInUser } from './authService';
import { signInSchema, type SignInFormData } from '../schemas/auth.schema';

export const useSignInForm = () => {
  const router = useRouter();
  
  // RHF + Zod form setup
  const { control, handleSubmit, formState: { isValid }, watch } = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    mode: 'onChange',
    defaultValues: {
      email: '',
      password: '',
    },
  });
  const [loading, setLoading] = useState(false);
  const email = watch('email') || '';
  const [authError, setAuthError] = useState('');
  const [validationWarning, setValidationWarning] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Handle sign in - receives validated data from RHF
  const handleSignIn = async (data: SignInFormData) => {
    setAuthError('');
    setValidationWarning('');
    
    setLoading(true);
    
    try {
      const result = await signInUser(data.email, data.password);
      
      if (result.success && result.redirectTo) {
        router.replace(result.redirectTo as any);
      } else if (result.validationWarning) {
        setValidationWarning(result.validationWarning);
        setAuthError(result.error || '');
      } else if (result.error) {
        setAuthError(result.error);
      }
    } finally {
      setLoading(false);
    }
  };

  return {
    // Form data
    control,
    isValid,
    email,
    loading,
    authError,
    validationWarning,
    showPassword,
    
    // Handlers
    handleSignIn: handleSubmit(handleSignIn),
    setShowPassword,
  };
};