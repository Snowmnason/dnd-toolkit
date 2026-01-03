import { usePlatform } from "@/contexts/PlatformContext";
import {
  AuthStateManager,
  deleteUserAccount,
  logger,
  signOutUser,
  supabase,
  usersDB,
} from "@/lib";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, View } from "react-native";

// 🧱 New UI Components
import { CredentialConfirmModal } from "@/components/modals";
import {
  AppLoading,
  AppPage,
  Body,
  Button,
  Heading,
  Surface,
} from "@/components/ui";
import UserProfile from "../Screens/settings/user-profile";
import VersionDisplay from "../components/VersionDisplay";

// 🎨 Theme + Loading
import { ThemeSelector } from "@/Screens/settings/ThemeSelector";
import { useScale } from "@/theme";

export default function SettingsPage() {
  const router = useRouter();
  const S = useScale();
  const { isMobile } = usePlatform();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Sign-out + delete state
  const [signingOut, setSigningOut] = useState(false);
  const [buttonDisabled, setButtonDisabled] = useState(false);
  const [buttonDeleteDisabled, setButtonDeleteDisabled] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const isAuth = await AuthStateManager.isAuthenticated();
        if (!isAuth) {
          logger.debug("settings", "User not authenticated, redirecting");
          router.replace("/login/welcome");
          return;
        }
      } catch (error) {
        logger.error("settings", "Settings auth check error:", error);
        router.replace("/login/welcome");
        return;
      }
    };

    checkAuth();

    supabase.auth
      .getUser()
      .then((res: { data?: { user?: User | null }; error?: any }) => {
        setLoading(false);
      })
      .catch((err: unknown) => {
        logger.error("settings", "Error fetching user on settings mount:", err);
        setLoading(false);
      });

    usersDB
      .getCurrentUser()
      .then((profile) => {
        setProfile(profile ?? null);
      })
      .catch((err: unknown) => {
        logger.error(
          "settings",
          "Error fetching profile on settings mount:",
          err
        );
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, _session: Session | null) => {
        if (event === "SIGNED_OUT") {
          router.replace("/login/welcome");
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [router]);

  const handleSignOutConfirm = async () => {
    if (buttonDisabled) return;

    if (!signingOut) {
      setSigningOut(true);
      setButtonDisabled(true);
      setTimeout(() => setButtonDisabled(false), 1500);
    } else {
      setButtonDisabled(true);
      try {
        await signOutUser();
        router.replace("/login/welcome");
      } catch (error) {
        logger.error("settings", "Sign out error:", error);
        Alert.alert("Error", "Failed to sign out. Please try again.");
        setSigningOut(false);
        setButtonDisabled(false);
      }
    }
  };

  const handleDeleteConfirm = async () => {
    if (buttonDeleteDisabled) return;

    if (!confirmDelete) {
      setConfirmDelete(true);
      setButtonDeleteDisabled(true);
      setTimeout(() => setButtonDeleteDisabled(false), 1500);
      return;
    }

    setButtonDeleteDisabled(true);
    setShowDeleteModal(true);
  };

  const handleDeleteAccount = async (password: string) => {
    setDeleteError("");
    setDeleting(true);

    try {
      const result = await deleteUserAccount(password);
      if (!result.success)
        throw new Error(result.error || "Failed to delete account");

      setShowDeleteModal(false);
      router.replace("/login/welcome");
    } catch (error: any) {
      logger.error("settings", "Delete account error:", error);
      setDeleteError(
        error?.message || "Failed to delete account. Please try again."
      );
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
    setDeleteError("");
  };

  if (loading) {
    return <AppLoading loadMessage="Loading Settings..." />;
  }

  return (
    <AppPage gap="lg">
      {/* User Profile */}
      <Heading align="center" style={{ marginBottom: S.space.sm }}>
        Profile
      </Heading>
      <Surface padded bordered radius="md" style={{ marginBottom: S.space.lg }}>
        <UserProfile profile={profile} />
      </Surface>

      {/* Theme Selector Section */}
      <Heading align="center" style={{ marginBottom: S.space.sm }}>
        Theme Selector
      </Heading>
      <Surface bordered padded radius="md" style={{ marginBottom: S.space.lg }}>
        <ThemeSelector />
      </Surface>


      {/* App Settings Section */}
      <Heading align="center" style={{ marginBottom: S.space.sm }}>
        App Settings
      </Heading>
      <Surface bordered padded radius="md">
        <Body
          italic
          align="center"
          color="$textSecondary"
          style={{ opacity: 0.7, marginBottom: S.space.md }}
        >
          🎲 Coming Soon: Theme settings, backup options, and more!
        </Body>
        <Button
          variant="secondary"
          text="Playground"
          onPress={() => {
            if (isMobile) {
              router.push("/StyleMobile");
            } else {
              router.push("/StyleDesktop");
            }
          }}
          style={{ alignSelf: "center" }}
        />
      </Surface>

      {/* Account Actions */}

      <Heading
        align="center"
        style={{ marginBottom: S.space.md, marginTop: S.space.md }}
      >
        Account Actions
      </Heading>
      <Surface bordered padded radius="md">
        <View style={{ gap: S.space.sm, alignItems: "center" }}>
          {/* Sign Out Button */}
          <Button
            text={signingOut ? "Confirm Sign Out" : "Sign Out"}
            variant="destructive"
            onPress={handleSignOutConfirm}
            disabled={buttonDisabled}
            loading={false}
            style={{ minWidth: 200 }}
          />

          {/* Delete Account Button */}
          <Button
            text={confirmDelete ? "Confirm Delete" : "Delete Account"}
            variant="destructive"
            onPress={handleDeleteConfirm}
            disabled={buttonDeleteDisabled}
            style={{ minWidth: 200 }}
          />
        </View>
      </Surface>

      {/* Version Info */}
      <View style={{ alignItems: "center", marginTop: S.space.md }}>
        <VersionDisplay />
      </View>

      {/* Delete Confirmation Modal */}
      <CredentialConfirmModal
        visible={showDeleteModal}
        title="Confirm Account Deletion"
        message="This action is permanent. Please enter your password to confirm."
        confirmLabel="Delete Account"
        destructive
        loading={deleting}
        errorText={deleteError}
        onCancel={handleCloseDeleteModal}
        onConfirm={handleDeleteAccount}
      />
    </AppPage>
  );
}
