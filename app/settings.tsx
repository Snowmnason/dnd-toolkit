import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import CustomLoad from '../components/custom_components/CustomLoad';
import PrimaryButton from '../components/custom_components/PrimaryButton';
import CredentialConfirmModal from '../components/modals/CredentialConfirmModal';
import { ThemedText } from '../components/themed-text';
import { ThemedView } from '../components/themed-view';
import UserProfile from '../components/user-profile';
import { ComponentStyles, CoreColors, Spacing } from '../constants/theme';
import { AuthStateManager } from '../lib/auth-state';
import { usersDB } from '../lib/database/users';
import { deleteUserAccount, signOutUser } from '../lib/settings';
import { supabase } from '../lib/supabase';
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
        <View style={{ marginBottom: Spacing.sm }}>
          <UserProfile profile={profile} />
        </View>

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
                <View style={{
          marginTop: Spacing.xl,
          gap: Spacing.md,
          alignItems: 'center'
        }}>
          {/* Sign Out Button */}
          <PrimaryButton
            style={{
              backgroundColor: buttonDeleteDisabled ? '#6c757d' : '#dc3545',
              paddingHorizontal: Spacing.xl,
              minWidth: 200,
              borderColor: buttonDeleteDisabled ? '#6c757d' : '#c82333',
              opacity: buttonDeleteDisabled ? 0.6 : 1
            }}
            textStyle={{ 
              color: CoreColors.textPrimary,
              fontWeight: '600'
            }}
            onPress={handleDeleteConfirm}
            disabled={buttonDeleteDisabled}
          >
            {confirmDelete ? 'Confirm Delete' : 'Delete Account'}
          </PrimaryButton>
        </View>
      </ScrollView>

      {/* Delete confirmation modal */}
      {/* Note: This is a generic password-confirm modal you can reuse elsewhere */}
      <CredentialConfirmModal
        visible={showDeleteModal}
        title="Confirm Account Deletion"
        message={
          'This action is permanent. Please enter your password to confirm you want to delete your account. '
        }
        confirmLabel="Delete Account"
        destructive
        loading={deleting}
        errorText={deleteError}
        onCancel={handleCloseDeleteModal}
        onConfirm={handleDeleteAccount}
      />
    </ThemedView>
  );
}