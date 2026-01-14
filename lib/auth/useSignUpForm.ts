import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { usersDB } from '../database/users';
import { buildRoute } from '../navigation/uri-helpers';
import {
  type CompleteProfileFormData,
  completeProfileSchema,
  getPasswordRequirementsText,
  type SignUpFormData,
  signUpSchema,
} from '../schemas/auth.schema';
import { SecureStorage, STORAGE_KEYS } from '../storage';
import { logger } from '../utils/logger';
import { checkPendingInvites, signUpUser } from './authService';

type SignUpMode = 'signup' | 'complete-profile';
// Use conditional type to properly type form values based on mode
type SignUpFormValues = SignUpFormData | CompleteProfileFormData;

export const useSignUpForm = (mode: SignUpMode = 'signup', user?: any) => {
  const router = useRouter();
  
  // RHF + Zod form - type is properly inferred from schema
  const schema = mode === 'complete-profile' ? completeProfileSchema : signUpSchema;
  const { control, handleSubmit, formState: { isValid }, watch } = useForm({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: mode === 'complete-profile'
      ? { username: '' }
      : { email: '', password: '', confirmPassword: '' },
  });

  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [validationWarning, setValidationWarning] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showEmailExistsModal, setShowEmailExistsModal] = useState(false);
  const password = watch('password') as string | undefined;
  const confirmPassword = watch('confirmPassword') as string | undefined;
  const email = watch('email') as string | undefined;
  const username = watch('username') as string | undefined;
  const passwordsMatch = password === confirmPassword;

  // Handle sign up or profile completion - receives validated data from RHF
  const onSubmit = async (data: SignUpFormValues) => {
    setAuthError('');
    setValidationWarning('');
    
    if (mode === 'complete-profile') {
      // Type assertion: we know data is CompleteProfileFormData in this branch
      const profileData = data as CompleteProfileFormData;
      
      if (!user) {
        setAuthError('Authentication error. Please try again.');
        return;
      }
      
      setLoading(true);
      logger.info('auth', 'Starting profile creation in complete-profile mode');
      
      try {
        logger.debug('auth', 'Creating user profile with data:', {
          auth_id: user.id,
          username: profileData.username.trim(),
          usernameLength: profileData.username.trim().length
        });
        
        // Create user profile
        const newProfile = await usersDB.create({
          auth_id: user.id,
          username: profileData.username.trim()
        });
        
        logger.info('auth', 'Profile created successfully:', {
          profileId: newProfile.id,
          profileUsername: newProfile.username,
          profileAuthId: newProfile.auth_id
        });
        
        // Check for pending invites after profile creation
        logger.debug('auth', 'Checking for pending invites');
        const pendingInvite = await checkPendingInvites();
        
        if (pendingInvite) {
          logger.info('auth', 'Found pending invite, redirecting to process it:', pendingInvite);
          // Clear the pending invite from storage since we're processing it
          await SecureStorage.removeItem(STORAGE_KEYS.PENDING_INVITE);
          
          // Redirect to auth-redirect to process the invite using centralized route building
          const authRedirectRoute = buildRoute('/login/auth-redirect', {
            action: 'world-invite',
            token: pendingInvite.token,
            worldName: pendingInvite.worldName,
          });
          router.replace(authRedirectRoute as any);
        } else {
          logger.info('auth', 'No pending invite found, redirecting to world selection');
          // No pending invite - redirect to world selection
          router.replace(buildRoute('/select/world-selection') as any);
        }
        
      } catch (error: any) {
        logger.error('auth', 'Profile creation error:', error);
        logger.error('auth', 'Error details:', {
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
          logger.error('auth', 'Display name column error detected - database schema issue');
          setAuthError('Database configuration error. Please contact support.');
        } else {
          setAuthError('Failed to create profile. Please try again.');
        }
      } finally {
        setLoading(false);
        logger.debug('auth', 'Profile creation process completed');
      }
    } else {
      // Type assertion: we know data is SignUpFormData in this branch
      const signUpData = data as SignUpFormData;
      
      setLoading(true);
      
      try {
        // Sign up without creating user profile (username will be collected later)
        const result = await signUpUser(signUpData.email, signUpData.password);
        
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

  // UI helpers
  const getUsernameDisplayText = () => {
    if (!username || username.length === 0) return '';
    // Schema handles validity; keep message concise
    return username.length >= 3 && username.length <= 20 ? 
      `Welcome "${username}"!` : 
      'Username: 3-20 characters, letters and numbers only';
  };

  const getPasswordMatchText = () => {
    if (!confirmPassword || confirmPassword.length === 0) return '';
    return passwordsMatch ? '✅ Passwords match!' : '❌ Passwords do not match';
  };

  return {
    // Mode info
    mode,
    control,
    isValid,
    email: email || '',
    password: password || '',
    confirmPassword: confirmPassword || '',
    username: username || '',
    loading,
    authError,
    validationWarning,
    showPassword,
    showEmailExistsModal,
    passwordsMatch,
    
    // Handlers
    handleSignUp: handleSubmit(onSubmit),
    setShowPassword,
    setShowEmailExistsModal,
    
    // UI helpers
    getPasswordRequirementsText: () => getPasswordRequirementsText(password || ''),
    getUsernameDisplayText,
    getPasswordMatchText,
  };
};