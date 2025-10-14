import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import AuthButton from '../../components/auth_components/AuthButton';
import AuthError from '../../components/auth_components/AuthError';
import AuthInput from '../../components/auth_components/AuthInput';
import PrimaryButton from '../../components/custom_components/PrimaryButton';
import { ThemedText } from '../../components/themed-text';
import { useSignUpForm } from '../../lib/auth';
import { usersDB } from '../../lib/database/users';
import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/utils/logger';

export default function CompleteProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [initializing, setInitializing] = useState(true);

  // Check if user is authenticated and needs to complete profile
  useEffect(() => {
    const checkAuthAndProfile = async () => {
      logger.info('complete-profile', 'Starting auth and profile check');
      try {
        // First check Supabase auth session
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        logger.debug('complete-profile', 'Auth user check result:', { 
          hasAuthUser: !!authUser, 
          authUserId: authUser?.id,
          authError: authError?.message 
        });

        if (authError) {
          logger.error('complete-profile', 'Auth session error:', authError);
          router.replace('/login/sign-in');
          return;
        }

        if (!authUser) {
          logger.warn('complete-profile', 'No authenticated user found, redirecting to sign-in');
          router.replace('/login/sign-in');
          return;
        }

        // Try to get existing profile (might not exist for new users)
        logger.debug('complete-profile', 'Fetching user profile from database');
        const existingProfile = await usersDB.getCurrentUser();
        logger.info('complete-profile', 'Profile fetch result:', { 
          hasProfile: !!existingProfile,
          profileId: existingProfile?.id,
          profileUsername: existingProfile?.username,
          profileAuthId: existingProfile?.auth_id
        });

        if (existingProfile) {
          // Profile exists - check if it's complete
          setUser(existingProfile);
        } else {
          // No profile exists - this is expected for new users
          // Use the auth user data to create the profile
          logger.info('complete-profile', 'No database profile found - this is expected for new users');
          setUser(authUser);
        }
        
        // Robust profile validation - only redirect if profile is truly complete
        const hasValidProfile = existingProfile && 
                               existingProfile.username && 
                               existingProfile.username.trim().length > 0;
        
        logger.debug('complete-profile', 'Profile validation:', { 
          hasValidProfile,
          hasExistingProfile: !!existingProfile,
          username: existingProfile?.username,
          usernameLength: existingProfile?.username?.length
        });

        if (hasValidProfile) {
          logger.info('complete-profile', 'User already has complete profile, redirecting to world selection');
          router.replace({
            pathname: '/select/world-selection',
            params: { userId: existingProfile.id }
          });
          return;
        }
        logger.info('complete-profile', 'User needs to complete profile, staying on this screen');
      } catch (error) {
        logger.error('complete-profile', 'Auth check error:', error);
        router.replace('/login/sign-in');
      } finally {
        setInitializing(false);
        logger.debug('complete-profile', 'Auth check completed, initializing set to false');
      }
    };
    
    checkAuthAndProfile();
  }, [router]);

  // Use the unified form hook in complete-profile mode
  const {
    // Only need username-related data in this mode
    username,
    loading,
    authError,
    usernameValidation,
    isFormValid,
    
    // Handlers
    handleSignUp: handleCompleteProfile,
    handleUsernameChange,
    
    // UI helpers
    getUsernameDisplayText,
  } = useSignUpForm('complete-profile', user);

  // Show loading while checking authentication
  if (initializing || !user) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#2f353d' }}>
        <ThemedText style={{ color: '#F5E6D3' }}>
          {initializing ? 'Checking authentication...' : 'Loading...'}
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#2f353d' }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: 'transparent' }}>
        
        <ThemedText 
          type="title" 
          style={{ marginBottom: 20, textAlign: 'center', color: '#F5E6D3', fontSize: 32, fontWeight: '700' }}
        >
          Complete Your Profile
        </ThemedText>
        
        <ThemedText style={{ marginBottom: 40, textAlign: 'center', fontSize: 16, opacity: 0.8, color: '#F5E6D3', lineHeight: 22, paddingHorizontal: 20 }}>
          Choose a username to complete your account setup
        </ThemedText>

        {/* Welcome Message */}
        <View style={{ backgroundColor: 'rgba(245, 230, 211, 0.95)', padding: 24, borderRadius: 12, marginBottom: 32, borderWidth: 2, borderColor: '#8B4513', maxWidth: 350 }}>
          <ThemedText 
            style={{ textAlign: 'center', color: '#8B4513', fontWeight: '600', marginBottom: 8, fontSize: 16 }}
          >
            Welcome, {username ? username : 'Adventurer'}!
          </ThemedText>
          <ThemedText 
            style={{ textAlign: 'center', color: '#8B4513', lineHeight: 20, fontSize: 14 }}
          >
            There will be more added soon to customize your profile more.
          </ThemedText>
        </View>

        {/* Form Input */}
        <View style={{ width: '100%', maxWidth: 300, marginBottom: 15, backgroundColor: 'transparent' }}>
          <AuthInput
            placeholder="Username"
            value={username}
            onChangeText={handleUsernameChange}
            autoCapitalize="none"
            editable={!loading}
            style={{
              borderColor: !usernameValidation.isValid && username.length > 0 ? '#dc3545' : undefined,
              borderWidth: !usernameValidation.isValid && username.length > 0 ? 2 : undefined
            }}
          />

          {/* Authentication Error Display */}
          <AuthError error={authError} />

          {/* Username Requirements */}
          {username.length > 0 && (
            <View style={{ marginBottom: 4, marginTop: -14 }}>
              <ThemedText 
                style={{ 
                  textAlign: 'left', 
                  fontSize: 11, 
                  color: usernameValidation.isValid ? '#A3D4A0' : '#F5A5A5', 
                  fontWeight: '500', 
                  lineHeight: 16,
                  opacity: 0.9
                }}
              >
                {getUsernameDisplayText()}
              </ThemedText>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={{ width: '100%', maxWidth: 300, gap: 16, backgroundColor: 'transparent' }}>
          {/* Complete Profile Button */}
          <AuthButton
            title="Complete Profile"
            onPress={handleCompleteProfile}
            disabled={!isFormValid}
            loading={loading}
          />

          {/* Sign Out Button */}
          <PrimaryButton
            style={{ 
              width: '100%', 
              backgroundColor: 'rgba(139, 69, 19, 0.15)', 
              borderWidth: 1, 
              borderColor: '#8B4513', 
              paddingVertical: 12, 
              borderRadius: 8,
              opacity: loading ? 0.5 : 1
            }}
            textStyle={{ color: '#F5E6D3', fontSize: 13, fontWeight: '500' }}
            onPress={async () => {
              try {
                await supabase.auth.signOut();
                router.replace('/login/welcome');
              } catch {
                Alert.alert('Error', 'Failed to sign out');
              }
            }}
            disabled={loading}
          >
            Sign Out
          </PrimaryButton>
        </View>

        <ThemedText style={{ marginTop: 30, textAlign: 'center', fontSize: 12, opacity: 0.6, color: '#F5E6D3', lineHeight: 18, paddingHorizontal: 20 }}>
          Your username will be used for online games and friend connections.
        </ThemedText>
        
        <ThemedText style={{ marginTop: 8, textAlign: 'center', fontSize: 11, opacity: 0.5, color: '#F5E6D3', lineHeight: 16, paddingHorizontal: 20 }}>
          © 2025 The Snow Post · Forged for storytellers & adventurers
        </ThemedText>
      </View>
    </View>
  );
}