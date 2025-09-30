import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import PrimaryButton from '../../components/custom_components/PrimaryButton';
import TextInput from '../../components/custom_components/TextInput';
import { ThemedText } from '../../components/themed-text';
import { AuthStateManager } from '../../lib/auth-state';
import { supabase } from '../../lib/supabase';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const { error } = isSignUp 
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        Alert.alert('Authentication Error', error.message);
      } else {
        // Save successful authentication state
        await AuthStateManager.setHasAccount(true);
        
        if (isSignUp) {
          Alert.alert(
            'Check your email',
            'We sent you a confirmation link to complete your registration',
            [{ text: 'OK', onPress: () => router.replace('/select/world-selection') }]
          );
        } else {
          router.replace('/select/world-selection');
        }
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
      console.error('Auth error:', error);
    } finally {
      setLoading(false);
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

  return (
    <View style={{ flex: 1, backgroundColor: '#2f353d' }}>
      
      {/* Back Button */}
      <View style={{ position: 'absolute', top: 50, left: 20, zIndex: 10, backgroundColor: 'transparent' }}>
        <PrimaryButton
          style={{ backgroundColor: 'rgba(139, 69, 19, 0.2)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 }}
          textStyle={{ color: '#8B4513', fontSize: 14, fontWeight: '500' }}
          onPress={() => router.back()}
        >
          ← Back
        </PrimaryButton>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: 'transparent' }}>
        <ThemedText 
          type="title" 
          style={{ marginBottom: 20, textAlign: 'center', color: '#F5E6D3', fontSize: 32, fontWeight: '700' }}
        >
          {isSignUp ? 'Create Account' : 'Welcome Back'}
        </ThemedText>
        
        <ThemedText style={{ marginBottom: 40, textAlign: 'center', fontSize: 16, opacity: 0.8, color: '#F5E6D3', lineHeight: 22, paddingHorizontal: 20 }}>
          {isSignUp 
            ? 'Join the adventure and sync your worlds across devices'
            : 'Sign in to access your saved worlds and characters'
          }
        </ThemedText>

        {/* Form */}
        <View style={{ width: '100%', maxWidth: 300, marginBottom: 30, backgroundColor: 'transparent' }}>
          <TextInput
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            style={{ marginBottom: 16 }}
          />
          
          <TextInput
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={{ marginBottom: 16 }}
          />
        </View>

        {/* Action Buttons */}
        <View style={{ width: '100%', maxWidth: 300, gap: 16, backgroundColor: 'transparent' }}>
          <PrimaryButton
            style={{ width: '100%', backgroundColor: '#8B4513', paddingVertical: 16, borderRadius: 8 }}
            textStyle={{ color: '#F5E6D3', fontSize: 16, fontWeight: '600' }}
            onPress={handleAuth}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#F5E6D3" />
            ) : (
              isSignUp ? 'Create Account' : 'Sign In'
            )}
          </PrimaryButton>

          <PrimaryButton
            style={{ width: '100%', backgroundColor: 'rgba(139, 69, 19, 0.15)', borderWidth: 1, borderColor: '#8B4513', paddingVertical: 16, borderRadius: 8 }}
            textStyle={{ color: '#F5E6D3', fontSize: 14, fontWeight: '500' }}
            onPress={() => setIsSignUp(!isSignUp)}
            disabled={loading}
          >
            {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
          </PrimaryButton>

          <PrimaryButton
            style={{ width: '100%', backgroundColor: 'rgba(139, 69, 19, 0.2)', borderWidth: 2, borderColor: '#8B4513', paddingVertical: 16, borderRadius: 8 }}
            textStyle={{ color: '#8B4513', fontSize: 16, fontWeight: '500' }}
            onPress={handleContinueWithoutAccount}
            disabled={loading}
          >
            Continue Without Account
          </PrimaryButton>
        </View>

        <ThemedText style={{ marginTop: 30, textAlign: 'center', fontSize: 12, opacity: 0.6, color: '#F5E6D3', lineHeight: 18, paddingHorizontal: 20 }}>
          You can always sign in later from your profile settings.
        </ThemedText>
      </View>
    </View>
  );
}