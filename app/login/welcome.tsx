import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import CustomLoad from '../../components/custom_components/CustomLoad';
import PrimaryButton from '../../components/custom_components/PrimaryButton';
import { ThemedText } from '../../components/themed-text';
import { AuthStateManager } from '../../lib/auth-state';
import { supabase } from '../../lib/supabase';

export default function WelcomeScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleSocialAuth = async (provider: 'google' | 'apple') => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider,
      });

      if (error) {
        Alert.alert('Authentication Error', error.message);
      } else {
        // Save successful authentication state
        await AuthStateManager.setHasAccount(true);
        // Note: OAuth will redirect away, username check will happen on return
        // The profile completion will be handled by the auth state management
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
      console.error('Social auth error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinueWithEmail = async () => {
    setIsLoading(true);
    try {
      // User wants to use email - save this preference and go to auth screen
      await AuthStateManager.setHasAccount(true);
      router.push('/login/auth?action=signin');
    } catch (error) {
      console.error('Navigation error:', error);
      Alert.alert('Error', 'Unable to navigate to email sign-in');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: "#2f353d" }}>
        <CustomLoad size="large"/>
        <ThemedText style={{ marginTop: 16, color: '#F5E6D3' }}>Loading...</ThemedText>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: "#2f353d" }}>
        
        {/* App Title */}
        <ThemedText 
          type="title" 
          style={{ textAlign: 'center', marginBottom: 16, fontSize: 48, color: '#F5E6D3' }}
        >
          D&D Toolkit
        </ThemedText>
        
        <ThemedText 
          type="subtitle" 
          style={{ textAlign: 'center', marginBottom: 48, color: '#F5E6D3', opacity: 0.8 }}
        >
          Your Adventure Awaits
        </ThemedText>

        {/* Welcome Message */}
        <View style={{ backgroundColor: 'rgba(245, 230, 211, 0.95)', padding: 24, borderRadius: 12, marginBottom: 32, borderWidth: 2, borderColor: '#8B4513' }}>
          <ThemedText 
            type="bodyLarge" 
            style={{ textAlign: 'center', marginBottom: 16, color: '#8B4513', fontWeight: '600' }}
          >
            Welcome, Adventurer!
          </ThemedText>
          
          <ThemedText 
            style={{ textAlign: 'center', color: '#8B4513', lineHeight: 22, fontSize: 16 }}
          >
            Create an account or sign in to start building your campaigns and sync across all your devices.
          </ThemedText>
        </View>

        {/* Social Auth Buttons - Primary Options */}
        <View style={{ width: '100%', maxWidth: 300, backgroundColor: 'transparent', marginBottom: 24 }}>
          
          {/* Social Auth Row */}
          <View style={{ flexDirection: 'row', gap: 12, width: '100%', marginBottom: 0 }}>
            <PrimaryButton
              style={{ 
                flex: 1, 
                backgroundColor: '#000', 
                paddingVertical: 16, 
                borderRadius: 8, 
                flexDirection: 'row', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}
              textStyle={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}
              onPress={() => handleSocialAuth('apple')}
              disabled={isLoading}
            >
              🍎 Apple
            </PrimaryButton>
            
            <PrimaryButton
              style={{ 
                flex: 1, 
                backgroundColor: '#4285F4', 
                paddingVertical: 16, 
                borderRadius: 8, 
                flexDirection: 'row', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}
              textStyle={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}
              onPress={() => handleSocialAuth('google')}
              disabled={isLoading}
            >
              🔵 Google
            </PrimaryButton>
          </View>

          {/* Divider */}
          <View style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            marginVertical: 20 
          }}>
            <View style={{ 
              flex: 1, 
              height: 1, 
              backgroundColor: 'rgba(245, 230, 211, 0.3)' 
            }} />
            <ThemedText style={{ 
              marginHorizontal: 16, 
              color: '#F5E6D3', 
              opacity: 0.6, 
              fontSize: 12 
            }}>
              or
            </ThemedText>
            <View style={{ 
              flex: 1, 
              height: 1, 
              backgroundColor: 'rgba(245, 230, 211, 0.3)' 
            }} />
          </View>
          
          {/* Email Option */}
          <PrimaryButton
            onPress={handleContinueWithEmail}
            style={{ 
              width: '100%', 
              backgroundColor: 'rgba(139, 69, 19, 0.15)', 
              borderWidth: 1, 
              borderColor: '#8B4513', 
              paddingVertical: 16, 
              borderRadius: 8 
            }}
            textStyle={{ color: '#F5E6D3', fontSize: 16, fontWeight: '600' }}
            disabled={isLoading}
          >
            Continue with Email
          </PrimaryButton>
          
        </View>

        {/* Benefits Info */}
        <View style={{ marginTop: 32, backgroundColor: 'transparent', alignItems: 'center' }}>
          <ThemedText 
            type="caption" 
            style={{ textAlign: 'center', color: '#F5E6D3', opacity: 0.7, fontSize: 12, lineHeight: 18 }}
          >
            Cloud sync • Backup your worlds • Access anywhere • Share with friends
          </ThemedText>
        </View>
        
      </View>
    </View>
  );
}