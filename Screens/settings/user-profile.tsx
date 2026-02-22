import { UpdateUsernameModal } from "@/components/modals";
import {
  AppToast,
  Body,
  Button,
  Heading,
  IconButton,
  SubTitle,
  Surface,
} from "@/components/ui";
import { logger, updateUsername } from "@/lib";
import { buildNavigationTarget } from "@/lib/navigation/uri-helpers";
import { $, useScale } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";

interface UserProfileProps {
  profile?: {
    id?: string;
    username?: string;
  } | null;
}

export default function UserProfile({ profile }: UserProfileProps) {
  const router = useRouter();
  const S = useScale();
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [updatingUsername, setUpdatingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState("");
  const [usernameValidationWarning, setUsernameValidationWarning] =
    useState("");
  const [showValidationToast, setShowValidationToast] = useState(false);
  const [isEmailVisible, setIsEmailVisible] = useState(false);

  useEffect(() => {
    const fetchSessionUser = async () => {
      try {
        const { getAuthProvider } = await import("@/lib/services");
        const authProvider = await getAuthProvider();
        // Use cached session instead of making network call
        const authSession = await authProvider.getSession();
        setSessionUser(authSession?.raw?.user ?? null);
      } catch (error) {
        logger.error("user-profile", "Error fetching session user:", error);
      } finally {
        setLoadingSession(false);
      }
    };
    fetchSessionUser();
  }, []);

  // Show toast when validation warning occurs
  useEffect(() => {
    if (usernameValidationWarning) {
      setShowValidationToast(true);
    }
  }, [usernameValidationWarning]);

  const handleUpdateUsername = async (newUsername: string) => {
    setUsernameError("");
    setUsernameValidationWarning("");
    setUpdatingUsername(true);

    try {
      const result = await updateUsername(newUsername);
      if (!result.success) {
        if (result.validationWarning) {
          setUsernameValidationWarning(result.validationWarning);
        }
        setUsernameError(result.error || "Failed to update username");
        return;
      }

      setShowUsernameModal(false);
      logger.info("user-profile", "Username updated successfully");

      // Refresh the page to reflect the new username
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    } catch (error: any) {
      logger.error("user-profile", "Username update error:", error);
      setUsernameError(error?.message || "Failed to update username");
    } finally {
      setUpdatingUsername(false);
    }
  };

  // Fallback when profile missing
  if (!profile && !loadingSession) {
    return (
      <Surface padded bordered radius="md">
        <Heading align="center" style={{ marginBottom: S.space.xs }}>
          Account
        </Heading>

        <Body
          align="center"
          color="$textSecondary"
          style={{ marginBottom: S.space.md, opacity: 0.8 }}
        >
          Unable to load profile information.
        </Body>

        <Button
          text="Return to Login"
          variant="primary"
          onPress={() => {
            const target = buildNavigationTarget("/login/welcome", {}, []);
            router.replace(target as any);
          }}
          style={{ alignSelf: "center", minWidth: 140 }}
        />
      </Surface>
    );
  }

  // ✅ Main Profile Panel
  return (
    <View>
      <View
        style={{
          marginBottom: S.space.lg,
        }}
      >
        {/* Email */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: S.space.xs }}>
          <Body variant="semi">
            Email
          </Body>
          <IconButton
            content={
              <Ionicons name={isEmailVisible ? "eye-off-outline" : "eye-outline"} size={18} color={$("textPrimary")} />
            }
            variant="icon"
            onPress={() => setIsEmailVisible(!isEmailVisible)}
            size="sm"
          />
        </View>
        <SubTitle italic>{isEmailVisible ? sessionUser?.email : "********"}</SubTitle>
      </View>

      {/* Username */}
      {profile?.username && (
        <View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: S.space.xs,
            }}
          >
            <Body variant="semi">Username</Body>
            <IconButton
              content={
                <Ionicons
                  name="settings-outline"
                  size={18}
                  color={$("textPrimary")}
                />
              }
              variant="icon"
              onPress={() => setShowUsernameModal(true)}
              size="sm"
            />
          </View>
          <SubTitle italic>{profile.username}</SubTitle>
        </View>
      )}

      {loadingSession && (
        <Body
          italic
          align="center"
          color="$textSecondary"
          style={{ marginTop: S.space.sm }}
        >
          Loading profile...
        </Body>
      )}

      {/* Username Update Modal */}
      {profile?.username && (
        <UpdateUsernameModal
          visible={showUsernameModal}
          currentUsername={profile.username}
          onCancel={() => {
            setShowUsernameModal(false);
            setUsernameError("");
          }}
          onConfirm={handleUpdateUsername}
          loading={updatingUsername}
          errorText={usernameError}
        />
      )}

      <AppToast
        message={usernameValidationWarning}
        type="warning"
        visible={showValidationToast}
        duration={4000}
        onHide={() => setShowValidationToast(false)}
      />
    </View>
  );
}
