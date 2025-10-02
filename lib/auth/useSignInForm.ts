import { useRouter } from 'expo-router';
import { useState } from 'react';
import { signInUser } from './authService';
import { isSignInFormValid, validateEmail } from './validation';

export const useSignInForm = () => {
  const router = useRouter();
  
  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Validation state
  const emailValidation = validateEmail(email);
  const isFormValid = isSignInFormValid(email, password);

  // Handle sign in
  const handleSignIn = async () => {
    setAuthError('');
    
    // Client-side validation
    if (!emailValidation.isValid) {
      if (!email.trim()) {
        setAuthError('Email is required');
      } else {
        setAuthError('Please enter a valid email address');
      }
      return;
    }

    if (!password.trim()) {
      setAuthError('Password is required');
      return;
    }
    
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

  // Handle input changes (with error clearing)
  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (authError) setAuthError('');
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    if (authError) setAuthError('');
  };

  return {
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
  };
};