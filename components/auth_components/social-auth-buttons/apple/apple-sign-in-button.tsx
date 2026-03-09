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

import { Button, ButtonText } from '@/components/ui';
import { useAppleSignIn } from '@/hooks/auth';
import { logger } from '@/lib';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

// Web-specific components (loaded dynamically)
interface AppleWebComponents {
  AppleSignin: any;
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
  const { handleAppleWebAuth, handleAppleWebAuthError } = useAppleSignIn();

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    async function loadAppleSignin() {
      try {
        const module = await import('react-apple-signin-auth');
        setAppleComponents({
          AppleSignin: module.default,
        });
      } catch (error) {
        logger.category('auth').warn('Apple signin web library not available:', error);
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
      <Button
        style={{ 
          backgroundColor: '#000', 
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
        <ButtonText style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}>
          🍎 Loading Apple...
        </ButtonText>
      </Button>
    );
  }

  if (!appleComponents) {
    return (
      <Button
        style={{ 
          backgroundColor: '#000', 
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
        <ButtonText style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}>
          🍎 Apple (Unavailable)
        </ButtonText>
      </Button>
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
        onSuccess={handleAppleWebAuth}
        onError={handleAppleWebAuthError}
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
  const { handleAppleIosAuth } = useAppleSignIn();

  useEffect(() => {
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync().then(setIsAvailable);
    } else if (Platform.OS === 'web') {
      setIsAvailable(true);
    } else {
      setIsAvailable(false);
    }
  }, []);

  if (Platform.OS === 'web') {
    return (
      <div style={{ ...style }}>
        <AppleButtonWeb disabled={disabled || isLoading} />
      </div>
    );
  }

  if (Platform.OS === 'ios' && isAvailable) {
    const handlePress = async () => {
      setIsLoading(true);
      try {
        await handleAppleIosAuth();
      } finally {
        setIsLoading(false);
      }
    };

    return (
      <Button
        style={{ 
          backgroundColor: '#000', 
          paddingVertical: 16, 
          borderRadius: 8, 
          flexDirection: 'row', 
          alignItems: 'center', 
          justifyContent: 'center',
        }}
        onPress={handlePress}
        disabled={disabled || isLoading}
      >
        <ButtonText style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}>
          🍎 Apple
        </ButtonText>
      </Button>
    );
  }

  return (
    <Button
      style={{ 
        backgroundColor: '#000', 
        paddingVertical: 16, 
        borderRadius: 8, 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'center',
        opacity: 0.3,
        ...style
      }}
      onPress={() => {}}
      disabled={true}
    >
      <ButtonText style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}>🍎 Apple</ButtonText>
    </Button>
  );
}