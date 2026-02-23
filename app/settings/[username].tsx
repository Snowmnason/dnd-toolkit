import {
  deleteUserAccount,
  logger,
  signOutUser,
  usersDB,
} from "@/lib";
import { buildNavigationTarget } from "@/lib/navigation/uri-helpers";
import { getAuthProvider } from "@/lib/services";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, View } from "react-native";

// 🧱 New UI Components
import { CredentialConfirmModal } from "@/components/modals";
import {
  AppLoading,
  AppPage,
  Button,
  Heading,
  Surface
} from "@/components/ui";
import UserProfile from "../../Screens/settings/user-profile";
import VersionDisplay from "../../components/VersionDisplay";

// 🎨 Theme + Loading
import { AppSettings } from "@/Screens/settings/AppSettings";
import { ThemeSelector } from "@/Screens/settings/ThemeSelector";
import { useScale } from "@/theme";

export default function SettingsPage() {
  const router = useRouter();
  const S = useScale();
  
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [secureReady, setSecureReady] = useState(false);

  // Sign-out + delete state
  const [signingOut, setSigningOut] = useState(false);
  const [buttonDisabled, setButtonDisabled] = useState(false);
  const [buttonDeleteDisabled, setButtonDeleteDisabled] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    // Double-check: require confirmed authenticated session before proceeding
    getAuthProvider()
      .then((authProvider) => authProvider.getSession())
      .then((session) => {
        const user = session?.raw?.user ?? null;
        if (!user || !user.email_confirmed_at) {
          logger.debug("settings", "No confirmed user session, redirecting");
          const target = buildNavigationTarget('/', {}, []);
          router.replace(target as any);
          return;
        }
        setSecureReady(true);
        setLoading(false);
      })
      .catch((err: unknown) => {
        logger.error("settings", "Error checking session:", err);
        const target = buildNavigationTarget('/', {}, []);
        router.replace(target as any);
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

    let unsubscribeAuth: (() => void) | null = null;
    getAuthProvider()
      .then((authProvider) => {
        unsubscribeAuth = authProvider.onAuthStateChange((session) => {
          if (!session) {
            logger.debug("settings", "Auth state changed: user signed out");
            const target = buildNavigationTarget('/', {}, []);
            router.replace(target as any);
          }
        });
      })
      .catch(() => {
        // Auth provider not available, auth watcher is skipped
      });

    return () => unsubscribeAuth?.();
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
        const target = buildNavigationTarget('/', {}, []);
        router.replace(target as any);
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
      const target = buildNavigationTarget('/', {}, []);
      router.replace(target as any);
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

  if (!secureReady) {
    return <AppLoading loadMessage="Securing Settings..." />;
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
        <AppSettings />
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
