import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import PrimaryButton from '../../components/custom_components/PrimaryButton';
import { ThemedText } from '../../components/themed-text';
import { AuthStateManager } from '../../lib/auth-state';

export default function WelcomeScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleSignUp = async () => {
    setIsLoading(true);
    try {
      // User wants to create account - save this preference
      await AuthStateManager.setHasAccount(true);
      router.push('/login/login?action=signup');
    } catch (error) {
      console.error('Navigation error:', error);
      Alert.alert('Error', 'Unable to navigate to sign-up');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async () => {
    setIsLoading(true);
    try {
      // User wants to sign in - save this preference
      await AuthStateManager.setHasAccount(true);
      router.push('/login/login?action=signin');
    } catch (error) {
      console.error('Navigation error:', error);
      Alert.alert('Error', 'Unable to navigate to sign-in');
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinueWithoutAccount = async () => {
    try {
      // User chose to skip authentication - save this preference
      await AuthStateManager.setSkipAuth(true);
      router.replace('/select/world-selection');
    } catch (error) {
      console.error('Error saving preference:', error);
      // Still navigate even if saving fails
      router.replace('/select/world-selection');
    }
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: "#2f353d" }}>
        <ActivityIndicator size="large" color="#8B4513" />
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
            Sign in to sync your campaigns across devices, or continue without an account to use the toolkit offline.
          </ThemedText>
        </View>

        {/* Action Buttons */}
        <View style={{ width: '100%', maxWidth: 300, backgroundColor: 'transparent' }}>
          
          <PrimaryButton
            onPress={handleSignIn}
            style={{ marginBottom: 12, backgroundColor: '#8B4513', paddingVertical: 16, borderRadius: 8 }}
            textStyle={{ color: '#F5E6D3', fontSize: 16, fontWeight: '600' }}
          >
            Sign In
          </PrimaryButton>
          
          <PrimaryButton
            onPress={handleSignUp}
            style={{ marginBottom: 24, backgroundColor: '#654321', paddingVertical: 16, borderRadius: 8 }}
            textStyle={{ color: '#F5E6D3', fontSize: 16, fontWeight: '600' }}
          >
            Create Account
          </PrimaryButton>
          
          <PrimaryButton
            onPress={handleContinueWithoutAccount}
            style={{ backgroundColor: 'rgba(139, 69, 19, 0.2)', borderWidth: 2, borderColor: '#8B4513', paddingVertical: 16, borderRadius: 8 }}
            textStyle={{ color: '#8B4513', fontSize: 16, fontWeight: '500' }}
          >
            Continue Without Account
          </PrimaryButton>
          
        </View>

        {/* Benefits Info */}
        <View style={{ marginTop: 32, backgroundColor: 'transparent', alignItems: 'center' }}>
          <ThemedText 
            type="caption" 
            style={{ textAlign: 'center', color: '#F5E6D3', opacity: 0.7, fontSize: 12, lineHeight: 18 }}
          >
            With an account: Cloud sync • Backup your worlds • Access anywhere
          </ThemedText>
          <ThemedText 
            type="caption" 
            style={{ textAlign: 'center', color: '#F5E6D3', opacity: 0.7, marginTop: 4, fontSize: 12, lineHeight: 18 }}
          >
            Without account: Full offline access • Privacy first • No data collection
          </ThemedText>
        </View>
        
      </View>
    </View>
  );
}