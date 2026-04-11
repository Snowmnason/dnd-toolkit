import {
  Body,
  Button,
  Heading,
  IconButton,
  SubTitle,
  Surface,
} from "@/components/ui"
import { useChangeCredsFlow } from "@/hooks/auth"
import { useAppToast } from "@/contexts"
import { useNavigate } from "@/hooks/navigation"
import { logger } from "@/hooks/utils"
import { $, useScale } from "@/theme"
import { Ionicons } from "@expo/vector-icons"
import { useEffect, useState } from "react"
import { View } from "react-native"

interface UserProfileProps {
  profile?: {
    id?: string
    username?: string
  } | null
}

export default function UserProfile({ profile }: UserProfileProps) {
  const S = useScale()
  const { replace: navigateTo } = useNavigate()
  const { show: showToast } = useAppToast()
  const [sessionUser, setSessionUser] = useState<any>(null)
  const [loadingSession, setLoadingSession] = useState(true)
  const [isEmailVisible, setIsEmailVisible] = useState(false)

  // Credential update hook
  const {
    state: credsState,
    passwordForm,
    usernameForm,
    handlers: credsHandlers,
  } = useChangeCredsFlow(profile?.username)

  // Fetch session user on mount
  useEffect(() => {
    const fetchSessionUser = async () => {
      try {
        const { getCurrentSession } = await import("@/lib/auth")
        const authSession = await getCurrentSession()
        setSessionUser(authSession?.raw?.user ?? null)
      } catch (error) {
        logger.category('storage').error("Error fetching session user:", error)
      } finally {
        setLoadingSession(false)
      }
    }
    fetchSessionUser()
  }, [])

  // Show toast on success
  useEffect(() => {
    if (credsState.phase === 'success' && credsState.successMessage) {
      showToast('Success', credsState.successMessage, 'success', 2000)
      // Auto-close modal after brief delay
      setTimeout(() => {
        credsHandlers.cancelModal()
      }, 1500)
    }
  }, [credsState.phase, credsState.successMessage, showToast, credsHandlers])

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
            navigateTo("/login/welcome")
          }}
          style={{ alignSelf: "center", minWidth: 140 }}
        />
      </Surface>
    )
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
              onPress={() => credsHandlers.initiateUsernameChange()}
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
    </View>
  )
}
