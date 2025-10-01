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

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.auth.signOut();
              await AuthStateManager.clearAuthState();
              router.replace('/login/welcome');
            } catch (error) {
              console.error('Sign out error:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          }
        }
      ]
    );
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
        {/* Page Title */}
        <View style={ComponentStyles.card.container}>
          <ThemedText type="title" style={{
            textAlign: 'center',
            fontSize: 48,
            fontWeight: '700',
            color: CoreColors.textPrimary,
            textShadowColor: CoreColors.backgroundDark,
            textShadowOffset: { width: 2, height: 2 },
            textShadowRadius: 4
          }}>
            Settings
          </ThemedText>
        </View>

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
          {/* Back Button */}
          <PrimaryButton
            style={{
              paddingHorizontal: Spacing.xl,
              minWidth: 200
            }}
            textStyle={{}}
            onPress={() => router.back()}
          >
            ← Return
          </PrimaryButton>

          {/* Sign Out Button */}
          <PrimaryButton
            style={{
              backgroundColor: '#dc3545',
              paddingHorizontal: Spacing.xl,
              minWidth: 200,
              borderColor: '#c82333'
            }}
            textStyle={{ 
              color: CoreColors.textPrimary,
              fontWeight: '600'
            }}
            onPress={handleSignOut}
          >
            Sign Out
          </PrimaryButton>
        </View>
      </ScrollView>
    </ThemedView>
  );
}