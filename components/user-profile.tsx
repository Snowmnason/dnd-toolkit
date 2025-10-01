import { useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { ComponentStyles, CoreColors, Spacing } from '../constants/theme';
import PrimaryButton from './custom_components/PrimaryButton';
import SignOutButton from './social-auth-buttons/sign-out-button';
import { ThemedText } from './themed-text';

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
      <View style={ComponentStyles.card.default}>
        <ThemedText type="subtitle" style={{
          marginBottom: Spacing.xs,
          fontSize: 24,
          fontWeight: '600',
          color: CoreColors.textOnLight,
          textAlign: 'center'
        }}>
          Account
        </ThemedText>
        <ThemedText style={{
          marginBottom: Spacing.md,
          opacity: 0.8,
          color: CoreColors.textSecondary,
          textAlign: 'center',
          fontSize: 16,
          lineHeight: 22
        }}>
          Sign in to sync your D&D worlds across devices
        </ThemedText>
        <PrimaryButton
          style={{
            alignSelf: 'center',
            paddingHorizontal: Spacing.lg,
            minWidth: 140
          }}
          textStyle={{}}
          onPress={() => router.push('/login' as any)}
        >
          Sign In
        </PrimaryButton>
      </View>
    );
  }

  // Logged in - show profile info
  return (
    <View style={ComponentStyles.card.default}>
      <ThemedText type="subtitle" style={{
        marginBottom: Spacing.sm,
        fontSize: 24,
        fontWeight: '600',
        color: CoreColors.textOnLight,
        textAlign: 'center'
      }}>
        Profile
      </ThemedText>
      
      <View style={{
        gap: Spacing.xs,
        marginBottom: Spacing.lg,
        backgroundColor: CoreColors.primaryTransparent,
        padding: Spacing.md,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: CoreColors.secondary
      }}>
        {/* Email Field */}
        <View style={{ marginBottom: Spacing.sm }}>
          <ThemedText type="defaultSemiBold" style={{
            color: CoreColors.textOnLight,
            fontSize: 16,
            marginBottom: 4
          }}>
            Email
          </ThemedText>
          <ThemedText style={{
            color: CoreColors.textSecondary,
            fontSize: 15,
            fontStyle: 'italic'
          }}>
            {user.email}
          </ThemedText>
        </View>
        
        {/* Full Name Field */}
        {user.user_metadata?.full_name && (
          <View style={{ marginBottom: Spacing.sm }}>
            <ThemedText type="defaultSemiBold" style={{
              color: CoreColors.textOnLight,
              fontSize: 16,
              marginBottom: 4
            }}>
              Full Name
            </ThemedText>
            <ThemedText style={{
              color: CoreColors.textSecondary,
              fontSize: 15,
              fontStyle: 'italic'
            }}>
              {user.user_metadata.full_name}
            </ThemedText>
          </View>
        )}
        
        {/* Username Field */}
        {user.user_metadata?.username && (
          <View style={{ marginBottom: Spacing.sm }}>
            <ThemedText type="defaultSemiBold" style={{
              color: CoreColors.textOnLight,
              fontSize: 16,
              marginBottom: 4
            }}>
              Username
            </ThemedText>
            <ThemedText style={{
              color: CoreColors.textSecondary,
              fontSize: 15,
              fontStyle: 'italic'
            }}>
              {user.user_metadata.username}
            </ThemedText>
          </View>
        )}
      </View>

      <SignOutButton />
    </View>
  );
}