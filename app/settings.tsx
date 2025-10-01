import type { User } from '@supabase/supabase-js';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import CustomLoad from '../components/custom_components/CustomLoad';
import PrimaryButton from '../components/custom_components/PrimaryButton';
import { ThemedText } from '../components/themed-text';
import { ThemedView } from '../components/themed-view';
import UserProfile from '../components/user-profile';
import { ComponentStyles, CoreColors, Spacing } from '../constants/theme';
import { AuthStateManager } from '../lib/auth-state';
import { supabase } from '../lib/supabase';

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [buttonDisabled, setButtonDisabled] = useState(false);

  useEffect(() => {
    // Get current user
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOutConfirm = async () => {
    if (buttonDisabled) return; // Prevent spam clicking
    
    if (!signingOut) {
      // First click - show confirmation state
      setSigningOut(true);
      setButtonDisabled(true);
      
      // Re-enable button after 2 seconds
      setTimeout(() => {
        setButtonDisabled(false);
      }, 2000);
    } else {
      // Second click - actually sign out
      setButtonDisabled(true);
      try {
        await supabase.auth.signOut();
        await AuthStateManager.clearAuthState();
        router.replace('/login/welcome');
      } catch (error) {
        console.error('Sign out error:', error);
        Alert.alert('Error', 'Failed to sign out. Please try again.');
        setSigningOut(false);
        setButtonDisabled(false);
      }
    }
  };

  if (loading) {
    return (
      <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <CustomLoad size="large" color={CoreColors.primary} />
        <ThemedText style={{ 
          marginTop: Spacing.md, 
          color: CoreColors.textPrimary,
          fontSize: 16
        }}>
          Loading Settings...
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ 
          padding: Spacing.lg,
          paddingBottom: Spacing.xl * 2 
        }}
      >


        {/* User Profile Section */}
        <UserProfile user={user} />

        {/* App Settings Section */}
        <View style={ComponentStyles.card.default}>
          <ThemedText type="subtitle" style={{
            marginBottom: Spacing.sm,
            fontSize: 24,
            fontWeight: '600',
            color: CoreColors.textOnLight,
            textAlign: 'center'
          }}>
            App Settings
          </ThemedText>
          
          {/* TODO: Add app settings here */}
          <ThemedText style={{
            fontStyle: 'italic',
            opacity: 0.7,
            textAlign: 'center',
            color: CoreColors.textSecondary,
            fontSize: 16,
            lineHeight: 24
          }}>
            🎲 Coming Soon: Theme settings, backup options, and more!
          </ThemedText>
        </View>

        {/* Action Buttons */}
        <View style={{
          marginTop: Spacing.xl,
          gap: Spacing.md,
          alignItems: 'center'
        }}>
          {/* Sign Out Button */}
          <PrimaryButton
            style={{
              backgroundColor: buttonDisabled ? '#6c757d' : '#dc3545',
              paddingHorizontal: Spacing.xl,
              minWidth: 200,
              borderColor: buttonDisabled ? '#6c757d' : '#c82333',
              opacity: buttonDisabled ? 0.6 : 1
            }}
            textStyle={{ 
              color: CoreColors.textPrimary,
              fontWeight: '600'
            }}
            onPress={handleSignOutConfirm}
            disabled={buttonDisabled}
          >
            {signingOut ? 'Confirm Sign Out' : 'Sign Out'}
          </PrimaryButton>
        </View>
      </ScrollView>
    </ThemedView>
  );
}