import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import PrimaryButton from './custom_components/PrimaryButton';
import SignOutButton from './social-auth-buttons/sign-out-button';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

interface UserProfileProps {
  user?: {
    email?: string;
    user_metadata?: {
      full_name?: string;
      username?: string;
    };
  } | null;
}

export default function UserProfile({ user }: UserProfileProps) {
  const router = useRouter();

  if (!user) {
    // Not logged in - show login option
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="subtitle" style={styles.title}>
          Account
        </ThemedText>
        <ThemedText style={styles.subtitle}>
          Sign in to sync your D&D worlds across devices
        </ThemedText>
        <PrimaryButton
          style={styles.button}
          textStyle={{}}
          onPress={() => router.push('/login' as any)}
        >
          Sign In
        </PrimaryButton>
      </ThemedView>
    );
  }

  // Logged in - show profile info
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="subtitle" style={styles.title}>
        Profile
      </ThemedText>
      
      <View style={styles.profileInfo}>
        <ThemedText type="defaultSemiBold">Email</ThemedText>
        <ThemedText>{user.email}</ThemedText>
        
        {user.user_metadata?.full_name && (
          <>
            <ThemedText type="defaultSemiBold" style={styles.fieldTitle}>Full Name</ThemedText>
            <ThemedText>{user.user_metadata.full_name}</ThemedText>
          </>
        )}
        
        {user.user_metadata?.username && (
          <>
            <ThemedText type="defaultSemiBold" style={styles.fieldTitle}>Username</ThemedText>
            <ThemedText>{user.user_metadata.username}</ThemedText>
          </>
        )}
      </View>

      <SignOutButton />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 16,
  },
  title: {
    marginBottom: 8,
  },
  subtitle: {
    marginBottom: 16,
    opacity: 0.8,
  },
  profileInfo: {
    gap: 8,
    marginBottom: 20,
  },
  fieldTitle: {
    marginTop: 12,
  },
  button: {
    alignSelf: 'flex-start',
    paddingHorizontal: 20,
  },
});