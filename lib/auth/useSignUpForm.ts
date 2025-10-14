import { useRouter } from 'expo-router';
import { useState } from 'react';
import { usersDB } from '../database/users';
import { logger } from '../utils/logger';
import { checkPendingInvites, signUpUser } from './authService';
import { getPasswordHintColor, getPasswordRequirementsText, validateEmail, validatePassword, validateUsername } from './validation';

type SignUpMode = 'signup' | 'complete-profile';

export const useSignUpForm = (mode: SignUpMode = 'signup', user?: any) => {
  const router = useRouter();
  
  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showEmailExistsModal, setShowEmailExistsModal] = useState(false);

  // Validation state
  const passwordValidation = validatePassword(password);
  const emailValidation = validateEmail(email);
  const usernameValidation = validateUsername(username);
  const passwordsMatch = password === confirmPassword;
  
  // Form validity depends on mode
  const isFormValid = mode === 'complete-profile' 
    ? usernameValidation.isValid
    : emailValidation.isValid && passwordValidation.isValid && passwordsMatch;

  // Handle sign up or profile completion
  const handleSignUp = async () => {
    setAuthError('');
    
    if (mode === 'complete-profile') {
      // Complete profile mode - just validate username and create profile
      if (!usernameValidation.isValid) {
        if (!username.trim()) {
          setAuthError('Username is required');
        } else {
          setAuthError('Username must be 3-20 characters, letters and numbers only');
        }
        return;
      }
      
      if (!user) {
        setAuthError('Authentication error. Please try again.');
        return;
      }
      
      setLoading(true);
      logger.info('signup', 'Starting profile creation in complete-profile mode');
      
      try {
        logger.debug('signup', 'Creating user profile with data:', {
          auth_id: user.id,
          username: username.trim(),
          usernameLength: username.trim().length
        });
        
        // Create user profile
        const newProfile = await usersDB.create({
          auth_id: user.id,
          username: username.trim()
        });
        
        logger.info('signup', 'Profile created successfully:', {
          profileId: newProfile.id,
          profileUsername: newProfile.username,
          profileAuthId: newProfile.auth_id
        });
        
        // Check for pending invites after profile creation
        logger.debug('signup', 'Checking for pending invites');
        const pendingInvite = checkPendingInvites();
        
        if (pendingInvite) {
          logger.info('signup', 'Found pending invite, redirecting to process it:', pendingInvite);
          // Clear the pending invite from localStorage since we're processing it
          localStorage.removeItem('pending_world_invite');
          
          // Redirect to auth-redirect to process the invite
          router.replace(`/login/auth-redirect?action=world-invite&token=${pendingInvite.token}&worldName=${encodeURIComponent(pendingInvite.worldName)}`);
        } else {
          logger.info('signup', 'No pending invite found, redirecting to world selection');
          // No pending invite - redirect to world selection
          router.replace('/select/world-selection');
        }
        
      } catch (error: any) {
        logger.error('signup', 'Profile creation error:', error);
        logger.error('signup', 'Error details:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          stack: error.stack
        });
        
        // Handle specific errors
        if (error.message?.includes('duplicate') || error.code === '23505') {
          setAuthError('Username already taken. Please choose another.');
        } else if (error.message?.includes('display_name')) {
          logger.error('signup', 'Display name column error detected - database schema issue');
          setAuthError('Database configuration error. Please contact support.');
        } else {
          setAuthError('Failed to create profile. Please try again.');
        }
      } finally {
        setLoading(false);
        logger.debug('signup', 'Profile creation process completed');
      }
    } else {
      // Sign up mode - validate email and password only (no username)
      if (!emailValidation.isValid) {
        setAuthError(!email.trim() ? 'Email is required' : 'Please enter a valid email address');
        return;
      }
      
      if (!passwordValidation.isValid) {
        setAuthError('Password must be at least 8 characters with uppercase, lowercase, number, and special character');
        return;
      }
      
      if (!passwordsMatch) {
        setAuthError('Passwords do not match');
        return;
      }
      
      setLoading(true);
      
      try {
        // Sign up without creating user profile (username will be collected later)
        const result = await signUpUser(email, password);
        
        if (result.success && result.redirectTo) {
          router.replace(result.redirectTo as any);
        } else if (result.showEmailExistsModal) {
          setShowEmailExistsModal(true);
        } else if (result.error) {
          setAuthError(result.error);
        }
      } finally {
        setLoading(false);
      }
    }
  };

  // Handle input changes (with error clearing)
  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (authError) setAuthError('');
  };

  const handleUsernameChange = (text: string) => {
    setUsername(text);
    if (authError) setAuthError('');
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    if (authError) setAuthError('');
  };

  const handleConfirmPasswordChange = (text: string) => {
    setConfirmPassword(text);
    if (authError) setAuthError('');
  };

  // UI helpers
  const getUsernameDisplayText = () => {
    if (username.length === 0) return '';
    return usernameValidation.isValid ? 
      `Welcome "${username}"!` : 
      'Username: 3-20 characters, letters and numbers only';
  };

  const getPasswordMatchText = () => {
    if (confirmPassword.length === 0) return '';
    return passwordsMatch ? '✅ Passwords match!' : '❌ Passwords do not match';
  };

  return {
    // Mode info
    mode,
    
    // Form data
    email,
    password,
    confirmPassword,
    username,
    loading,
    authError,
    showPassword,
    showEmailExistsModal,
    
    // Validation state
    passwordValidation,
    emailValidation,
    usernameValidation,
    passwordsMatch,
    isFormValid,
    
    // Handlers
    handleSignUp,
    handleEmailChange,
    handleUsernameChange,
    handlePasswordChange,
    handleConfirmPasswordChange,
    setShowPassword,
    setShowEmailExistsModal,
    
    // UI helpers
    getPasswordHintColor: () => getPasswordHintColor(password),
    getPasswordRequirementsText: () => getPasswordRequirementsText(password),
    getUsernameDisplayText,
    getPasswordMatchText,
  };
};