import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { Card, Heading, Paragraph, ScrollView, Spinner, YStack } from 'tamagui';
import CredentialConfirmModal from '../components/modals/CredentialConfirmModal';
import UserProfile from '../components/settings/user-profile';
import { AppButton } from '../components/ui';
import { AuthStateManager } from '../lib/auth-state';
import { supabase } from '../lib/database/supabase';
import { usersDB } from '../lib/database/users';
import { deleteUserAccount, signOutUser } from '../lib/settings';
import { logger } from '../lib/utils/logger';

export default function SettingsPage() {
  const router = useRouter();
  // Removed unused 'user' state
  const [profile, setProfile] = useState<any>(null); // db profile
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [buttonDisabled, setButtonDisabled] = useState(false);
  const [buttonDeleteDisabled, setButtonDeleteDisabled] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    // Check authentication first
    const checkAuth = async () => {
      try {
        const isAuth = await AuthStateManager.isAuthenticated();
        if (!isAuth) {
          logger.debug('settings', 'User not authenticated, redirecting');
          router.replace('/login/welcome');
          return;
        }
      } catch (error) {
        logger.error('settings', 'Settings auth check error:', error);
        router.replace('/login/welcome');
        return;
      }
    };

    checkAuth();

    // Get current session user
    supabase.auth.getUser().then((res: { data?: { user?: User | null }; error?: any }) => {
      // setUser(res.data?.user ?? null); // Removed unused user state
      setLoading(false);
    }).catch((err: unknown) => {
      logger.error('settings', 'Error fetching user on settings mount:', err);
      setLoading(false);
    });
    // Get current db profile
    usersDB.getCurrentUser().then((profile) => {
      setProfile(profile ?? null);
    }).catch((err: unknown) => {
      logger.error('settings', 'Error fetching profile on settings mount:', err);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      // event can be 'SIGNED_IN', 'SIGNED_OUT', etc.
      // Removed setUser since user state is unused
      
      // If user signs out, redirect to welcome
      if (event === 'SIGNED_OUT') {
        router.replace('/login/welcome');
      }
    });

    return () => subscription.unsubscribe();
  }, [router]); // Removed 'user' from dependencies to prevent redirect loop

  const handleSignOutConfirm = async () => {
    if (buttonDisabled) return; // Prevent spam clicking
    
    if (!signingOut) {
      // First click - show confirmation state
      setSigningOut(true);
      setButtonDisabled(true);
      
      // Re-enable button after 2 seconds
      setTimeout(() => {
        setButtonDisabled(false);
      }, 1500);
    } else {
      // Second click - actually sign out
      setButtonDisabled(true);
      try {
        await signOutUser();
        router.replace('/login/welcome');
      } catch (error) {
        logger.error('settings', 'Sign out error:', error);
        Alert.alert('Error', 'Failed to sign out. Please try again.');
        setSigningOut(false);
        setButtonDisabled(false);
      }
    }
  };
  const handleDeleteConfirm = async () => {
    if (buttonDeleteDisabled) return; // Prevent spam clicking

    if (!confirmDelete) {
      // First click - set confirm state and temporarily disable
      setConfirmDelete(true);
      setButtonDeleteDisabled(true);
      setTimeout(() => {
        setButtonDeleteDisabled(false);
      }, 1500);
      return;
    }

    // Second click - open modal, keep button disabled to prevent double open
    setButtonDeleteDisabled(true);
    setShowDeleteModal(true);
  };

  // Called when modal confirms with a password
  const handleDeleteAccount = async (password: string) => {
    setDeleteError('');
    setDeleting(true);
    
    try {
      // Call the account deletion service
      const result = await deleteUserAccount(password);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete account');
      }

      // Success - close modal and redirect
      setShowDeleteModal(false);
      router.replace('/login/welcome');
      
    } catch (error: any) {
      logger.error('settings', 'Delete account error:', error);
      setDeleteError(error?.message || 'Failed to delete account. Please try again.');
      
      // Reset button state on error so user can try again
      setButtonDeleteDisabled(false);
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  const handleCloseDeleteModal = () => {
    setShowDeleteModal(false);
    setConfirmDelete(false);
    setButtonDeleteDisabled(false);
    setDeleteError('');
  };

  if (loading) {
    return (
      <YStack style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Spinner size="large" color="$color" />
        <Paragraph size="$4" style={{ marginTop: 12 }}>
          Loading Settings...
        </Paragraph>
      </YStack>
    );
  }

  return (
    <YStack style={{ flex: 1 }}>
      <ScrollView>
        <YStack style={{ padding: 16, paddingBottom: 32 }}>
        {/* User Profile Section */}
        <YStack style={{ marginBottom: 8 }}>
          <UserProfile profile={profile} />
        </YStack>

        {/* App Settings Section */}
        <Card style={{ padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#ccc' }}>
          <Heading size="$8" style={{ textAlign: 'center', marginBottom: 12 }}>App Settings</Heading>
          <Paragraph size="$4" style={{ textAlign: 'center', opacity: 0.8 }}>
            🎲 Coming Soon: Theme settings, backup options, and more!
          </Paragraph>
        </Card>

        {/* Action Buttons */}
        <YStack style={{ marginTop: 24, alignItems: 'center' }}>
          <AppButton
            variant="destructive"
            size="md"
            style={{ borderRadius: 12, paddingHorizontal: 24, width: 220, opacity: buttonDisabled ? 0.7 : 1 }}
            onPress={handleSignOutConfirm}
            disabled={buttonDisabled}
          >
            {signingOut ? 'Confirm Sign Out' : 'Sign Out'}
          </AppButton>
        </YStack>

        <YStack style={{ marginTop: 16, alignItems: 'center' }}>
          <AppButton
            variant="destructive"
            size="md"
            style={{ borderRadius: 12, paddingHorizontal: 24, width: 220, opacity: buttonDeleteDisabled ? 0.7 : 1 }}
            onPress={handleDeleteConfirm}
            disabled={buttonDeleteDisabled}
          >
            {confirmDelete ? 'Confirm Delete' : 'Delete Account'}
          </AppButton>
        </YStack>
        </YStack>
      </ScrollView>

      {/* Delete confirmation modal */}
      <CredentialConfirmModal
        visible={showDeleteModal}
        title="Confirm Account Deletion"
        message={'This action is permanent. Please enter your password to confirm you want to delete your account. '}
        confirmLabel="Delete Account"
        destructive
        loading={deleting}
        errorText={deleteError}
        onCancel={handleCloseDeleteModal}
        onConfirm={handleDeleteAccount}
      />
    </YStack>
  );
}