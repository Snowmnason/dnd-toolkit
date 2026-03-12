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
import { useAuthActions } from "@/hooks/auth";
import { useNavigate } from "@/hooks/navigation";
import { logger } from "@/hooks/utils";
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
  const { changeUsername } = useAuthActions();
  const { replace: navigateTo } = useNavigate();
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
        const { getCurrentSession } = await import("@/lib/auth");
        // Use cached session instead of making network call
        const authSession = await getCurrentSession();
        setSessionUser(authSession?.raw?.user ?? null);
      } catch (error) {
        logger.category('storage').error("Error fetching session user:", error);
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
      const result = await changeUsername(newUsername);
      if (!result.success) {
        const errorMsg = result.errors?.[0]?.message || "Failed to update username";
        setUsernameError(errorMsg);
        return;
      }

      setShowUsernameModal(false);
      logger.category('other').info("Username updated successfully");

      // Refresh the page to reflect the new username
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    } catch (error: any) {
      logger.category('other').error("Username update error:", error);
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
            navigateTo("/login/welcome");
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
