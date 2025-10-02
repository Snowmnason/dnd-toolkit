import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { prepareAuthNavigation } from './sessionService';

export const useWelcomeScreen = () => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    setIsLoading(true);
    try {
      // Simply navigate to sign-in screen - let user enter credentials
      // Session checking should only happen on app startup, not when user clicks "Sign In"
      router.push('/login/sign-in');
    } catch (error) {
      console.error('Navigation error:', error);
      Alert.alert('Error', 'Unable to navigate to sign-in');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async () => {
    setIsLoading(true);
    try {
      await prepareAuthNavigation();
      router.push('/login/sign-up');
    } catch (error) {
      console.error('Navigation preparation error:', error);
      Alert.alert('Error', 'Unable to navigate to sign-up');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    handleSignIn,
    handleSignUp,
  };
};