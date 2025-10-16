import { logger } from '@/lib/utils/logger';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Button, Text, View } from 'tamagui';
import { Spacing } from '../../constants/theme';
import { updateUsername } from '../../lib/settings';
import UpdateUsernameModal from '../modals/UpdateUsernameModal';

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
        const { supabase } = await import('../../lib/database/supabase');
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
      <View style={{ padding: Spacing.sm, borderWidth: 1, borderRadius: 8 }}>
        <Text style={{
          marginBottom: Spacing.xs,
          fontSize: 24,
          fontWeight: '600',
          textAlign: 'center'
        }}>
          Account
        </Text>
        <Text style={{
          marginBottom: Spacing.md,
          opacity: 0.8,
          textAlign: 'center',
          fontSize: 16,
          lineHeight: 22
        }}>
          Unable to load profile information
        </Text>
        <Button
          style={{
            alignSelf: 'center',
            paddingHorizontal: Spacing.lg,
            minWidth: 140,
          }}
          onPress={() => router.replace('/login/welcome')}
        >
          Return to Login
        </Button>
      </View>
    );
  }

  // Logged in - show profile info
  return (
    <View style={{ padding: Spacing.sm, borderWidth: 1, borderRadius: 8 }}>
      <Text style={{
        marginBottom: Spacing.sm,
        fontWeight: '600',
        textAlign: 'center'
      }}>
        Profile
      </Text>
      
      <View style={{
        gap: Spacing.xs,
        marginBottom: Spacing.lg,
        backgroundColor: 'rgba(139, 69, 19, 0.1)',
        padding: Spacing.md,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.2)'
      }}>
        {/* Email Field */}
        <View style={{ marginBottom: Spacing.sm }}>
          <Text style={{
            marginBottom: 4,
            fontWeight: '600'
          }}>
            Email
          </Text>
          <Text style={{
            fontStyle: 'italic'
          }}>
            {sessionUser?.email || 'Loading...'}
          </Text>
        </View>
        
        {/* Username Field - from database profile */}
        {profile?.username && (
          <View style={{ marginBottom: Spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{
                fontSize: 16,
                marginBottom: 4,
                fontWeight: '600'
              }}>
                Username
              </Text>
              <Button unstyled onPress={() => setShowUsernameModal(true)}>
                <Ionicons name="settings-outline" size={18} />
              </Button>
            </View>
            <Text style={{
              fontStyle: 'italic',
            }}>
              {profile.username}
            </Text>
          </View>
        )}
        
        {/* Show loading state */}
        {loadingSession && (
          <View style={{ marginBottom: Spacing.sm }}>
            <Text style={{
              fontStyle: 'italic',
              textAlign: 'center'
            }}>
              Loading profile...
            </Text>
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