/*
 * Google Sign-In Button Component
 * 
 * READY FOR GOOGLE CLOUD SETUP
 * 
 * This component is fully implemented and follows Supabase documentation.
 * To enable:
 * 1. Create Google Cloud Platform account (free)
 * 2. Create new project and enable Google Identity API
 * 3. Create OAuth 2.0 Web Client ID
 * 4. Add environment variable:
 *    - EXPO_PUBLIC_GOOGLE_AUTH_WEB_CLIENT_ID
 * 5. Import and use in welcome.tsx
 * 
 * Supports: iOS/Android (signInWithOAuth) + Web (@react-oauth/google)
 */

import { Button, ButtonText } from '@/components/ui';
import { AuthStateManager, logger } from '@/lib';
import { getAuthProvider } from '@/lib/auth';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';

// Complete auth session setup for mobile
WebBrowser.maybeCompleteAuthSession();

// Web-specific components (loaded dynamically)
interface GoogleOAuthComponents {
  GoogleOAuthProvider: any;
  GoogleLogin: any;
}

// Common auth success handler
async function handleAuthSuccess(data: any) {
  // Save successful authentication state
  await AuthStateManager.setHasAccount(true);
  
  // Check if user has profile in database
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
}

// Mobile/Native Google auth with comprehensive OAuth flow
async function onGoogleButtonPressMobile() {
  try {
    logger.debug('auth', 'onGoogleButtonPressMobile - start');
    
    // Extract URL parameters for OAuth callback
    function extractParamsFromUrl(url: string) {
      const parsedUrl = new URL(url);
      const hash = parsedUrl.hash.substring(1); // Remove the leading '#'
      const params = new URLSearchParams(hash);
      return {
        access_token: params.get("access_token"),
        expires_in: parseInt(params.get("expires_in") || "0"),
        refresh_token: params.get("refresh_token"),
        token_type: params.get("token_type"),
        provider_token: params.get("provider_token"),
        code: params.get("code"),
      };
    }

    // Start OAuth flow with custom redirect
    const provider = await getAuthProvider();
    const oauthResult = await provider.signInWithOAuth("google", {
      redirectTo: `dnd-toolkit://google-auth`,
      queryParams: { prompt: "consent" },
      skipBrowserRedirect: true,
    });

    const googleOAuthUrl = oauthResult.url;
    if (!googleOAuthUrl) {
      logger.error('auth', 'No OAuth URL found!');
      Alert.alert('Authentication Error', 'Failed to initialize Google sign-in');
      return;
    }

    // Open browser session for OAuth
    const browserResult = await WebBrowser.openAuthSessionAsync(
      googleOAuthUrl,
      `dnd-toolkit://google-auth`,
      { showInRecents: true },
    ).catch((err) => {
      logger.error('auth', 'onGoogleButtonPressMobile - openAuthSessionAsync - error', { err });
      throw err;
    });

    logger.debug('auth', 'onGoogleButtonPressMobile - openAuthSessionAsync - result', { browserResult });

    if (browserResult && browserResult.type === "success") {
      logger.debug('auth', 'onGoogleButtonPressMobile - openAuthSessionAsync - success');
      const params = extractParamsFromUrl(browserResult.url);
      logger.debug('auth', 'onGoogleButtonPressMobile - extracted params', { params });

      if (params.access_token && params.refresh_token) {
        logger.debug('auth', 'onGoogleButtonPressMobile - restoring session');
        const restored = await provider.restoreSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        });

        if (!restored) {
          logger.error('auth', 'onGoogleButtonPressMobile - restoreSession failed');
          Alert.alert('Authentication Error', 'Failed to restore session');
          return;
        }

        logger.debug('auth', 'onGoogleButtonPressMobile - restoreSession success');
        await handleAuthSuccess({});
      } else {
        logger.error('auth', 'onGoogleButtonPressMobile - missing tokens in response');
        Alert.alert('Authentication Error', 'Failed to retrieve authentication tokens');
      }
    } else if (browserResult && browserResult.type === "cancel") {
      logger.debug('auth', 'onGoogleButtonPressMobile - user canceled');
      // User canceled - don't show error
      return;
    } else {
      logger.error('auth', 'onGoogleButtonPressMobile - openAuthSessionAsync failed', { browserResult });
      Alert.alert('Authentication Error', 'Google sign-in was unsuccessful');
    }
  } catch (error) {
    logger.error('auth', 'Google auth error:', error);
    Alert.alert('Error', 'An unexpected error occurred during Google sign-in');
  }
}

// Web Google auth success handler
async function onGoogleButtonSuccessWeb(authRequestResponse: any) {
  try {
    logger.debug('auth', 'Google sign in successful:', { authRequestResponse });
    
    if (authRequestResponse.clientId && authRequestResponse.credential) {
      const provider = await getAuthProvider();
      const result = await provider.signInWithIdToken('google', authRequestResponse.credential);

      if (!result.success) {
        logger.error('auth', 'Error signing in with Google:', result.error?.message);
        Alert.alert('Authentication Error', result.error?.message || 'Failed to sign in with Google');
        return;
      }

      if (result.data) {
        logger.info('auth', 'Google sign in successful:', result.data);
        await handleAuthSuccess(result.data);
      }
    }
  } catch (error) {
    logger.error('auth', 'Google auth error:', error);
    Alert.alert('Error', 'An unexpected error occurred');
  }
}

function onGoogleButtonFailureWeb() {
  logger.error('auth', 'Error signing in with Google');
  Alert.alert('Authentication Error', 'Google sign-in failed. Please try again.');
}

interface GoogleSignInButtonProps {
  disabled?: boolean;
  style?: object;
}

// Web-specific Google button component
function GoogleButtonWeb({ disabled }: { disabled: boolean }) {
  const [sha256Nonce, setSha256Nonce] = useState('');
  const [googleComponents, setGoogleComponents] = useState<GoogleOAuthComponents | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    async function loadGoogleOAuth() {
      try {
        const module = await import('@react-oauth/google');
        setGoogleComponents({
          GoogleOAuthProvider: module.GoogleOAuthProvider,
          GoogleLogin: module.GoogleLogin,
        });
      } catch (error) {
        logger.warn('auth', 'Google OAuth web library not available:', error);
      } finally {
        setIsLoading(false);
      }
    }

    function generateNonce(): string {
      const array = new Uint32Array(1);
      window.crypto.getRandomValues(array);
      return array[0].toString();
    }

    async function generateSha256Nonce(nonce: string): Promise<string> {
      const buffer = await window.crypto.subtle.digest('sha-256', new TextEncoder().encode(nonce));
      const array = Array.from(new Uint8Array(buffer));
      return array.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    const newNonce = generateNonce();
    generateSha256Nonce(newNonce).then(setSha256Nonce);
    loadGoogleOAuth();
  }, []);

  if (isLoading) {
    return (
      <Button
        style={{ 
          backgroundColor: '#4285F4', 
          paddingVertical: 16, 
          borderRadius: 8, 
          flexDirection: 'row', 
          alignItems: 'center', 
          justifyContent: 'center',
          opacity: 0.7
        }}
        onPress={() => {}}
        disabled={true}
      >
        <ButtonText
          style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}
        >
          🔵 Loading Google...
        </ButtonText>
      </Button>
    );
  }

  if (!googleComponents) {
    return (
      <Button
        style={{ 
          backgroundColor: '#4285F4', 
          paddingVertical: 16, 
          borderRadius: 8, 
          flexDirection: 'row', 
          alignItems: 'center', 
          justifyContent: 'center',
          opacity: 0.5
        }}
        onPress={() => {}}
        disabled={true}
      >
        <ButtonText
          style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}
        >
          🔵 Google (Unavailable)
        </ButtonText>
      </Button>
    );
  }

  const { GoogleOAuthProvider, GoogleLogin } = googleComponents;

  return (
    <GoogleOAuthProvider
      clientId={process.env.EXPO_PUBLIC_GOOGLE_AUTH_WEB_CLIENT_ID ?? ''}
      nonce={sha256Nonce}
    >
      <div style={{ width: '100%' }}>
        <GoogleLogin
          nonce={sha256Nonce}
          onSuccess={onGoogleButtonSuccessWeb}
          onError={onGoogleButtonFailureWeb}
          useOneTap={false}
          auto_select={false}
          disabled={disabled}
          theme="filled_blue"
          text="signin_with"
          shape="rectangular"
          size="large"
          width="100%"
        />
      </div>
    </GoogleOAuthProvider>
  );
}

// Main component that switches between web and mobile
export default function GoogleSignInButton({ disabled = false, style }: GoogleSignInButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  // Warm up browser for mobile performance
  useEffect(() => {
    if (Platform.OS !== 'web') {
      WebBrowser.warmUpAsync();
      return () => {
        WebBrowser.coolDownAsync();
      };
    }
  }, []);

  // Web implementation
  if (Platform.OS === 'web') {
    return (
      <div style={{ ...style }}>
        <GoogleButtonWeb disabled={disabled || isLoading} />
      </div>
    );
  }

  // Mobile implementation
  const handlePress = async () => {
    setIsLoading(true);
    try {
      await onGoogleButtonPressMobile();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      style={{ 
        backgroundColor: '#4285F4', 
        paddingVertical: 16, 
        borderRadius: 8, 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'center',
        ...style
      }}
      onPress={handlePress}
      disabled={disabled || isLoading}
    >
      <ButtonText style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}>
        🔵 Google
      </ButtonText>
    </Button>
  );
}
