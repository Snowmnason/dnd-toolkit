import { useAuthStateListener, useSignOutFlow } from "@/hooks/auth";
import { useNavigate } from "@/hooks/navigation";
import { getCurrentUserProfile } from "@/hooks/storage";
import { logger } from "@/hooks/utils";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";

// 🧱 New UI Components
import {
    AppPage,
    Body,
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
  const { replace: navigateTo } = useNavigate();
  
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [secureReady, setSecureReady] = useState(false);

  // Sign-out and delete flows managed by hook state machines
  const signOutFlow = useSignOutFlow('sign-out');
  const deleteFlow = useSignOutFlow('delete-account');

  // Listen for sign-outs and redirect
  useAuthStateListener((session) => {
    if (!session) {
      logger.category("auth").debug("Auth state changed: user signed out");
      navigateTo('/');
    }
  });

  useEffect(() => {
    // Fetch user profile
    getCurrentUserProfile()
      .then((profile) => {
        setProfile(profile ?? null)
        setSecureReady(true)
        setLoading(false)
      })
      .catch((err: unknown) => {
        logger.category('ui').error('Error fetching profile on settings mount:', err)
        setLoading(false)
      })
  }, [navigateTo, router])

  // NOTE: Modal visibility and error states are now managed by hook state machines.
  // See signOutFlow.state.modal and deleteFlow.state.modal for which modal to show.

  if (loading) {
    return (
      <AppPage center gap="lg">
        <Body align="center">Loading Settings...</Body>
      </AppPage>
    );
  }

  if (!secureReady) {
    return (
      <AppPage center gap="lg">
        <Body align="center">Securing Settings...</Body>
      </AppPage>
    );
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
            text={signOutFlow.state.phase === 'syncing' ? 'Syncing...' : 'Sign Out'}
            variant="destructive"
            onPress={signOutFlow.handlers.initiate}
            disabled={signOutFlow.state.loading}
            loading={signOutFlow.state.phase === 'syncing'}
            style={{ minWidth: 200 }}
          />

          {/* Delete Account Button */}
          <Button
            text="Delete Account"
            variant="destructive"
            onPress={deleteFlow.handlers.initiate}
            disabled={deleteFlow.state.loading}
            style={{ minWidth: 200 }}
          />
        </View>
      </Surface>

      {/* Version Info */}
      <View style={{ alignItems: "center", marginTop: S.space.md }}>
        <VersionDisplay />
      </View>
    </AppPage>
  );
}
