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

import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { AuthStateManager } from '../../../lib/auth-state';
import PrimaryButton from '../../custom_components/PrimaryButton';

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
  const { usersDB } = await import('../../../lib/database/users');
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
    console.debug('onGoogleButtonPressMobile - start');
    
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
    const res = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `dnd-toolkit://google-auth`,
        queryParams: { prompt: "consent" },
        skipBrowserRedirect: true,
      },
    });

    const googleOAuthUrl = res.data.url;
    if (!googleOAuthUrl) {
      console.error("No OAuth URL found!");
      Alert.alert('Authentication Error', 'Failed to initialize Google sign-in');
      return;
    }

    // Open browser session for OAuth
    const result = await WebBrowser.openAuthSessionAsync(
      googleOAuthUrl,
      `dnd-toolkit://google-auth`,
      { showInRecents: true },
    ).catch((err) => {
      console.error('onGoogleButtonPressMobile - openAuthSessionAsync - error', { err });
      throw err;
    });

    console.debug('onGoogleButtonPressMobile - openAuthSessionAsync - result', { result });

    if (result && result.type === "success") {
      console.debug('onGoogleButtonPressMobile - openAuthSessionAsync - success');
      const params = extractParamsFromUrl(result.url);
      console.debug('onGoogleButtonPressMobile - extracted params', { params });

      if (params.access_token && params.refresh_token) {
        console.debug('onGoogleButtonPressMobile - setting session');
        const { data, error } = await supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        });

        if (error) {
          console.error('onGoogleButtonPressMobile - setSession error', { error });
          Alert.alert('Authentication Error', error.message);
          return;
        }

        console.debug('onGoogleButtonPressMobile - setSession success', { data });
        await handleAuthSuccess(data);
      } else {
        console.error('onGoogleButtonPressMobile - missing tokens in response');
        Alert.alert('Authentication Error', 'Failed to retrieve authentication tokens');
      }
    } else if (result && result.type === "cancel") {
      console.debug('onGoogleButtonPressMobile - user canceled');
      // User canceled - don't show error
      return;
    } else {
      console.error('onGoogleButtonPressMobile - openAuthSessionAsync failed', { result });
      Alert.alert('Authentication Error', 'Google sign-in was unsuccessful');
    }
  } catch (error) {
    console.error('Google auth error:', error);
    Alert.alert('Error', 'An unexpected error occurred during Google sign-in');
  }
}

// Web Google auth success handler
async function onGoogleButtonSuccessWeb(authRequestResponse: any) {
  try {
    console.debug('Google sign in successful:', { authRequestResponse });
    
    if (authRequestResponse.clientId && authRequestResponse.credential) {
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: authRequestResponse.credential,
      });

      if (error) {
        console.error('Error signing in with Google:', error);
        Alert.alert('Authentication Error', error.message);
        return;
      }

      if (data) {
        console.log('Google sign in successful:', data);
        await handleAuthSuccess(data);
      }
    }
  } catch (error) {
    console.error('Google auth error:', error);
    Alert.alert('Error', 'An unexpected error occurred');
  }
}

function onGoogleButtonFailureWeb() {
  console.error('Error signing in with Google');
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
        console.warn('Google OAuth web library not available:', error);
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
      <PrimaryButton
        style={{ 
          backgroundColor: '#4285F4', 
          paddingVertical: 16, 
          borderRadius: 8, 
          flexDirection: 'row', 
          alignItems: 'center', 
          justifyContent: 'center',
          opacity: 0.7
        }}
        textStyle={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}
        onPress={() => {}}
        disabled={true}
      >
        🔵 Loading Google...
      </PrimaryButton>
    );
  }

  if (!googleComponents) {
    return (
      <PrimaryButton
        style={{ 
          backgroundColor: '#4285F4', 
          paddingVertical: 16, 
          borderRadius: 8, 
          flexDirection: 'row', 
          alignItems: 'center', 
          justifyContent: 'center',
          opacity: 0.5
        }}
        textStyle={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}
        onPress={() => {}}
        disabled={true}
      >
        🔵 Google (Unavailable)
      </PrimaryButton>
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
    <PrimaryButton
      style={{ 
        backgroundColor: '#4285F4', 
        paddingVertical: 16, 
        borderRadius: 8, 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'center',
        ...style
      }}
      textStyle={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}
      onPress={handlePress}
      disabled={disabled || isLoading}
    >
      🔵 Google
    </PrimaryButton>
  );
}
