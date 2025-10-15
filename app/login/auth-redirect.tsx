import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import CustomLoad from '../../components/custom_components/CustomLoad';
import CustomModal from '../../components/modals/CustomModal';
import { ThemedText } from '../../components/themed-text';
import { useAppParams } from '../../contexts/AppParamsContext';
import { AuthStateManager } from '../../lib/auth-state';
import { supabase } from '../../lib/database/supabase';
import { usersDB } from '../../lib/database/users';
import { worldsDB } from '../../lib/database/worlds';
import { logger } from '../../lib/utils/logger';

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
  const { updateParams } = useAppParams();
  const [processing, setProcessing] = useState(true);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showAlreadyMemberModal, setShowAlreadyMemberModal] = useState(false);
  const [worldName, setWorldName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const lastProcessedRef = useRef<string | null>(null);

  // Helper function to get current user ID using usersDB
  const getCurrentUserId = async (): Promise<string | null> => {
    try {
      const userProfile = await usersDB.getCurrentUser();
      return userProfile?.id || null;
    } catch (error) {
      logger.error('auth-redirect', 'Error fetching user ID:', error);
      return null;
    }
  };

  useEffect(() => {
    const handleAuthRedirect = async () => {
      try {
        const action = params.action as string;
        // Build a processing key to prevent duplicate processing (StrictMode/dev double-run)
        const key = `${action || 'none'}|${params.token || ''}|${params.worldName || ''}|${
          typeof window !== 'undefined' ? window.location.hash : ''
        }`;
        if (lastProcessedRef.current === key) {
          logger.debug('auth-redirect', 'Duplicate processing detected, skipping');
          setProcessing(false);
          return;
        }
        lastProcessedRef.current = key;
        logger.debug('auth-redirect', 'Auth redirect action:', action);

        // First, handle any auth tokens from the URL
        let hasValidSession = false;
        if (typeof window !== 'undefined') {
          const hash = window.location.hash;
          if (hash) {
            const hashParams = new URLSearchParams(hash.substring(1));
            const accessToken = hashParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token');

            if (accessToken && refreshToken) {
              logger.debug('auth-redirect', 'Setting session from email link...');
              
              const { error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken
              });

              if (error) {
                logger.error('auth-redirect', 'Session error:', error);
                setErrorMessage('Invalid or expired link. Please try again.');
                setShowErrorModal(true);
                return;
              }
              logger.info('auth-redirect', 'Session established');
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

        // If we established a session but no explicit action provided, default based on context
        if (!action && hasValidSession) {
          // Get userId and redirect to complete-profile or world-selection
          const userProfile = await usersDB.getCurrentUser();
          const userId = userProfile?.id;
          if (userId) {
            // Update centralized params context
            updateParams({ userId });
            // Check if user has completed profile
            if (userProfile.username) {
              // Profile complete, go to world selection
              router.replace({
                pathname: '/select/world-selection',
                params: { userId }
              });
            } else {
              // Profile incomplete, go to complete profile
              router.replace('/login/complete-profile');
            }
          } else {
            // Fallback if we can't get userId
            router.replace('/login/complete-profile');
          }
          return;
        }

        // Route based on action
        switch (action) {
          case 'signup-confirm':
            // User confirmed email from signup -> go to complete profile
            logger.debug('auth-redirect', 'Redirecting to complete profile...');
            router.replace('/login/complete-profile');
            break;
          
          case 'reset-password':
            // User clicked password reset link -> go to reset password page
            logger.debug('auth-redirect', 'Redirecting to reset password...');
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
        logger.error('auth-redirect', 'Auth redirect error:', error);
        setErrorMessage('Something went wrong. Please try again.');
        setShowErrorModal(true);
      } finally {
        setProcessing(false);
      }
    };

    const handleWorldInvite = async (hasValidSession: boolean) => {
      logger.debug('auth-redirect', 'Processing world invite...');
      
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
  logger.debug('auth-redirect', 'Validating invite token...');
      const validationResult = await invitesDB.validateInviteToken(inviteToken);

      if (!validationResult.success || !validationResult.worldId) {
        setErrorMessage(validationResult.error || 'This invite link is invalid or has expired. Please ask for a new invitation.');
        setShowErrorModal(true);
        return;
      }

      const inviteWorldId = validationResult.worldId;

      if (!hasValidSession) {
        // User not logged in - save invite token and redirect to sign in
        logger.debug('auth-redirect', 'Saving pending invite for after login...');
        savePendingInvite(inviteToken, decodedWorldName);
        
        setWorldName(decodedWorldName);
        setShowInviteModal(true);
        return;
      }

      // User is logged in - process invite immediately
      logger.info('auth-redirect', 'User logged in, processing invite...');
      
      try {
        // Get user's profile
        const userProfile = await usersDB.getCurrentUser();
        if (!userProfile) {
          throw new Error('User profile not found');
        }
        // Store the userId for navigation
        setCurrentUserId(userProfile.id);

        // Check if user is already in the world
        logger.debug('auth-redirect', 'Checking if user is already in world...');
        const isAlreadyMember = await worldsDB.isUserInWorld(inviteWorldId, userProfile.id);

        if (isAlreadyMember) {
          logger.info('auth-redirect', 'User is already a member of this world');
          setWorldName(decodedWorldName);
          setShowAlreadyMemberModal(true);
          return;
        }

        // Add user to world in database
        logger.info('auth-redirect', 'Adding user to world:', inviteWorldId);
        await worldsDB.addUserToWorld(inviteWorldId, userProfile.id, 'player');
        logger.success('auth-redirect', 'User successfully added to world');
        
        setWorldName(decodedWorldName);
        setShowWelcomeModal(true);
        
      } catch (error) {
        logger.error('auth-redirect', 'Failed to add user to world:', error);
        
        // Check if user is already in the world (database constraint error)
        if (error instanceof Error && error.message.includes('duplicate')) {
          logger.info('auth-redirect', 'User already in world (duplicate key), showing already member modal');
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
        logger.debug('auth-redirect', 'Found pending invite:', pendingInvite);
        
        // Check if user is now logged in
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          logger.info('auth-redirect', 'User logged in, processing pending invite...');
          clearPendingInvite();
          
          try {
            // Import invitesDB dynamically
            const { invitesDB } = await import('../../lib/database/invites');
            
            // Validate the token and get worldId
            logger.debug('auth-redirect', 'Validating pending invite token...');
            const validationResult = await invitesDB.validateInviteToken(pendingInvite.token);
            
            if (!validationResult.success || !validationResult.worldId) {
              throw new Error(validationResult.error || 'Invalid or expired invite token');
            }

            // Get user's profile
            const userProfile = await usersDB.getCurrentUser();
            if (!userProfile) {
              throw new Error('User profile not found');
            }
            // Check if user is already in the world
            logger.debug('auth-redirect', 'Checking if user is already in world...');
            const isAlreadyMember = await worldsDB.isUserInWorld(validationResult.worldId, userProfile.id);
            if (isAlreadyMember) {
              logger.info('auth-redirect', 'User is already a member of this world (pending invite)');
              setWorldName(pendingInvite.worldName);
              setShowAlreadyMemberModal(true);
              return;
            }
            // Add user to world in database
            logger.info('auth-redirect', 'Adding user to world from pending invite:', validationResult.worldId);
            await worldsDB.addUserToWorld(validationResult.worldId, userProfile.id, 'player');
            logger.success('auth-redirect', 'User successfully added to world from pending invite');
            setWorldName(pendingInvite.worldName);
            setShowWelcomeModal(true);
            
          } catch (error) {
            logger.error('auth-redirect', 'Failed to add user to world from pending invite:', error);
            
            // Check if user is already in the world (database constraint error)
            if (error instanceof Error && error.message.includes('duplicate')) {
              logger.info('auth-redirect', 'User already in world from pending invite (duplicate key), showing already member modal');
              setWorldName(pendingInvite.worldName);
              setShowAlreadyMemberModal(true);
            } else {
              // Other error - show error message but don't completely fail
              logger.error('auth-redirect', 'Failed to process pending invite, but continuing...');
              
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
  }, [params, router, updateParams]);

  const handleWelcomeModalClose = async () => {
    setShowWelcomeModal(false);
    
    // Get userId and include it in navigation
    const userId = currentUserId || await getCurrentUserId();
    
    if (userId) {
      // Update centralized params context
      updateParams({ userId });
      
      router.replace({
        pathname: '/select/world-selection',
        params: { userId }
      });
    } else {
      // Fallback if we can't get userId
      router.replace('/select/world-selection');
    }
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
        visible={showAlreadyMemberModal && !showWelcomeModal}
        onClose={async () => {
          setShowAlreadyMemberModal(false);
          
          // Get userId and include it in navigation
          const userId = currentUserId || await getCurrentUserId();
          
          if (userId) {
            // Update centralized params context
            updateParams({ userId });
            
            router.replace({
              pathname: '/select/world-selection',
              params: { userId }
            });
          } else {
            // Fallback if we can't get userId
            router.replace('/select/world-selection');
          }
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