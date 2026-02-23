import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Platform } from 'react-native';
import { resetPasswordSchema, type ResetPasswordFormData } from '../schemas/auth.schema';
import { getAuthProvider } from '@/lib/services';
import { logger } from '../utils/logger';
import { updatePassword } from './authService';

export const useResetPasswordConfirm = () => {
  const router = useRouter();
  const { control, handleSubmit, formState: { isValid, errors }, watch, reset } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    mode: 'onChange',
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const password = watch('password') || '';
  const confirmPassword = watch('confirmPassword') || '';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(''); // runtime/auth errors
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const doPasswordsMatch = password === confirmPassword && confirmPassword.length > 0;

  // Clear runtime messages when user edits fields again
  useEffect(() => {
    if (error) setError('');
    if (success) setSuccess(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password, confirmPassword]);

  // Get user email from the session/token when component mounts
  useEffect(() => {
    const getUserInfo = async () => {
      try {
        const authProvider = await getAuthProvider();
        
        // Check if we have URL parameters for the reset token
        if (Platform.OS === 'web') {
          const urlParams = new URLSearchParams(window.location.search);
          const accessToken = urlParams.get('access_token');
          const refreshToken = urlParams.get('refresh_token');
          
          if (accessToken && refreshToken) {
            // Restore the session with tokens from the URL
            const restored = await authProvider.restoreSession({ access_token: accessToken, refresh_token: refreshToken });
            
            if (restored) {
              const userSession = await authProvider.getUser();
              if (userSession) {
                setUserEmail(userSession.email || userSession.raw?.user?.email || '');
                logger.info('auth', 'Reset session established for:', userSession.email);
              }
            } else {
              logger.error('auth', 'Failed to establish reset session');
              setError('Invalid or expired reset link. Please request a new password reset.');
            }
          }
        }
        
        // Fallback: try to get current user if already in session
        const existingSession = await authProvider.getUser();
        if (existingSession && existingSession.email && !userEmail) {
          setUserEmail(existingSession.email);
        }
      } catch (err) {
        logger.error('auth', 'Error getting user info:', err);
        setError('Failed to verify reset token. Please try again.');
      }
    };

    getUserInfo();
  }, [userEmail]);

  // Handle password update
  const onSubmit = async (values: ResetPasswordFormData) => {
    setError('');
    setSuccess(false);

    setLoading(true);
    
    try {
      const result = await updatePassword(values.password);
      
      if (result.success && result.message) {
        setSuccess(true);
        setSuccessMessage(result.message);
        // Clear form on success
        reset({ password: '', confirmPassword: '' });
        
        // Auto-redirect to sign-in after success
        setTimeout(() => {
          router.replace('/login/sign-in');
        }, 3000);
      } else if (result.error) {
        setError(result.error);
      }
    } finally {
      setLoading(false);
    }
  };

  // Navigate to sign in
  const goToSignIn = () => {
    router.replace('/login/sign-in');
  };

  return {
    control,
    isValid,
    password,
    confirmPassword,
    loading,
    error,
    success,
    successMessage,
    showPassword,
    userEmail,
    doPasswordsMatch,
    fieldErrors: errors,
    handleResetPassword: handleSubmit(onSubmit),
    setShowPassword,
    goToSignIn,
  };
};