import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signInUser } from './authService';
import { signInSchema, type SignInFormData } from '../schemas/auth.schema';

export const useSignInForm = () => {
  const router = useRouter();
  
  // RHF + Zod form setup
  const { control, handleSubmit, formState: { isValid }, getValues, watch } = useForm<SignInFormData>({
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
  const [showPassword, setShowPassword] = useState(false);

  // Handle sign in
  const handleSignIn = async () => {
    setAuthError('');
    
    const { email, password } = getValues();
    
    setLoading(true);
    
    try {
      const result = await signInUser(email, password);
      
      if (result.success && result.redirectTo) {
        router.replace(result.redirectTo as any);
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
    showPassword,
    
    // Handlers
    handleSignIn: handleSubmit(handleSignIn),
    setShowPassword,
  };
};