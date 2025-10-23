import { Body, Button, Caption, Heading, SubTitle, Title } from '@/components/ui';
import { useWelcomeScreen } from '@/lib';
import { useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import CustomLoad from '../../components/custom_components/CustomLoad';


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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: "#2f353d" }}>
        <CustomLoad size="large"/>
        <Body style={{ marginTop: 16, color: '#F5E6D3' }}>
          Loading...
        </Body>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: "#2f353d" }}>
        
        {/* App Title */}
        <Title> D&D Toolkit </Title>

        <SubTitle align='center' color='#F5E6D3'
          style={{marginBottom: 48, opacity: 0.8 }}
        >
          Your Adventure Awaits
        </SubTitle>

        {/* Welcome Message */}
        <View style={{ backgroundColor: 'rgba(245, 230, 211, 0.95)', padding: 24, borderRadius: 12, marginBottom: 32, borderWidth: 2, borderColor: '#8B4513' }}>
          <Heading align='center' color='#8B4513'
            style={{ marginBottom: 16, }}
          >
            Welcome, Adventurer!
          </Heading>
          
          <Body align='center' color='#8B4513'
            style={{ lineHeight: 22, fontSize: 16 }}
          >
            Create an account or sign in to start building your campaigns and sync across all your devices.
          </Body>
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
              <ThemedText style={{ marginHorizontal: 16, color: '#F5E6D3', opacity: 0.6, fontSize: 12 }}>or</ThemedText>
              <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(245, 230, 211, 0.3)' }} />
            </View>

            Don't forget to uncomment the imports at the top!
          */}
          
          {/* Sign In Button */}
          <Button
          variant='auth'
            text="Sign In"
            onPress={handleSignIn}
            disabled={isLoading}
            loading={isLoading}
          />

          {/* Sign Up Button - matching secondary style from sign-in screen */}
          <Button
            bg='rgba(139, 69, 19, 0.15)'
            borderColor='#8B4513'
            textColor='#F5E6D3'
            text='Create Account'
            style={{ 
              width: '100%', 
            }}
            onPress={handleSignUp}
            disabled={isLoading}
          />
          {/* Anon sign in */}
          <Body
            deco='underline'
            color={isLoading ? '#BDB76B' : '#D4AF37'}
            align='center'
            style={{ 
              textAlign: 'center', 
              opacity: isLoading ? 0.5 : 1
            }}
            onPress={() => {
              if (false) {}
            }}
          >
            Continue without an account
          </Body>
          
        </View>

        {/* Benefits Info */}
        <View style={{ marginTop: 22, backgroundColor: 'transparent', alignItems: 'center' }}>
          <Body variant="semi" fontSize="$sm" color='#F5E6D3' align='center' opacity={0.6}
            style={{ marginTop: 30, lineHeight: 18, paddingHorizontal: 20 }}>
            Cloud sync • Backup your worlds • Access anywhere • Share with friends
          </Body>
          
          <Caption color='#F5E6D3' align='center' style={{ marginTop: 8, opacity: 0.5, lineHeight: 16, paddingHorizontal: 20 }}>
            © 2025 The Snow Post · Forged for storytellers & adventurers
          </Caption>
        </View>
        
      </View>
    </View>
  );
}