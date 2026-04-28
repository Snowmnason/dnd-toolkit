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
import { useSignUpFlow } from "@/hooks/auth";
import { useNavigation } from "@/hooks/navigation";
import { getCurrentUserProfile } from "@/hooks/storage";
import { logger } from "@/hooks/utils";
import { getCurrentSession } from "@/lib/auth";
import { useScale } from "@/theme";
import { useEffect, useState } from "react";
import { View } from "react-native";

export default function CompleteProfileScreen() {
  const S = useScale();
  const navigate = useNavigation();
  const [user, setUser] = useState<any>(null);
  const [initializing, setInitializing] = useState(true);

  // Check if user is authenticated and needs to complete profile
  useEffect(() => {
    const checkAuthAndProfile = async () => {
      try {
        // Use convenience function instead of direct provider call
        const session = await getCurrentSession();
        logger.category('auth').debug("Auth session check result:", {
          hasSession: !!session,
          userId: session?.userId,
        });

        if (!session) {
          logger.category('auth').warn(
            "No authenticated user found, redirecting to sign-in",
          );
          navigate.replace("/login/sign-in");
          return;
        }

        // Session is obtained from provider (no need for separate authUser)

        // Try to get existing profile (might not exist for new users)
        logger.category('auth').debug("Fetching user profile from database");
        const existingProfile = await getCurrentUserProfile();
        logger.category('auth').info("Profile fetch result:", {
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
          logger.category('auth').info(
            "No database profile found - this is expected for new users",
          );
          setUser({ id: session.userId, email: session.email });
        }

        // Robust profile validation - only redirect if profile is truly complete
        const hasValidProfile =
          existingProfile &&
          existingProfile.username &&
          existingProfile.username.trim().length > 0;

        logger.category('auth').debug("Profile validation:", {
          hasValidProfile,
          hasExistingProfile: !!existingProfile,
          username: existingProfile?.username,
          usernameLength: existingProfile?.username?.length,
        });

        if (hasValidProfile) {
          logger.category('auth').info(
            "User already has complete profile, redirecting to world selection",
          );
          navigate.replace("/select/world-selection");
          return;
        }
        logger.category('auth').info(
          "User needs to complete profile, staying on this screen",
        );
      } catch (error) {
        logger.category('auth').error("Auth check error:", error);
        navigate.replace("/login/sign-in");
      } finally {
        setInitializing(false);
        logger.category('auth').debug("Auth check completed, initializing set to false");
      }
    };

    checkAuthAndProfile();
  }, [navigate]);

  // Use the unified form hook in complete-profile mode
  const { state, form } = useSignUpFlow("complete-profile", user);

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
          Welcome, {form.username ? form.username : "Adventurer"}!
        </AuthBody.InCard>

        <AuthBody.InCard>
          There will be more added soon to customize your profile more.
        </AuthBody.InCard>
      </View>

      {/* 🧾 Form */}
      <AuthForm style={{ marginBottom: state.error ? S.space.md : S.space.xxl }}>
        <FormAuthInput
          control={form.control}
          name="username"
          placeholder="Username"
          autoCapitalize="none"
          editable={!state.loading}
          returnKeyType="go"
          onSubmitEditing={form.handleSubmit}
        />

        {state.error && <AuthError error={state.error} />}
      </AuthForm>

      {/* 🔘 Actions */}
      <AuthActionGroup>
        <AuthButton
          text="Complete Profile"
          onPress={form.handleSubmit}
          disabled={!form.isValid}
          loading={state.loading}
        />

        <AuthButtonSecondary
          text="Sign Out"
          onPress={() => navigate.to("/login/sign-up")}
          disabled={state.loading}
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
