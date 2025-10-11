import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import CustomLoad from '../../components/custom_components/CustomLoad';
import CustomModal from '../../components/CustomModal';
import { ThemedText } from '../../components/themed-text';
import { AuthStateManager } from '../../lib/auth-state';
import { worldsDB } from '../../lib/database/worlds';
import { supabase } from '../../lib/supabase';

// Storage for pending invites when user isn't logged in
const PENDING_INVITE_KEY = 'pending_world_invite';

interface PendingInvite {
  token: string;
  worldName: string;
  timestamp: number;
}

// Helper functions for invite storage
const savePendingInvite = (token: string, worldName: string) => {
  if (typeof window !== 'undefined') {
    const inviteData: PendingInvite = {
      token,
      worldName,
      timestamp: Date.now()
    };
    localStorage.setItem(PENDING_INVITE_KEY, JSON.stringify(inviteData));
  }
};

const getPendingInvite = (): PendingInvite | null => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(PENDING_INVITE_KEY);
    if (stored) {
      const inviteData: PendingInvite = JSON.parse(stored);
      // Check if invite is less than 24 hours old
      if (Date.now() - inviteData.timestamp < 24 * 60 * 60 * 1000) {
        return inviteData;
      } else {
        // Clean up expired invite
        localStorage.removeItem(PENDING_INVITE_KEY);
      }
    }
  }
  return null;
};

const clearPendingInvite = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(PENDING_INVITE_KEY);
  }
};

export default function AuthRedirect() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [processing, setProcessing] = useState(true);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showAlreadyMemberModal, setShowAlreadyMemberModal] = useState(false);
  const [worldName, setWorldName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleAuthRedirect = async () => {
      try {
        const action = params.action as string;
        console.log('🔄 Auth redirect action:', action);

        // First, handle any auth tokens from the URL
        let hasValidSession = false;
        if (typeof window !== 'undefined') {
          const hash = window.location.hash;
          if (hash) {
            const hashParams = new URLSearchParams(hash.substring(1));
            const accessToken = hashParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token');

            if (accessToken && refreshToken) {
              console.log('🔑 Setting session from email link...');
              
              const { error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken
              });

              if (error) {
                console.error('❌ Session error:', error);
                setErrorMessage('Invalid or expired link. Please try again.');
                setShowErrorModal(true);
                return;
              }

              console.log('✅ Session established');
              await AuthStateManager.setHasAccount(true);
              hasValidSession = true;
            }
          }
        }

        // Check if user already has a session (for direct visits)
        if (!hasValidSession) {
          const { data: { session } } = await supabase.auth.getSession();
          hasValidSession = !!session;
        }

        // Route based on action
        switch (action) {
          case 'signup-confirm':
            // User confirmed email from signup -> go to complete profile
            console.log('📝 Redirecting to complete profile...');
            router.replace('/login/complete-profile');
            break;
          
          case 'reset-password':
            // User clicked password reset link -> go to reset password page
            console.log('🔐 Redirecting to reset password...');
            router.replace('/login/reset-password');
            break;
          
          case 'world-invite':
            await handleWorldInvite(hasValidSession);
            break;
          
          default:
            // Check for pending invites when user visits any auth page
            await checkForPendingInvites();
            
            // Fallback routing for legacy links
            if (action === 'signin') {
              router.replace('/login/sign-in');
            } else if (action === 'signup') {
              router.replace('/login/sign-up');
            } else {
              router.replace('/login/welcome');
            }
        }
      } catch (error) {
        console.error('Auth redirect error:', error);
        setErrorMessage('Something went wrong. Please try again.');
        setShowErrorModal(true);
      } finally {
        setProcessing(false);
      }
    };

    const handleWorldInvite = async (hasValidSession: boolean) => {
      console.log('🌍 Processing world invite...');
      
      const inviteToken = params.token as string;
      const inviteWorldName = params.worldName as string;

      if (!inviteToken || !inviteWorldName) {
        setErrorMessage('Invalid invite link. Please ask for a new invitation.');
        setShowErrorModal(true);
        return;
      }

      const decodedWorldName = decodeURIComponent(inviteWorldName);

      // Import invitesDB dynamically to avoid circular dependencies
      const { invitesDB } = await import('../../lib/database/invites');

      // Validate the invite token first
      console.log('🔍 Validating invite token...');
      const validationResult = await invitesDB.validateInviteToken(inviteToken);

      if (!validationResult.success || !validationResult.worldId) {
        setErrorMessage(validationResult.error || 'This invite link is invalid or has expired. Please ask for a new invitation.');
        setShowErrorModal(true);
        return;
      }

      const inviteWorldId = validationResult.worldId;

      if (!hasValidSession) {
        // User not logged in - save invite token and redirect to sign in
        console.log('💾 Saving pending invite for after login...');
        savePendingInvite(inviteToken, decodedWorldName);
        
        setWorldName(decodedWorldName);
        setShowInviteModal(true);
        return;
      }

      // User is logged in - process invite immediately
      console.log('✅ User logged in, processing invite...');
      
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          throw new Error('No authenticated user found');
        }

        // Get user's profile ID
        const { data: userProfile } = await supabase
          .from('users')
          .select('id')
          .eq('auth_id', user.id)
          .single();

        if (!userProfile) {
          throw new Error('User profile not found');
        }

        // Check if user is already in the world
        console.log('🔍 Checking if user is already in world...');
        const isAlreadyMember = await worldsDB.isUserInWorld(inviteWorldId, userProfile.id);

        if (isAlreadyMember) {
          console.log('ℹ️ User is already a member of this world');
          setWorldName(decodedWorldName);
          setShowAlreadyMemberModal(true);
          return;
        }

        // Add user to world in database
        console.log('🎲 Adding user to world:', inviteWorldId);
        await worldsDB.addUserToWorld(inviteWorldId, userProfile.id, 'player');
        console.log('✅ User successfully added to world');
        
        setWorldName(decodedWorldName);
        setShowWelcomeModal(true);
        
      } catch (error) {
        console.error('❌ Failed to add user to world:', error);
        
        // Check if user is already in the world (database constraint error)
        if (error instanceof Error && error.message.includes('duplicate')) {
          console.log('ℹ️ User already in world (duplicate key), showing already member modal');
          setWorldName(decodedWorldName);
          setShowAlreadyMemberModal(true);
        } else {
          // Other error - show error message
          setErrorMessage('Failed to join world. Please try again or contact the world owner.');
          setShowErrorModal(true);
        }
      }
    };

    const checkForPendingInvites = async () => {
      const pendingInvite = getPendingInvite();
      if (pendingInvite) {
        console.log('🔍 Found pending invite:', pendingInvite);
        
        // Check if user is now logged in
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          console.log('✅ User logged in, processing pending invite...');
          clearPendingInvite();
          
          try {
            // Import invitesDB dynamically
            const { invitesDB } = await import('../../lib/database/invites');
            
            // Validate the token and get worldId
            console.log('🔍 Validating pending invite token...');
            const validationResult = await invitesDB.validateInviteToken(pendingInvite.token);
            
            if (!validationResult.success || !validationResult.worldId) {
              throw new Error(validationResult.error || 'Invalid or expired invite token');
            }

            // Get user's profile ID
            const { data: userProfile } = await supabase
              .from('users')
              .select('id')
              .eq('auth_id', session.user.id)
              .single();

            if (!userProfile) {
              throw new Error('User profile not found');
            }

            // Check if user is already in the world
            console.log('🔍 Checking if user is already in world...');
            const isAlreadyMember = await worldsDB.isUserInWorld(validationResult.worldId, userProfile.id);

            if (isAlreadyMember) {
              console.log('ℹ️ User is already a member of this world (pending invite)');
              setWorldName(pendingInvite.worldName);
              setShowAlreadyMemberModal(true);
              return;
            }

            // Add user to world in database
            console.log('🎲 Adding user to world from pending invite:', validationResult.worldId);
            await worldsDB.addUserToWorld(validationResult.worldId, userProfile.id, 'player');
            console.log('✅ User successfully added to world from pending invite');
            
            setWorldName(pendingInvite.worldName);
            setShowWelcomeModal(true);
            
          } catch (error) {
            console.error('❌ Failed to add user to world from pending invite:', error);
            
            // Check if user is already in the world (database constraint error)
            if (error instanceof Error && error.message.includes('duplicate')) {
              console.log('ℹ️ User already in world from pending invite (duplicate key), showing already member modal');
              setWorldName(pendingInvite.worldName);
              setShowAlreadyMemberModal(true);
            } else {
              // Other error - show error message but don't completely fail
              console.error('Failed to process pending invite, but continuing...');
              
              // Don't show success modal if invite was invalid/expired
              if (error instanceof Error && (error.message.includes('Invalid') || error.message.includes('expired'))) {
                setErrorMessage('This invite link has expired. Please ask for a new invitation.');
                setShowErrorModal(true);
              }
            }
          }
        }
      }
    };

    handleAuthRedirect();
  }, [params, router]);

  const handleWelcomeModalClose = () => {
    setShowWelcomeModal(false);
    // Clean redirect to world selection (removes all URL params)
    router.replace('/select/world-selection');
  };

  const handleInviteModalSignIn = () => {
    setShowInviteModal(false);
    router.replace('/login/sign-in');
  };

  const handleInviteModalSignUp = () => {
    setShowInviteModal(false);
    router.replace('/login/sign-up');
  };

  if (processing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#2f353d' }}>
        <CustomLoad size="large" />
        <ThemedText style={{ marginTop: 16, color: '#F5E6D3', textAlign: 'center' }}>
          Processing authentication...
        </ThemedText>
      </View>
    );
  }

  return (
    <>
      {/* World Invite Welcome Modal (for successfully joined worlds) */}
      <CustomModal
        visible={showWelcomeModal}
        onClose={handleWelcomeModalClose}
        title="Welcome to the Adventure! 🎲"
        message={`You joined "${worldName}" successfully! Welcome to the party!`}
        buttons={[
          {
            text: 'Continue to Worlds',
            onPress: handleWelcomeModalClose,
            style: 'primary'
          }
        ]}
      />

      {/* World Invite Login Required Modal (for non-logged-in users) */}
      <CustomModal
        visible={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title="Join the Adventure! 🎲"
        message={`You've been invited to join "${worldName}"! Please sign in to your account to accept this invitation. Your invite will be saved and processed after you log in.`}
        buttons={[
          {
            text: 'Sign In',
            onPress: handleInviteModalSignIn,
            style: 'primary'
          },
          {
            text: 'Create Account',
            onPress: handleInviteModalSignUp,
            style: 'default'
          },
          {
            text: 'Maybe Later',
            onPress: () => {
              clearPendingInvite();
              setShowInviteModal(false);
              router.replace('/login/welcome');
            },
            style: 'cancel'
          }
        ]}
      />

      {/* Already a Member Modal */}
      <CustomModal
        visible={showAlreadyMemberModal}
        onClose={() => {
          setShowAlreadyMemberModal(false);
          router.replace('/select/world-selection');
        }}
        title="Already a Member! 🎉"
        message={`You're already part of "${worldName}"! No need to join again.`}
        buttons={[
          {
            text: 'Go to Worlds',
            onPress: () => {
              setShowAlreadyMemberModal(false);
              router.replace('/select/world-selection');
            },
            style: 'primary'
          }
        ]}
      />

      {/* Error Modal */}
      <CustomModal
        visible={showErrorModal}
        onClose={() => {
          setShowErrorModal(false);
          router.replace('/login/welcome');
        }}
        title="Oops! ⚠️"
        message={errorMessage}
        buttons={[
          {
            text: 'OK',
            onPress: () => {
              setShowErrorModal(false);
              router.replace('/login/welcome');
            },
            style: 'primary'
          }
        ]}
      />
      
      <View style={{ flex: 1, backgroundColor: '#2f353d' }} />
    </>
  );
}