import type { User } from '@supabase/supabase-js';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import PrimaryButton from '../components/custom_components/PrimaryButton';
import { ThemedText } from '../components/themed-text';
import { ThemedView } from '../components/themed-view';
import UserProfile from '../components/user-profile';
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
    try {
      await supabase.auth.signOut();
      router.replace('/login/welcome');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Loading...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <ThemedText type="title" style={styles.title}>
          Settings
        </ThemedText>

        {/* User Profile Section */}
        <UserProfile user={user} />

        {/* App Settings Section */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            App Settings
          </ThemedText>
          
          {/* TODO: Add app settings here */}
          <ThemedText style={styles.placeholder}>
            🎲 Coming Soon: Theme settings, backup options, and more!
          </ThemedText>
        </ThemedView>

        {/* Back Button */}
        <PrimaryButton
          style={styles.backButton}
          textStyle={{}}
          onPress={() => router.back()}
        >
          ← Back to Main
        </PrimaryButton>

        {/* Sign Out Button */}
        <PrimaryButton
          style={[styles.backButton, { backgroundColor: '#dc3545', marginTop: 16 }]}
          textStyle={{ color: '#fff' }}
          onPress={handleSignOut}
        >
          Sign Out
        </PrimaryButton>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    marginTop: 30,
    padding: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  sectionTitle: {
    marginBottom: 12,
  },
  placeholder: {
    fontStyle: 'italic',
    opacity: 0.7,
    textAlign: 'center',
  },
  backButton: {
    marginTop: 30,
    alignSelf: 'center',
    paddingHorizontal: 30,
  },
});