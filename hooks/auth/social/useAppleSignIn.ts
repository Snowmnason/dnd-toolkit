import { AuthStateManager, logger } from '@/lib';
import { signInWithIdToken } from '@/lib/auth';
import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { Alert } from 'react-native';

/**
 * Hook for Apple sign-in logic.
 * Handles both iOS native authentication and web ID token authentication.
 */
export function useAppleSignIn() {
  const performPostAuthNavigation = async () => {
    await AuthStateManager.setHasAccount(true);
    const { usersDB } = await import('@/lib');
    try {
      const userProfile = await usersDB.getCurrentUser();
      if (userProfile && userProfile.username) {
        router.replace('/select/world-selection');
      } else {
        router.replace('/login/sign-up');
      }
    } catch {
      router.replace('/login/sign-up');
    }
  };

  const handleAppleIosAuth = async () => {
    try {
      logger.category('auth').debug('Apple iOS auth - start');

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        logger.category('auth').error('No identity token');
        Alert.alert('Authentication Error', 'Failed to get identity token');
        return;
      }

      const result = await signInWithIdToken('apple', credential.identityToken);

      if (!result.success) {
        logger.category('auth').error('Sign in failed:', result.error?.message);
        Alert.alert('Authentication Error', result.error?.message || 'Failed to sign in with Apple');
        return;
      }

      await performPostAuthNavigation();
    } catch (error: any) {
      if (error.code === 'ERR_REQUEST_CANCELED') {
        logger.category('auth').debug('User cancelled Apple sign-in');
        return;
      }
      logger.category('auth').error('Apple iOS auth error:', error);
      Alert.alert('Error', 'Apple sign-in failed. Please try again.');
    }
  };

  const handleAppleWebAuth = async (appleAuthRequestResponse: any) => {
    try {
      logger.category('auth').debug('Apple web auth - success');

      if (
        appleAuthRequestResponse.authorization &&
        appleAuthRequestResponse.authorization.id_token &&
        appleAuthRequestResponse.authorization.code
      ) {
        const result = await signInWithIdToken('apple', appleAuthRequestResponse.authorization.id_token, {
          access_token: appleAuthRequestResponse.authorization.code,
        });

        if (!result.success) {
          logger.category('auth').error('Sign in failed:', result.error?.message);
          Alert.alert('Authentication Error', result.error?.message || 'Failed to sign in with Apple');
          return;
        }

        await performPostAuthNavigation();
      }
    } catch (error) {
      logger.category('auth').error('Apple web auth error:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const handleAppleWebAuthError = (error: any) => {
    logger.category('auth').error('Apple web auth failed:', error);
    Alert.alert('Authentication Error', 'Apple sign-in failed. Please try again.');
  };

  return {
    handleAppleIosAuth,
    handleAppleWebAuth,
    handleAppleWebAuthError,
  };
}
