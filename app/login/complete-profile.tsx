import {
  AuthActionGroup,
  AuthBody,
  AuthBodyFooter,
  AuthButton,
  AuthButtonSecondary,
  AuthCaption,
  AuthError,
  AuthForm,
  AuthInput,
  AuthRoot,
  AuthSubTitle,
  AuthTitle
} from '@/components/auth_components';
import { Body } from '@/components/ui';
import { logger, supabase, usersDB, useSignUpForm } from '@/lib';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';



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
        <Body color="#F5E6D3" fontSize="$sm">
          {initializing ? 'Checking authentication...' : 'Loading...'}
        </Body>
      </View>
    );
  }

 return (
    <AuthRoot>
      {/* 🧠 Header */}
      <AuthTitle>Complete Your Profile</AuthTitle>

      <AuthBody>
        Choose a username to complete your account setup.
      </AuthBody>

      {/* 🏷️ Welcome Message Card */}
      <View
        style={{
          backgroundColor: 'rgba(245, 230, 211, 0.95)',
          padding: 24,
          borderRadius: 12,
          marginBottom: 32,
          borderWidth: 2,
          borderColor: '#8B4513',
          maxWidth: 350,
        }}
      >
        <View
          style={{
            backgroundColor: 'rgba(245, 230, 211, 0.95)',
            padding: 24,
            borderRadius: 12,
            marginBottom: 32,
            borderWidth: 2,
            borderColor: '#8B4513',
            maxWidth: 350,
          }}
        >
          <AuthBody.InCard style={{ marginBottom: 8 }}>
            Welcome, {username ? username : 'Adventurer'}!
          </AuthBody.InCard>

          <AuthBody.InCard fontSize={14}>
            There will be more added soon to customize your profile more.
          </AuthBody.InCard>
        </View>
      </View>

      {/* 🧾 Form */}
      <AuthForm>
        <AuthInput
          placeholder="Username"
          value={username}
          onChangeText={handleUsernameChange}
          autoCapitalize="none"
          editable={!loading}
          returnKeyType="go"
          onSubmitEditing={handleCompleteProfile}
          style={{
            borderColor:
              !usernameValidation.isValid && username.length > 0
                ? '#dc3545'
                : undefined,
            borderWidth:
              !usernameValidation.isValid && username.length > 0 ? 2 : undefined,
          }}
        />

        <AuthError error={authError} />

        {username.length > 0 && (
          <AuthSubTitle
            style={{
              textAlign: 'left',
              color: usernameValidation.isValid ? '#82cc7eff' : '#f78888ff',
              lineHeight: 16,
              opacity: 0.9,
              marginBottom: 4,
              marginTop: -14,
            }}
          >
            {getUsernameDisplayText()}
          </AuthSubTitle>
        )}
      </AuthForm>

      {/* 🔘 Actions */}
      <AuthActionGroup>
        <AuthButton
          text="Complete Profile"
          onPress={handleCompleteProfile}
          disabled={!isFormValid}
          loading={loading}
        />

        <AuthButtonSecondary
          text="Sign Out"
          onPress={() => router.push('/login/sign-up')}
          disabled={loading}
        />
      </AuthActionGroup>

      {/* 🧩 Footer */}
      <AuthBodyFooter>
        Your username will be used for online games and friend connections.
      </AuthBodyFooter>

      <AuthCaption>
        © 2025 The Snow Post · Forged for storytellers & adventurers
      </AuthCaption>
    </AuthRoot>
  )
}