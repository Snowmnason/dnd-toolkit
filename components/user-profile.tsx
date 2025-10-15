import { logger } from '@/lib/utils/logger';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { CoreColors } from '../constants/corecolors';
import { ComponentStyles, Spacing } from '../constants/theme';
import { updateUsername } from '../lib/settings';
import PrimaryButton from './custom_components/PrimaryButton';
import UpdateUsernameModal from './modals/UpdateUsernameModal';
import { ThemedText } from './themed-text';

interface UserProfileProps {
  profile?: {
    id?: string;
    username?: string;
  } | null;
}

export default function UserProfile({ profile }: UserProfileProps) {
  const router = useRouter();
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [updatingUsername, setUpdatingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState('');

  // Fetch session user for email
  useEffect(() => {
    const fetchSessionUser = async () => {
      try {
        const { supabase } = await import('../lib/supabase');
        const { data: { user } } = await supabase.auth.getUser();
        setSessionUser(user);
      } catch (error) {
        logger.error('user-profile', 'Error fetching session user:', error);
      } finally {
        setLoadingSession(false);
      }
    };

    fetchSessionUser();
  }, []);

  const handleUpdateUsername = async (newUsername: string) => {
    setUsernameError('');
    setUpdatingUsername(true);
    
    try {
      const result = await updateUsername(newUsername);
      
      if (!result.success) {
        setUsernameError(result.error || 'Failed to update username');
        return;
      }
      
      // Success - close modal and refresh page
      setShowUsernameModal(false);
      logger.info('user-profile', 'Username updated successfully');
      
      // Refresh the page to show new username
      window.location.reload();
      
    } catch (error: any) {
      logger.error('user-profile', 'Username update error:', error);
      setUsernameError(error?.message || 'Failed to update username');
    } finally {
      setUpdatingUsername(false);
    }
  };

  if (!profile && !loadingSession) {
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
      <ThemedText type="title" style={{
        marginBottom: Spacing.sm,
        fontWeight: '600',
        color: CoreColors.textOnLight,
        textAlign: 'center'
      }}>
        Profile
      </ThemedText>
      
      <View style={{
        gap: Spacing.xs,
        marginBottom: Spacing.lg,
        backgroundColor: 'rgba(139, 69, 19, 0.1)',
        padding: Spacing.md,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: CoreColors.secondary
      }}>
        {/* Email Field */}
        <View style={{ marginBottom: Spacing.sm }}>
          <ThemedText type="defaultSemiBold" style={{
            color: CoreColors.textOnLight,
            marginBottom: 4
          }}>
            Email
          </ThemedText>
          <ThemedText style={{
            fontStyle: 'italic'
          }}>
            {sessionUser?.email || 'Loading...'}
          </ThemedText>
        </View>
        
        {/* Username Field - from database profile */}
        {profile?.username && (
          <View style={{ marginBottom: Spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <ThemedText type="defaultSemiBold" style={{
                color: CoreColors.textOnLight,
                fontSize: 16,
                marginBottom: 4
              }}>
                Username
              </ThemedText>
              <TouchableOpacity
                onPress={() => setShowUsernameModal(true)}
                style={{
                  padding: 4,
                  borderRadius: 4,
                  backgroundColor: 'rgba(139, 69, 19, 0.1)'
                }}
              >
                <Ionicons name="settings-outline" size={18} color={CoreColors.textOnLight} />
              </TouchableOpacity>
            </View>
            <ThemedText style={{
              fontStyle: 'italic',
            }}>
              {profile.username}
            </ThemedText>
          </View>
        )}
        
        {/* Show loading state */}
        {loadingSession && (
          <View style={{ marginBottom: Spacing.sm }}>
            <ThemedText style={{
              color: CoreColors.textSecondary,
              fontStyle: 'italic',
              textAlign: 'center'
            }}>
              Loading profile...
            </ThemedText>
          </View>
        )}
        
      </View>

      {/* Username Update Modal */}
      {profile?.username && (
        <UpdateUsernameModal
          visible={showUsernameModal}
          currentUsername={profile.username}
          onCancel={() => {
            setShowUsernameModal(false);
            setUsernameError('');
          }}
          onConfirm={handleUpdateUsername}
          loading={updatingUsername}
          errorText={usernameError}
        />
      )}
    </View>
  );
}