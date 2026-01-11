import { AuthActionGroup, AuthBody, AuthBodyFooter, AuthButton, AuthButtonSecondary, AuthCaption, AuthLink, AuthRoot, AuthSubTitle, AuthTitle } from '@/components/auth_components';
import { AuthStateManager, logger, useWelcomeScreen } from '@/lib';
import { buildNavigationTarget } from '@/lib/navigation/uri-helpers';
import { useScale } from '@/theme';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, useWindowDimensions, View } from 'react-native';
import CustomLoad from '../../components/ui/CustomLoad';
import VersionDisplay from '../../components/VersionDisplay';


// TODO: Uncomment when ready to enable social authentication
// import AppleSignInButton from '../../components/social-auth-buttons/apple/apple-sign-in-button';
// import GoogleSignInButton from '../../components/social-auth-buttons/google/google-sign-in-button';
export default function WelcomeScreen() {
  const S = useScale();
  const { width } = useWindowDimensions();
  const isMobile = (Platform.OS === 'ios' || Platform.OS === 'android') || (Platform.OS === 'web' && width < 900);
   
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const {
    isLoading,
    handleSignIn,
    handleSignUp,
  } = useWelcomeScreen();

  // Auth guard: redirect authenticated users away from welcome screen
  useEffect(() => {
    let mounted = true;
    
    const checkAuthAndRedirect = async () => {
      try {
        logger.debug('welcome', '🔍 Checking authentication status...');
        const { routingDecision } = await AuthStateManager.getRoutingDecision();
        
        if (!mounted) return; // Don't proceed if unmounted
        
        // Early return pattern - combine redirect checks
        if (routingDecision === 'main' || routingDecision === 'complete-profile') {
          const target = routingDecision === 'main' 
            ? '/select/world-selection' 
            : '/login/complete-profile';
          logger.info('welcome', `🔀 Redirecting to ${target}`);
          router.replace(target);
          return;
        }
        
        // User should be on welcome or login screen - stay here
        logger.debug('welcome', `✅ User belongs on welcome screen (decision: ${routingDecision})`);
      } catch (error) {
        logger.error('welcome', 'Error checking auth:', error);
      } finally {
        if (mounted) {
          setIsCheckingAuth(false);
        }
      }
    };

    checkAuthAndRedirect();
    
    return () => { mounted = false; };
  }, [router]);

  if (isCheckingAuth || isLoading) {
    return (
      <AuthRoot>
        <CustomLoad size="large" />
        <AuthBody style={{ marginTop: 16 }}>
          {isCheckingAuth ? 'Checking authentication...' : 'Loading...'}
        </AuthBody>
      </AuthRoot>
    )
  }

  return (
    <AuthRoot>
      {/* 🎮 App Title & Subtitle*/}
      <AuthTitle>D&D Toolkit</AuthTitle>

      <AuthSubTitle>Your Adventure Awaits</AuthSubTitle>

      {/* 📜 Welcome Message Card*/}
      <View
        style={{
          backgroundColor: 'rgba(245, 230, 211, 0.95)',
          padding: S.space.lg,
          borderRadius: 12,
          marginBottom: S.space.xxl,
          borderWidth: 2,
          borderColor: '#8B4513',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <AuthBody.InCard fontSize={S.font.heading2} style={{ marginBottom: S.space.lg, fontWeight: '600' }}>
          Welcome, Adventurer!
        </AuthBody.InCard>

        <AuthBody.InCard fontSize={S.font.body1} style={{  }}>
          Create an account or sign in to start building your campaigns and sync across all your devices.
        </AuthBody.InCard>
      </View>

      {/* 🔐 Authentication Options*/}
      <AuthActionGroup style={{ marginBottom: S.space.md,  }}>
        {/* 
          TODO: Social Auth Buttons - Uncomment when ready to enable
          
          Social Auth Row - Both buttons side by side:
          <View style={{ flexDirection: 'row', gap: 12, width: '100%', marginBottom: 16 }}>
            <AppleSignInButton style={{ flex: 1 }} disabled={isLoading} />
            <GoogleSignInButton style={{ flex: 1 }} disabled={isLoading} />
          </View>

          Add divider between social and email auth when enabled:
          <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 16 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(245, 230, 211, 0.3)' }} />
            <AuthBody opacity={0.6} fontSize={12}>or</AuthBody>
            <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(245, 230, 211, 0.3)' }} />
          </View>
        */}

        {/* Sign In Button */}
        <AuthButton
          text="Sign In"
          onPress={handleSignIn}
          disabled={isLoading}
          loading={isLoading}
        />

        {/* Sign Up Button */}
        <AuthButtonSecondary
          text="Create Account"
          onPress={handleSignUp}
          disabled={isLoading}
        />

        {/* Continue Without Account */}
        <AuthLink
          color={isLoading ? '#BDB76B' : '#D4AF37'}
          onPress={() => {
            if (isMobile) {
              //do nothing for now
              return;
            } else {
              const target = buildNavigationTarget('/StyleDesktop', {}, []);
              router.push(target as any);
              return;
            }
            // TODO: Implement anonymous auth
          }}
        >
          Continue without an account
        </AuthLink>
      </AuthActionGroup>

      {/* 🌤️ Info / Footer */}
      <View style={{ alignItems: 'center', marginTop: 8 }}>
        <AuthBodyFooter>
          Cloud sync • Backup your worlds • Access anywhere • Share with friends
        </AuthBodyFooter>

        <AuthCaption>
          © 2025 The Snow Post · Forged for storytellers & adventurers
        </AuthCaption>

        <VersionDisplay />
      </View>
    </AuthRoot>
  )
}