import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { ComponentStyles, CoreColors, Spacing } from '../constants/theme';
import { AuthStateManager } from '../lib/auth-state';
import { supabase } from '../lib/supabase';
import PrimaryButton from './custom_components/PrimaryButton';
import TextInput from './custom_components/TextInput';
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleDeleteAccount = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    
    if (!password.trim()) {
      setErrorMessage('Please enter your password to confirm account deletion.');
      return;
    }

    setDeleting(true);
    try {
      // Re-authenticate user with their password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: password
      });

      if (signInError) {
        setErrorMessage('Incorrect password. Please try again.');
        setDeleting(false);
        return;
      }

      // Delete the user account
      const { error: deleteError } = await supabase.rpc('delete_user');
      
      if (deleteError) {
        console.error('Delete account error:', deleteError);
        setErrorMessage('Failed to delete account. Please try again or contact support.');
        setDeleting(false);
        return;
      }

      // Clear auth state and show success message
      await AuthStateManager.clearAuthState();
      setSuccessMessage('Your account has been successfully deleted. Redirecting...');
      
      // Redirect after a short delay
      setTimeout(() => {
        router.replace('/login/welcome');
      }, 2000);
      
    } catch (error) {
      console.error('Delete account error:', error);
      setErrorMessage('An unexpected error occurred. Please try again.');
      setDeleting(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setPassword('');
    setErrorMessage('');
    setSuccessMessage('');
  };

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
            minWidth: 140,
            backgroundColor: '#dc3545',
            borderColor: '#c82333'
          }}
          textStyle={{
            color: CoreColors.textPrimary,
            fontWeight: '600'
          }}
          onPress={() => setShowDeleteConfirm(true)}
        >
          Delete Account
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

      {/* Delete Account Section */}
      {!showDeleteConfirm ? (
        <PrimaryButton
          style={{
            alignSelf: 'center',
            paddingHorizontal: Spacing.lg,
            minWidth: 140,
            backgroundColor: '#dc3545',
            borderColor: '#c82333',
            marginBottom: Spacing.md
          }}
          textStyle={{
            color: CoreColors.textPrimary,
            fontWeight: '600'
          }}
          onPress={() => setShowDeleteConfirm(true)}
        >
          Delete Account
        </PrimaryButton>
      ) : (
        <View style={{
          backgroundColor: '#ffeaea',
          padding: Spacing.md,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: '#dc3545',
          marginBottom: Spacing.md
        }}>
          <ThemedText style={{
            color: '#721c24',
            fontWeight: '600',
            fontSize: 16,
            textAlign: 'center',
            marginBottom: Spacing.sm
          }}>
            ⚠️ Delete Account
          </ThemedText>
          <ThemedText style={{
            color: '#721c24',
            fontSize: 14,
            textAlign: 'center',
            marginBottom: Spacing.md,
            lineHeight: 20
          }}>
            This action cannot be undone. Enter your password to confirm:
          </ThemedText>
          
          <TextInput
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={{
              marginBottom: Spacing.md
            }}
          />
          
          {/* Error Message */}
          {errorMessage ? (
            <View style={{
              backgroundColor: '#f8d7da',
              borderColor: '#f1aeb5',
              borderWidth: 1,
              borderRadius: 6,
              padding: Spacing.sm,
              marginBottom: Spacing.md
            }}>
              <ThemedText style={{
                color: '#721c24',
                fontSize: 14,
                textAlign: 'center',
                fontWeight: '500'
              }}>
                ❌ {errorMessage}
              </ThemedText>
            </View>
          ) : null}
          
          {/* Success Message */}
          {successMessage ? (
            <View style={{
              backgroundColor: '#d1edff',
              borderColor: '#bee5eb',
              borderWidth: 1,
              borderRadius: 6,
              padding: Spacing.sm,
              marginBottom: Spacing.md
            }}>
              <ThemedText style={{
                color: '#0c5460',
                fontSize: 14,
                textAlign: 'center',
                fontWeight: '500'
              }}>
                ✅ {successMessage}
              </ThemedText>
            </View>
          ) : null}
          
          <View style={{
            flexDirection: 'row',
            gap: Spacing.sm,
            justifyContent: 'center'
          }}>
            <PrimaryButton
              style={{
                backgroundColor: '#6c757d',
                borderColor: '#5a6268',
                paddingHorizontal: Spacing.md,
                flex: 1
              }}
              textStyle={{
                color: CoreColors.textPrimary,
                fontWeight: '600'
              }}
              onPress={cancelDelete}
              disabled={deleting}
            >
              Cancel
            </PrimaryButton>
            
            <PrimaryButton
              style={{
                backgroundColor: deleting ? '#6c757d' : '#dc3545',
                borderColor: deleting ? '#6c757d' : '#c82333',
                paddingHorizontal: Spacing.md,
                flex: 1,
                opacity: deleting ? 0.6 : 1
              }}
              textStyle={{
                color: CoreColors.textPrimary,
                fontWeight: '600'
              }}
              onPress={handleDeleteAccount}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Confirm Delete'}
            </PrimaryButton>
          </View>
        </View>
      )}

      <SignOutButton />
    </View>
  );
}