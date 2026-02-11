import {
    AuthActionGroup,
    AuthBody,
    AuthBodyFooter,
    AuthButton,
    AuthButtonSecondary,
    AuthCaption,
    AuthError,
    AuthForm,
    AuthRoot,
    AuthSubTitle,
    AuthTitle,
    FormAuthInput,
} from "@/components/auth_components";
import { Body } from "@/components/ui";
import { logger, supabase, usersDB, useSignUpForm } from "@/lib";
import { useScale } from "@/theme";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";

export default function CompleteProfileScreen() {
  const S = useScale();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [initializing, setInitializing] = useState(true);

  // Check if user is authenticated and needs to complete profile
  useEffect(() => {
    const checkAuthAndProfile = async () => {
      logger.info("auth", "Starting auth and profile check");
      try {
        // Use cached session instead of making network call
        const {
          data: { session },
          error: authError,
        } = await supabase.auth.getSession();
        logger.debug("auth", "Auth session check result:", {
          hasSession: !!session,
          userId: session?.user?.id,
          authError: authError?.message,
        });

        if (authError) {
          logger.error("auth", "Auth session error:", authError);
          router.replace("/login/sign-in");
          return;
        }

        if (!session?.user) {
          logger.warn(
            "auth",
            "No authenticated user found, redirecting to sign-in",
          );
          router.replace("/login/sign-in");
          return;
        }

        const authUser = session.user;

        // Try to get existing profile (might not exist for new users)
        logger.debug("auth", "Fetching user profile from database");
        const existingProfile = await usersDB.getCurrentUser();
        logger.info("auth", "Profile fetch result:", {
          hasProfile: !!existingProfile,
          profileId: existingProfile?.id,
          profileUsername: existingProfile?.username,
          profileAuthId: existingProfile?.auth_id,
        });

        if (existingProfile) {
          // Profile exists - check if it's complete
          setUser(existingProfile);
        } else {
          // No profile exists - this is expected for new users
          // Use the auth user data to create the profile
          logger.info(
            "auth",
            "No database profile found - this is expected for new users",
          );
          setUser(authUser);
        }

        // Robust profile validation - only redirect if profile is truly complete
        const hasValidProfile =
          existingProfile &&
          existingProfile.username &&
          existingProfile.username.trim().length > 0;

        logger.debug("auth", "Profile validation:", {
          hasValidProfile,
          hasExistingProfile: !!existingProfile,
          username: existingProfile?.username,
          usernameLength: existingProfile?.username?.length,
        });

        if (hasValidProfile) {
          logger.info(
            "auth",
            "User already has complete profile, redirecting to world selection",
          );
          router.replace("/select/world-selection");
          return;
        }
        logger.info(
          "auth",
          "User needs to complete profile, staying on this screen",
        );
      } catch (error) {
        logger.error("auth", "Auth check error:", error);
        router.replace("/login/sign-in");
      } finally {
        setInitializing(false);
        logger.debug("auth", "Auth check completed, initializing set to false");
      }
    };

    checkAuthAndProfile();
  }, [router]);

  // Use the unified form hook in complete-profile mode
  const {
    // Only need username-related data in this mode
    username,
    control,
    loading,
    authError,
    isValid,

    // Handlers
    handleSignUp: handleCompleteProfile,
  } = useSignUpForm("complete-profile", user);

  // Show loading while checking authentication
  if (initializing || !user) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#2f353d",
        }}
      >
        <Body color="#F5E6D3" fontSize="$para">
          {initializing ? "Checking authentication..." : "Loading..."}
        </Body>
      </View>
    );
  }

  return (
    <AuthRoot>
      {/* 🧠 Header */}
      <AuthTitle>Complete Your Profile</AuthTitle>

      <AuthSubTitle>
        Choose a username to complete your account setup.
      </AuthSubTitle>

      {/* 🏷️ Welcome Message Card */}
      <View
        style={{
          backgroundColor: "rgba(245, 230, 211, 0.95)",
          padding: S.space.lg,
          borderRadius: S.radius.md,
          marginBottom: S.space.xl,
          borderWidth: 2,
          borderColor: "#8B4513",
          width: "100%",
          maxWidth: S.s(400),
          alignSelf: "center",
        }}
      >
        <AuthBody.InCard style={{ marginBottom: S.space.xs }}>
          Welcome, {username ? username : "Adventurer"}!
        </AuthBody.InCard>

        <AuthBody.InCard>
          There will be more added soon to customize your profile more.
        </AuthBody.InCard>
      </View>

      {/* 🧾 Form */}
      <AuthForm style={{ marginBottom: authError ? S.space.md : S.space.xxl }}>
        <FormAuthInput
          control={control}
          name="username"
          placeholder="Username"
          autoCapitalize="none"
          editable={!loading}
          returnKeyType="go"
          onSubmitEditing={handleCompleteProfile}
        />

        <AuthError error={authError} />
      </AuthForm>

      {/* 🔘 Actions */}
      <AuthActionGroup>
        <AuthButton
          text="Complete Profile"
          onPress={handleCompleteProfile}
          disabled={!isValid}
          loading={loading}
        />

        <AuthButtonSecondary
          text="Sign Out"
          onPress={() => router.push("/login/sign-up")}
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
  );
}
