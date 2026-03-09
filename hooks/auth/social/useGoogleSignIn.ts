import { AuthStateManager, logger } from '@/lib';
import { restoreSession, signInWithIdToken, signInWithOAuth } from '@/lib/auth';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Alert } from 'react-native';

/**
 * Hook for Google sign-in logic.
 * Handles both mobile OAuth flow and web ID token authentication.
 */
export function useGoogleSignIn() {
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

  const handleGoogleMobileAuth = async () => {
    try {
      logger.category('auth').debug('Google mobile auth - start');

      const extractParamsFromUrl = (url: string) => {
        const parsedUrl = new URL(url);
        const hash = parsedUrl.hash.substring(1);
        const params = new URLSearchParams(hash);
        return {
          access_token: params.get('access_token'),
          refresh_token: params.get('refresh_token'),
        };
      };

      const oauthResult = await signInWithOAuth('google', {
        redirectTo: `dnd-toolkit://google-auth`,
        queryParams: { prompt: 'consent' },
        skipBrowserRedirect: true,
      });

      if (!oauthResult.url) {
        logger.category('auth').error('No OAuth URL found');
        Alert.alert('Authentication Error', 'Failed to initialize Google sign-in');
        return;
      }

      const browserResult = await WebBrowser.openAuthSessionAsync(
        oauthResult.url,
        `dnd-toolkit://google-auth`,
        { showInRecents: true },
      );

      if (browserResult?.type === 'success') {
        const params = extractParamsFromUrl(browserResult.url);
        if (params.access_token && params.refresh_token) {
          const restored = await restoreSession({
            access_token: params.access_token,
            refresh_token: params.refresh_token,
          });

          if (restored) {
            await performPostAuthNavigation();
          } else {
            logger.category('auth').error('Session restoration failed');
            Alert.alert('Authentication Error', 'Failed to restore session');
          }
        } else {
          logger.category('auth').error('Missing tokens in response');
          Alert.alert('Authentication Error', 'Failed to retrieve authentication tokens');
        }
      } else if (browserResult?.type === 'cancel') {
        logger.category('auth').debug('User cancelled Google sign-in');
      } else {
        logger.category('auth').error('Google sign-in failed');
        Alert.alert('Authentication Error', 'Google sign-in was unsuccessful');
      }
    } catch (error) {
      logger.category('auth').error('Google mobile auth error:', error);
      Alert.alert('Error', 'An unexpected error occurred during Google sign-in');
    }
  };

  const handleGoogleWebAuth = async (authRequestResponse: any) => {
    try {
      logger.category('auth').debug('Google web auth - success');

      if (authRequestResponse.clientId && authRequestResponse.credential) {
        const result = await signInWithIdToken('google', authRequestResponse.credential);

        if (!result.success) {
          logger.category('auth').error('Sign in failed:', result.error?.message);
          Alert.alert('Authentication Error', result.error?.message || 'Failed to sign in with Google');
          return;
        }

        await performPostAuthNavigation();
      }
    } catch (error) {
      logger.category('auth').error('Google web auth error:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const handleGoogleWebAuthError = () => {
    logger.category('auth').error('Google web auth failed');
    Alert.alert('Authentication Error', 'Google sign-in failed. Please try again.');
  };

  return {
    handleGoogleMobileAuth,
    handleGoogleWebAuth,
    handleGoogleWebAuthError,
  };
}
