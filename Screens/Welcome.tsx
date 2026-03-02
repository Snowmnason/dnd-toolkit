import { AuthActionGroup, AuthBody, AuthBodyFooter, AuthButton, AuthButtonSecondary, AuthCaption, AuthLink, AuthRoot, AuthSubTitle, AuthTitle } from '@/components/auth_components';
import { useWelcomeScreen } from '@/hooks/auth';
import { buildNavigationTarget } from '@/lib/navigation/uri-helpers';
import { useScale } from '@/theme';
import { useRouter } from 'expo-router';
import { Platform, useWindowDimensions, View } from 'react-native';
import CustomLoad from '../components/ui/CustomLoad';
import VersionDisplay from '../components/VersionDisplay';


// TODO: Uncomment when ready to enable social authentication
// import AppleSignInButton from '../components/social-auth-buttons/apple/apple-sign-in-button';
// import GoogleSignInButton from '../components/social-auth-buttons/google/google-sign-in-button';

interface WelcomeScreenProps {
  isLoading?: boolean;
}

export default function Welcome({ isLoading = false }: WelcomeScreenProps) {
  const S = useScale();
  const { width } = useWindowDimensions();
  const isMobile = (Platform.OS === 'ios' || Platform.OS === 'android') || (Platform.OS === 'web' && width < 900);
  
  const router = useRouter();
  const {
    isLoading: authIsLoading,
    handleSignIn,
    handleSignUp,
  } = useWelcomeScreen();

  const loading = isLoading || authIsLoading;

  if (loading) {
    return (
      <AuthRoot>
        <CustomLoad size="large" />
        <AuthBody style={{ marginTop: 16 }}>
          Loading...
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
            <AppleSignInButton style={{ flex: 1 }} disabled={loading} />
            <GoogleSignInButton style={{ flex: 1 }} disabled={loading} />
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
          disabled={loading}
          loading={loading}
        />

        {/* Sign Up Button */}
        <AuthButtonSecondary
          text="Create Account"
          onPress={handleSignUp}
          disabled={loading}
        />

        {/* Continue Without Account */}
        <AuthLink
          color={loading ? '#BDB76B' : '#D4AF37'}
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
