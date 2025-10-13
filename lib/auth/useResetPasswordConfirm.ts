import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { supabase } from '../supabase';
import { logger } from '../utils/logger';
import { updatePassword } from './authService';

export const useResetPasswordConfirm = () => {
  const router = useRouter();
  
  // Form state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  // Password validation
  const isPasswordValid = password.length >= 6;
  const doPasswordsMatch = password === confirmPassword && confirmPassword.length > 0;
  const isFormValid = isPasswordValid && doPasswordsMatch;

  // Get user email from the session/token when component mounts
  useEffect(() => {
    const getUserInfo = async () => {
      try {
        // Check if we have URL parameters for the reset token
        if (Platform.OS === 'web') {
          const urlParams = new URLSearchParams(window.location.search);
          const accessToken = urlParams.get('access_token');
          const refreshToken = urlParams.get('refresh_token');
          
          if (accessToken && refreshToken) {
            // Set the session with the tokens from the URL
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });
            
            if (!error && data.user) {
              setUserEmail(data.user.email || '');
              logger.info('reset-password', 'Reset session established for:', data.user.email);
            } else {
              logger.error('reset-password', 'Failed to establish reset session:', error);
              setError('Invalid or expired reset link. Please request a new password reset.');
            }
          }
        }
        
        // Fallback: try to get current user if already in session
        const { data: { user } } = await supabase.auth.getUser();
        if (user && user.email && !userEmail) {
          setUserEmail(user.email);
        }
      } catch (err) {
        logger.error('reset-password', 'Error getting user info:', err);
        setError('Failed to verify reset token. Please try again.');
      }
    };

    getUserInfo();
  }, [userEmail]);

  // Handle password update
  const handleResetPassword = async () => {
    setError('');
    setSuccess(false);
    
    // Client-side validation
    if (!isPasswordValid) {
      setError('Password must be at least 6 characters long');
      return;
    }
    
    if (!doPasswordsMatch) {
      setError('Passwords do not match');
      return;
    }
    
    setLoading(true);
    
    try {
      const result = await updatePassword(password);
      
      if (result.success && result.message) {
        setSuccess(true);
        setSuccessMessage(result.message);
        // Clear form on success
        setPassword('');
        setConfirmPassword('');
        
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

  // Handle input changes
  const handlePasswordChange = (text: string) => {
    setPassword(text);
    if (error) setError('');
    if (success) setSuccess(false);
  };

  const handleConfirmPasswordChange = (text: string) => {
    setConfirmPassword(text);
    if (error) setError('');
    if (success) setSuccess(false);
  };

  // Navigate to sign in
  const goToSignIn = () => {
    router.replace('/login/sign-in');
  };

  return {
    // Form data
    password,
    confirmPassword,
    loading,
    error,
    success,
    successMessage,
    showPassword,
    userEmail,
    
    // Validation state
    isPasswordValid,
    doPasswordsMatch,
    isFormValid,
    
    // Handlers
    handleResetPassword,
    handlePasswordChange,
    handleConfirmPasswordChange,
    setShowPassword,
    goToSignIn,
  };
};