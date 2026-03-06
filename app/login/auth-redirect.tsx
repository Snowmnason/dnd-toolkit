import { AuthModal } from "@/components/auth_components";
import { Caption } from "@/components/ui";
import { AuthStateManager, getCurrentSession, logger, usersDB, worldsDB } from "@/lib";
import { restoreSession } from "@/lib/auth";
import { StorageManager } from "@/lib/storage";
import { ERROR_CODES, STORAGE_KEYS } from "@/maps";
import { useAppParamsStable } from "@/providers";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import CustomLoad from "../../components/ui/CustomLoad";

interface PendingInvite {
  token: string;
  worldName: string;
  timestamp: number;
}

// Helper functions for invite storage (privacy-routed)
const savePendingInvite = async (token: string, worldName: string) => {
  const inviteData: PendingInvite = {
    token,
    worldName,
    timestamp: Date.now(),
  };
  await StorageManager.set(STORAGE_KEYS.PENDING_INVITE, inviteData);
};

const getPendingInvite = async (): Promise<PendingInvite | null> => {
  const inviteData = await StorageManager.get<PendingInvite>(
    STORAGE_KEYS.PENDING_INVITE,
  );
  if (inviteData) {
    // Check if invite is less than 24 hours old
    if (Date.now() - inviteData.timestamp < 24 * 60 * 60 * 1000) {
      return inviteData;
    } else {
      // Clean up expired invite
      await StorageManager.remove(STORAGE_KEYS.PENDING_INVITE);
    }
  }
  return null;
};

const clearPendingInvite = async () => {
  await StorageManager.remove(STORAGE_KEYS.PENDING_INVITE);
};

export default function AuthRedirect() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { setUserId } = useAppParamsStable();
  const [processing, setProcessing] = useState(true);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showAlreadyMemberModal, setShowAlreadyMemberModal] = useState(false);
  const [worldName, setWorldName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(
    undefined,
  );
  const lastProcessedRef = useRef<string | undefined>(undefined);

  // Helper function to get current user ID (checks storage first)
  const getCurrentUserId = async (): Promise<string | undefined> => {
    try {
      // Try storage first
      const userId = await AuthStateManager.getUserId();
      if (userId) {
        logger.category('auth').debug('User ID loaded from storage', { userId });
        return userId;
      }

      // Fallback to database
      const userProfile = await usersDB.getCurrentUser();
      return userProfile?.id || undefined;
    } catch (error) {
      logger.category('auth').error('Error fetching user ID', { code: ERROR_CODES.AUTH.UNKNOWN, error });
      return undefined;
    }
  };

  useEffect(() => {
    const handleAuthRedirect = async () => {
      try {
        const action = params.action as string;
        // Build a processing key to prevent duplicate processing (StrictMode/dev double-run)
        const key = `${action || "none"}|${params.token || ""}|${params.worldName || ""}|${
          typeof window !== "undefined" ? window.location.hash : ""
        }`;
        if (lastProcessedRef.current === key) {
          logger.category('auth').debug('Duplicate processing detected, skipping');
          setProcessing(false);
          return;
        }
        lastProcessedRef.current = key;
        logger.category('auth').debug('Auth redirect action', { action });

        // First, handle any auth tokens from the URL
        let hasValidSession = false;

        if (typeof window !== "undefined") {
          const hash = window.location.hash;
          if (hash) {
            const hashParams = new URLSearchParams(hash.substring(1));
            const accessToken = hashParams.get("access_token");
            const refreshToken = hashParams.get("refresh_token");

            if (accessToken && refreshToken) {
              logger.category("auth").debug("Setting session from email link...");

              const restored = await restoreSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });

              if (!restored) {
                logger.category("auth").error("Session restoration failed");
                setErrorMessage("Invalid or expired link. Please try again.");
                setShowErrorModal(true);
                return;
              }
              logger.category("auth").info("Session established");
              await AuthStateManager.setHasAccount(true);
              hasValidSession = true;
            }
          }
        }

        // Check if user already has a session (for direct visits)
        if (!hasValidSession) {
          const session = await getCurrentSession();
          hasValidSession = !!session;
        }

        // If we established a session but no explicit action provided, default based on context
        if (!action && hasValidSession) {
          // Check storage first, then database
          let userId = await AuthStateManager.getUserId();
          let userProfile = null;

          if (userId) {
            // User data in storage, use it
            userProfile = await AuthStateManager.getUserData();
            logger.category('auth').debug("User profile loaded from storage");
          } else {
            // Not in storage, fetch from database
            userProfile = await usersDB.getCurrentUser();
          }

          if (userProfile) {
            // Update centralized params context
            setUserId(userProfile.id);
            // Check if user has completed profile
            if (userProfile.username) {
              // Profile complete - preload worlds before navigating to world selection
              // This ensures the cache is warm when the page mounts, avoiding the loading race condition
              try {
                await worldsDB.getMyWorlds(userProfile.id);
              } catch (preloadError) {
                logger.category('auth').warn("Failed to preload worlds (non-critical)", { error: preloadError });
                // Non-critical: app works even if preload fails, just shows loading screen longer
              }
              
              // Now navigate to world selection with warm cache
              router.replace("/select/world-selection");
            } else {
              // Profile incomplete, go to complete profile
              router.replace("/login/complete-profile");
            }
          } else {
            // Fallback if we can't get userId
            router.replace("/login/complete-profile");
          }
          return;
        }

        // Route based on action
        switch (action) {
          case "signup-confirm":
            // User confirmed email from signup -> go to complete profile
            logger.category('auth').debug("Redirecting to complete profile...");
            router.replace("/login/complete-profile");
            break;

          case "reset-password":
            // User clicked password reset link -> go to reset password page
            logger.category('auth').debug("Redirecting to reset password...");
            router.replace("/login/reset-password");
            break;

          case "world-invite":
            await handleWorldInvite(hasValidSession);
            break;

          default:
            // Check for pending invites when user visits any auth page
            await checkForPendingInvites();

            // Fallback routing for legacy links
            if (action === "signin") {
              router.replace("/login/sign-in");
            } else if (action === "signup") {
              router.replace("/login/sign-up");
            } else {
              router.replace("/");
            }
        }
      } catch (error) {
        logger.category("auth").error("Auth redirect error:", {
          code: ERROR_CODES.UNKNOWN.GENERAL,
          error
        });
        setErrorMessage("Something went wrong. Please try again.");
        setShowErrorModal(true);
      } finally {
        setProcessing(false);
      }
    };

    const handleWorldInvite = async (hasValidSession: boolean) => {
      logger.category('auth').debug("Processing world invite...");

      const inviteToken = params.token as string;
      const inviteWorldName = params.worldName as string;

      if (!inviteToken || !inviteWorldName) {
        setErrorMessage(
          "Invalid invite link. Please ask for a new invitation.",
        );
        setShowErrorModal(true);
        return;
      }

      const decodedWorldName = decodeURIComponent(inviteWorldName);

      // Import invitesDB dynamically to avoid circular dependencies
      const { invitesDB } = await import("@/lib/database/invites");

      // Validate the invite token first
      logger.category('auth').debug("Validating invite token...");
      const validationResult = await invitesDB.validateInviteToken(inviteToken);

      if (!validationResult.success || !validationResult.worldId) {
        setErrorMessage(
          validationResult.error ||
            "This invite link is invalid or has expired. Please ask for a new invitation.",
        );
        setShowErrorModal(true);
        return;
      }

      const inviteWorldId = validationResult.worldId;

      if (!hasValidSession) {
        // User not logged in - save invite token and redirect to sign in
        logger.category('auth').debug("Saving pending invite for after login...");
        await savePendingInvite(inviteToken, decodedWorldName);

        setWorldName(decodedWorldName);
        setShowInviteModal(true);
        return;
      }

      // User is logged in - process invite immediately
      logger.category('auth').info("User logged in, processing invite...");

      try {
        // Get user's profile
        const userProfile = await usersDB.getCurrentUser();
        if (!userProfile) {
          throw new Error("User profile not found");
        }
        // Store the userId for navigation
        setCurrentUserId(userProfile.id);

        // Check if user is already in the world
        const isAlreadyMember = await worldsDB.isUserInWorld(
          inviteWorldId,
          userProfile.id,
        );

        if (isAlreadyMember) {
          logger.category('auth').info("User is already a member of this world");
          setWorldName(decodedWorldName);
          setShowAlreadyMemberModal(true);
          return;
        }

        // Add user to world in database
        logger.category('auth').info("Adding user to world", { worldId: inviteWorldId });
        await worldsDB.addUserToWorld(
          inviteWorldId,
          userProfile.id,
          inviteToken,
          "player",
        );
        logger.category('auth').info("User successfully added to world");

        setWorldName(decodedWorldName);
        setShowWelcomeModal(true);
      } catch (error) {
        logger.category("other").error("Failed to add user to world:", error);

        // Check if user is already in the world (database constraint error)
        if (error instanceof Error && error.message.includes("duplicate")) {
          logger.category("other").info("User already in world (duplicate key), showing already member modal");
          setWorldName(decodedWorldName);
          setShowAlreadyMemberModal(true);
        } else {
          // Other error - show error message
          setErrorMessage(
            "Failed to join world. Please try again or contact the world owner.",
          );
          setShowErrorModal(true);
        }
      }
    };

    const checkForPendingInvites = async () => {
      const pendingInvite = await getPendingInvite();
      if (pendingInvite) {
        logger.category("other").debug("Found pending invite:", pendingInvite);

        // Check if user is now logged in
        const session = await getCurrentSession();
        if (session) {
          logger.category("other").info("User logged in, processing pending invite...");
          await clearPendingInvite();

          try {
            // Import invitesDB dynamically
            const { invitesDB } = await import("@/lib/database/invites");

            // Validate the token and get worldId
            logger.category("other").debug("Validating pending invite token...");
            const validationResult = await invitesDB.validateInviteToken(
              pendingInvite.token,
            );

            if (!validationResult.success || !validationResult.worldId) {
              throw new Error(
                validationResult.error || "Invalid or expired invite token",
              );
            }

            // Get user's profile
            const userProfile = await usersDB.getCurrentUser();
            if (!userProfile) {
              throw new Error("User profile not found");
            }
            // Check if user is already in the world
            logger.category("other").debug("Checking if user is already in world...");
            const isAlreadyMember = await worldsDB.isUserInWorld(
              validationResult.worldId,
              userProfile.id,
            );
            if (isAlreadyMember) {
              logger.category("other").info("User is already a member of this world (pending invite)");
              setWorldName(pendingInvite.worldName);
              setShowAlreadyMemberModal(true);
              return;
            }
            // Add user to world in database
            logger.category("other").info("Adding user to world from pending invite:", validationResult.worldId);
            await worldsDB.addUserToWorld(
              validationResult.worldId,
              userProfile.id,
              pendingInvite.token,
              "player",
            );
            logger.category("other").info("User successfully added to world from pending invite");
            setWorldName(pendingInvite.worldName);
            setShowWelcomeModal(true);
          } catch (error) {
            logger.category("other").error("Failed to add user to world from pending invite:", error);

            // Check if user is already in the world (database constraint error)
            if (error instanceof Error && error.message.includes("duplicate")) {
              logger.category("other").info("User already in world from pending invite (duplicate key), showing already member modal");
              setWorldName(pendingInvite.worldName);
              setShowAlreadyMemberModal(true);
            } else {
              // Other error - show error message but don't completely fail
              logger.category("other").error("Failed to process pending invite, but continuing...");

              // Don't show success modal if invite was invalid/expired
              if (
                error instanceof Error &&
                (error.message.includes("Invalid") ||
                  error.message.includes("expired"))
              ) {
                setErrorMessage(
                  "This invite link has expired. Please ask for a new invitation.",
                );
                setShowErrorModal(true);
              }
            }
          }
        }
      }
    };

    handleAuthRedirect();
  }, [params, router, setUserId]);

  const handleWelcomeModalClose = async () => {
    setShowWelcomeModal(false);

    // Get userId and update context
    const userId = currentUserId || (await getCurrentUserId());

    if (userId) {
      // Update centralized params context
      setUserId(userId);
      
      // Preload worlds before navigating to ensure cache is warm
      try {
        logger.category("ui").debug("Preloading worlds after invite welcome");
        await worldsDB.getMyWorlds(userId);
      } catch (preloadError) {
        logger.category("ui").warn("Failed to preload worlds (non-critical):", preloadError);
      }
    }

    router.replace("/select/world-selection");
  };

  const handleInviteModalSignIn = () => {
    setShowInviteModal(false);
    router.replace("/login/sign-in");
  };

  const handleInviteModalSignUp = () => {
    setShowInviteModal(false);
    router.replace("/login/sign-up");
  };

  if (processing) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#2f353d",
        }}
      >
        <CustomLoad size="large" />
        <Caption align="center" style={{ marginTop: 16 }}>
          Processing authentication...
        </Caption>
      </View>
    );
  }

  return (
    <>
      {/* 🌍 World Invite Welcome Modal (for successfully joined worlds) */}
      <AuthModal
        visible={showWelcomeModal}
        onClose={handleWelcomeModalClose}
        title="Welcome to the Adventure! 🎲"
        message={`You joined "${worldName}" successfully! Welcome to the party!`}
        buttons={[
          {
            text: "Continue to Worlds",
            onPress: handleWelcomeModalClose,
            variant: "primary",
          },
        ]}
      />

      {/* 🌍 World Invite Login Required Modal (for non-logged-in users) */}
      <AuthModal
        visible={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title="Join the Adventure! 🎲"
        message={`You've been invited to join "${worldName}"! Please sign in to your account to accept this invitation. Your invite will be saved and processed after you log in.`}
        buttons={[
          {
            text: "Sign In",
            onPress: handleInviteModalSignIn,
            variant: "primary",
          },
          {
            text: "Create Account",
            onPress: handleInviteModalSignUp,
            variant: "secondary",
          },
          {
            text: "Maybe Later",
            onPress: () => {
              clearPendingInvite();
              setShowInviteModal(false);
              router.replace("/");
            },
            variant: "cancel",
          },
        ]}
      />

      {/* 🎉 Already a Member Modal */}
      <AuthModal
        visible={showAlreadyMemberModal && !showWelcomeModal}
        onClose={async () => {
          setShowAlreadyMemberModal(false);

          // Get userId and update context
          const userId = currentUserId || (await getCurrentUserId());

          if (userId) {
            // Update centralized params context
            setUserId(userId);
            
            // Preload worlds before navigating to ensure cache is warm
            try {
              logger.category("ui").debug("Preloading worlds after already member");
              await worldsDB.getMyWorlds(userId);
            } catch (preloadError) {
              logger.category("ui").warn("Failed to preload worlds (non-critical):", preloadError);
            }
          }

          router.replace("/select/world-selection");
        }}
        title="Already a Member! 🎉"
        message={`You're already part of "${worldName}"! No need to join again.`}
        buttons={[
          {
            text: "Go to Worlds",
            onPress: async () => {
              setShowAlreadyMemberModal(false);
              
              // Preload worlds before navigating to ensure cache is warm
              try {
                const userId = currentUserId || (await getCurrentUserId());
                if (userId) {
                  logger.category("other").debug("Preloading worlds before navigate to world selection");
                  await worldsDB.getMyWorlds(userId);
                }
                } catch (preloadError) {
                logger.category("other").warn("Failed to preload worlds (non-critical):", preloadError);
              }
              
              router.replace("/select/world-selection");
            },
            variant: "primary",
          },
        ]}
      />

      {/* ⚠️ Error Modal */}
      <AuthModal
        visible={showErrorModal}
        onClose={() => {
          setShowErrorModal(false);
          router.replace("/");
        }}
        title="Oops! ⚠️"
        message={errorMessage}
        buttons={[
          {
            text: "OK",
            onPress: () => {
              setShowErrorModal(false);
              router.replace("/");
            },
            variant: "primary",
          },
        ]}
      />
      <View style={{ flex: 1, backgroundColor: "#2f353d" }} />
    </>
  );
}
