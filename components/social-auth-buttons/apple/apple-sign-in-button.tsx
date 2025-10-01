/*
 * Apple Sign-In Button Component
 * 
 * READY FOR APPLE DEVELOPER ACCOUNT SETUP
 * 
 * This component is fully implemented and follows Supabase documentation.
 * To enable:
 * 1. Get Apple Developer Account ($99/year)
 * 2. Configure App ID, Services ID, and signing key
 * 3. Add environment variables:
 *    - EXPO_PUBLIC_APPLE_AUTH_SERVICE_ID
 *    - EXPO_PUBLIC_APPLE_AUTH_REDIRECT_URI
 * 4. Import and use in welcome.tsx
 * 
 * Supports: iOS (native) + Web (react-apple-signin-auth)
 */

import { supabase } from '@/lib/supabase';
import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { AuthStateManager } from '../../../lib/auth-state';
import PrimaryButton from '../../custom_components/PrimaryButton';

// Web-specific components (loaded dynamically)
interface AppleWebComponents {
  AppleSignin: any;
}

// Common auth success handler
async function handleAuthSuccess(data?: any) {
  // Save successful authentication state
  await AuthStateManager.setHasAccount(true);
  
  // Check if profile is complete (same logic as other auth flows)
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.role !== 'complete') {
    router.replace('/login/complete-profile');
  } else {
    router.replace('/select/world-selection');
  }
}

// iOS Apple auth
async function onAppleButtonPressIOS() {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    console.log('Apple credential:', credential);

    if (credential.identityToken) {
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });

      if (error) {
        console.error('Error signing in with Apple:', error);
        Alert.alert('Authentication Error', error.message);
        return;
      }

      if (data) {
        console.log('Apple sign in successful:', data);
        await handleAuthSuccess(data);
      }
    }
  } catch (error: any) {
    if (error.code === 'ERR_REQUEST_CANCELED') {
      // User canceled the sign-in flow
      return;
    }
    console.error('Apple auth error:', error);
    Alert.alert('Error', 'Apple sign-in failed. Please try again.');
  }
}

// Web Apple auth success handler
async function onAppleButtonSuccessWeb(appleAuthRequestResponse: any) {
  try {
    console.debug('Apple sign in successful:', { appleAuthRequestResponse });
    
    if (appleAuthRequestResponse.authorization && 
        appleAuthRequestResponse.authorization.id_token && 
        appleAuthRequestResponse.authorization.code) {
      
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: appleAuthRequestResponse.authorization.id_token,
        access_token: appleAuthRequestResponse.authorization.code,
      });

      if (error) {
        console.error('Error signing in with Apple:', error);
        Alert.alert('Authentication Error', error.message);
        return;
      }

      if (data) {
        console.log('Apple sign in successful:', data);
        await handleAuthSuccess(data);
      }
    }
  } catch (error) {
    console.error('Apple auth error:', error);
    Alert.alert('Error', 'An unexpected error occurred');
  }
}

function onAppleButtonFailureWeb(error: any) {
  console.error('Error signing in with Apple:', error);
  Alert.alert('Authentication Error', 'Apple sign-in failed. Please try again.');
}

interface AppleSignInButtonProps {
  disabled?: boolean;
  style?: object;
}

// Web-specific Apple button component
function AppleButtonWeb({ disabled }: { disabled: boolean }) {
  const [sha256Nonce, setSha256Nonce] = useState('');
  const [appleComponents, setAppleComponents] = useState<AppleWebComponents | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    async function loadAppleSignin() {
      try {
        const module = await import('react-apple-signin-auth');
        setAppleComponents({
          AppleSignin: module.default,
        });
      } catch (error) {
        console.warn('Apple signin web library not available:', error);
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
    loadAppleSignin();
  }, []);

  if (isLoading) {
    return (
      <PrimaryButton
        style={{ 
          backgroundColor: '#000', 
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
        🍎 Loading Apple...
      </PrimaryButton>
    );
  }

  if (!appleComponents) {
    return (
      <PrimaryButton
        style={{ 
          backgroundColor: '#000', 
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
        🍎 Apple (Unavailable)
      </PrimaryButton>
    );
  }

  const { AppleSignin } = appleComponents;

  return (
    <div style={{ width: '100%' }}>
      <AppleSignin
        authOptions={{
          clientId: process.env.EXPO_PUBLIC_APPLE_AUTH_SERVICE_ID ?? '',
          redirectURI: process.env.EXPO_PUBLIC_APPLE_AUTH_REDIRECT_URI ?? '',
          scope: 'email name',
          state: 'state',
          nonce: sha256Nonce,
          usePopup: true,
        }}
        onSuccess={onAppleButtonSuccessWeb}
        onError={onAppleButtonFailureWeb}
        skipScript={false}
        render={(renderProps: any) => (
          <button
            onClick={renderProps.onClick}
            disabled={disabled || !renderProps.onClick}
            style={{
              width: '100%',
              backgroundColor: '#000',
              color: '#FFF',
              border: 'none',
              borderRadius: '8px',
              padding: '16px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            🍎 Apple
          </button>
        )}
      />
    </div>
  );
}

// Main component that switches between web and iOS
export default function AppleSignInButton({ disabled = false, style }: AppleSignInButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);

  // Check if Apple Sign In is available on iOS
  useEffect(() => {
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync().then(setIsAvailable);
    } else if (Platform.OS === 'web') {
      // Apple auth is always "available" on web (library handles availability)
      setIsAvailable(true);
    } else {
      // Android - not available but we'll show disabled button
      setIsAvailable(false);
    }
  }, []);

  // Web implementation
  if (Platform.OS === 'web') {
    return (
      <div style={{ ...style }}>
        <AppleButtonWeb disabled={disabled || isLoading} />
      </div>
    );
  }

  // iOS implementation
  if (Platform.OS === 'ios' && isAvailable) {
    const handlePress = async () => {
      setIsLoading(true);
      try {
        await onAppleButtonPressIOS();
      } finally {
        setIsLoading(false);
      }
    };

    return (
      <PrimaryButton
        style={{ 
          backgroundColor: '#000', 
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
        🍎 Apple
      </PrimaryButton>
    );
  }

  // Android or iOS unavailable - show disabled button for consistent UI
  return (
    <PrimaryButton
      style={{ 
        backgroundColor: '#000', 
        paddingVertical: 16, 
        borderRadius: 8, 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'center',
        opacity: 0.3, // Clearly disabled appearance
        ...style
      }}
      textStyle={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}
      onPress={() => {}}
      disabled={true}
    >
      🍎 Apple
    </PrimaryButton>
  );
}