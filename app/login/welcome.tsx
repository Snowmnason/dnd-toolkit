import { AuthActionGroup, AuthBody, AuthBodyFooter, AuthButton, AuthButtonSecondary, AuthCaption, AuthRoot, AuthSubTitle, AuthTitle } from '@/components/auth_components';
import { useWelcomeScreen } from '@/lib';
import { useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import CustomLoad from '../../components/ui/CustomLoad';


// TODO: Uncomment when ready to enable social authentication
// import AppleSignInButton from '../../components/social-auth-buttons/apple/apple-sign-in-button';
// import GoogleSignInButton from '../../components/social-auth-buttons/google/google-sign-in-button';
export default function WelcomeScreen() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const router = useRouter();
  const {
    isLoading,
    handleSignIn,
    handleSignUp,
  } = useWelcomeScreen();

  if (isLoading) {
    return (
      <AuthRoot>
        <CustomLoad size="large" />
        <AuthBody style={{ marginTop: 16 }}>Loading...</AuthBody>
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
          padding: 24,
          borderRadius: 12,
          marginBottom: 32,
          borderWidth: 2,
          borderColor: '#8B4513',
          maxWidth: 350,
        }}
      >
        <AuthTitle style={{ color: '#8B4513', marginBottom: 16, fontSize: 22 }}>
          Welcome, Adventurer!
        </AuthTitle>

        <AuthBody.InCard>
          Create an account or sign in to start building your campaigns and sync across all your devices.
        </AuthBody.InCard>
      </View>

      {/* 🔐 Authentication Options*/}
      <AuthActionGroup style={{ marginBottom: 24 }}>
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
        <AuthBody
          deco="underline"
          color={isLoading ? '#BDB76B' : '#D4AF37'}
          opacity={isLoading ? 0.5 : 1}
          onPress={() => {
            // TODO: Implement anonymous auth
          }}
        >
          Continue without an account
        </AuthBody>
      </AuthActionGroup>

      {/* 🌤️ Info / Footer */}
      <View style={{ alignItems: 'center', marginTop: 22 }}>
        <AuthBodyFooter>
          Cloud sync • Backup your worlds • Access anywhere • Share with friends
        </AuthBodyFooter>

        <AuthCaption>
          © 2025 The Snow Post · Forged for storytellers & adventurers
        </AuthCaption>
      </View>
    </AuthRoot>
  )
}