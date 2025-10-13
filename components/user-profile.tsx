import { logger } from '@/lib/utils/logger';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { ComponentStyles, CoreColors, Spacing } from '../constants/theme';
import { usersDB } from '../lib/database/users';
import PrimaryButton from './custom_components/PrimaryButton';
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
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Fetch user profile from database
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) {
        setLoadingProfile(false);
        return;
      }
      
      try {
        const profile = await usersDB.getCurrentUser();
        setUserProfile(profile);
      } catch (error) {
        logger.error('user-profile', 'Error fetching user profile:', error);
      } finally {
        setLoadingProfile(false);
      }
    };

    fetchUserProfile();
  }, [user]);

  if (!user) {
    // This shouldn't happen in normal flow since settings requires authentication
    // But show a fallback just in case
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
          Unable to load profile information
        </ThemedText>
        <PrimaryButton
          style={{
            alignSelf: 'center',
            paddingHorizontal: Spacing.lg,
            minWidth: 140,
            backgroundColor: CoreColors.primary,
            borderColor: CoreColors.primaryDark
          }}
          textStyle={{
            color: CoreColors.textPrimary,
            fontWeight: '600'
          }}
          onPress={() => router.replace('/login/welcome')}
        >
          Return to Login
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
        
        {/* Username Field - from database */}
        {userProfile?.username && (
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
              {userProfile.username}
            </ThemedText>
          </View>
        )}
        
        {/* Display Name Field - from database */}
        {userProfile?.display_name && (
          <View style={{ marginBottom: Spacing.sm }}>
            <ThemedText type="defaultSemiBold" style={{
              color: CoreColors.textOnLight,
              fontSize: 16,
              marginBottom: 4
            }}>
              Display Name
            </ThemedText>
            <ThemedText style={{
              color: CoreColors.textSecondary,
              fontSize: 15,
              fontStyle: 'italic'
            }}>
              {userProfile.display_name}
            </ThemedText>
          </View>
        )}
        
        {/* Show loading state */}
        {loadingProfile && (
          <View style={{ marginBottom: Spacing.sm }}>
            <ThemedText style={{
              color: CoreColors.textSecondary,
              fontSize: 14,
              fontStyle: 'italic',
              textAlign: 'center'
            }}>
              Loading profile...
            </ThemedText>
          </View>
        )}
        
      </View>
    </View>
  );
}