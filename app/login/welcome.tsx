import React from 'react';
import { Button, Heading, Text, View } from 'tamagui';
import AuthButton from '../../components/auth_components/AuthButton';
import CustomLoad from '../../components/ui/CustomLoad';
import { useWelcomeScreen } from '../../lib/auth';

// TODO: Uncomment when ready to enable social authentication
// import AppleSignInButton from '../../components/social-auth-buttons/apple/apple-sign-in-button';
// import GoogleSignInButton from '../../components/social-auth-buttons/google/google-sign-in-button';
export default function WelcomeScreen() {
  const {
    isLoading,
    handleSignIn,
    handleSignUp,
  } = useWelcomeScreen();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: "#2f353d" }}>
        <CustomLoad size="large"/>
        <Text style={{ marginTop: 16, color: '#F5E6D3' }}>
          Loading...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: "#2f353d" }}>
        
        {/* App Title */}
        <Text 
          style={{ textAlign: 'center', marginBottom: 16, fontSize: 48, color: '#F5E6D3', fontWeight: '700' }}
        >
          D&D Toolkit
        </Text>
        
        <Text 
          style={{ textAlign: 'center', marginBottom: 48, color: '#F5E6D3', opacity: 0.8 }}
        >
          Your Adventure Awaits
        </Text>

        {/* Welcome Message */}
        <View style={{ backgroundColor: 'rgba(245, 230, 211, 0.95)', padding: 24, borderRadius: 12, marginBottom: 32, borderWidth: 2, borderColor: '#8B4513' }}>
          <Heading 
            style={{ textAlign: 'center', marginBottom: 16, color: '#8B4513', fontWeight: '600' }}
          >
            Welcome, Adventurer!
          </Heading>
          
          <Text 
            style={{ textAlign: 'center', color: '#8B4513', lineHeight: 22, fontSize: 16 }}
          >
            Create an account or sign in to start building your campaigns and sync across all your devices.
          </Text>
        </View>

        {/* Authentication Options */}
        <View style={{ width: '100%', maxWidth: 300, gap: 16, backgroundColor: 'transparent', marginBottom: 24 }}>
          
          {/* 
            TODO: Social Auth Buttons - Uncomment when ready to enable
            
            Social Auth Row - Both buttons side by side:
            <View style={{ flexDirection: 'row', gap: 12, width: '100%', marginBottom: 16 }}>
              <AppleSignInButton
                style={{ flex: 1 }}
                disabled={isLoading || isCheckingSession}
              />
              <GoogleSignInButton
                style={{ flex: 1 }}
                disabled={isLoading || isCheckingSession}
              />
            </View>

            Add divider between social and email auth when enabled:
            <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 16 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(245, 230, 211, 0.3)' }} />
              <Text style={{ marginHorizontal: 16, color: '#F5E6D3', opacity: 0.6, fontSize: 12 }}>or</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(245, 230, 211, 0.3)' }} />
            </View>

            Don't forget to uncomment the imports at the top!
          */}
          
          {/* Sign In Button */}
          <AuthButton
            title="Sign In"
            onPress={handleSignIn}
            disabled={isLoading}
            loading={isLoading}
          />

          {/* Sign Up Button - matching secondary style from sign-in screen */}
          <Button
            //variant="secondary"
            //fullWidth
            onPress={handleSignUp}
            disabled={isLoading}
          >
            Create Account
          </Button>
          {/* Anon sign in */}
          <Text
            style={{ 
              textAlign: 'center', 
              fontSize: 14, 
              color: isLoading ? '#BDB76B' : '#D4AF37', 
              fontWeight: '500',
              textDecorationLine: 'underline',
              opacity: isLoading ? 0.5 : 1
            }}
            onPress={() => {
              if (false) {}
            }}
          >
            Continue without an account
          </Text>
          
        </View>

        {/* Benefits Info */}
        <View style={{ marginTop: 22, backgroundColor: 'transparent', alignItems: 'center' }}>
          <Text 
            style={{ textAlign: 'center', color: '#F5E6D3', opacity: 0.7, fontSize: 12, lineHeight: 18 }}
          >
            Cloud sync • Backup your worlds • Access anywhere • Share with friends
          </Text>
          
          <Text style={{ marginTop: 8, textAlign: 'center', fontSize: 11, opacity: 0.5, color: '#F5E6D3', lineHeight: 16, paddingHorizontal: 20 }}>
            © 2025 The Snow Post · Forged for storytellers & adventurers
          </Text>
        </View>
        
      </View>
    </View>
  );
}