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
import { useGoogleSignIn } from '@/hooks/auth';
import { logger } from '@/lib';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

// Complete auth session setup for mobile
WebBrowser.maybeCompleteAuthSession();

// Web-specific components (loaded dynamically)
interface GoogleOAuthComponents {
  GoogleOAuthProvider: any;
  GoogleLogin: any;
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
  const { handleGoogleWebAuth, handleGoogleWebAuthError } = useGoogleSignIn();

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
        logger.category('auth').warn('Google OAuth web library not available:', error);
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
          onSuccess={handleGoogleWebAuth}
          onError={handleGoogleWebAuthError}
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

interface GoogleSignInButtonProps {
  disabled?: boolean;
  style?: object;
}

// Main component that switches between web and mobile
export default function GoogleSignInButton({ disabled = false, style }: GoogleSignInButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { handleGoogleMobileAuth } = useGoogleSignIn();

  useEffect(() => {
    if (Platform.OS !== 'web') {
      WebBrowser.warmUpAsync();
      return () => {
        WebBrowser.coolDownAsync();
      };
    }
  }, []);

  if (Platform.OS === 'web') {
    return (
      <div style={{ ...style }}>
        <GoogleButtonWeb disabled={disabled || isLoading} />
      </div>
    );
  }

  const handlePress = async () => {
    setIsLoading(true);
    try {
      await handleGoogleMobileAuth();
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
