import { UpdateUsernameModal } from '@/components/modals'
import { Body, Button, Heading, IconButton, SubTitle, Surface } from '@/components/ui'
import { logger, updateUsername } from '@/lib'
import { buildNavigationTarget } from '@/lib/navigation/uri-helpers'
import { $, useScale } from '@/theme'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { View } from 'react-native'

interface UserProfileProps {
  profile?: {
    id?: string
    username?: string
  } | null
}

export default function UserProfile({ profile }: UserProfileProps) {
  const router = useRouter()
  const S = useScale()
  const [sessionUser, setSessionUser] = useState<any>(null)
  const [loadingSession, setLoadingSession] = useState(true)
  const [showUsernameModal, setShowUsernameModal] = useState(false)
  const [updatingUsername, setUpdatingUsername] = useState(false)
  const [usernameError, setUsernameError] = useState('')

  useEffect(() => {
    const fetchSessionUser = async () => {
      try {
        const { supabase } = await import('../../lib/database/supabase')
        // Use cached session instead of making network call
        const {
          data: { session },
        } = await supabase.auth.getSession()
        setSessionUser(session?.user)
      } catch (error) {
        logger.error('user-profile', 'Error fetching session user:', error)
      } finally {
        setLoadingSession(false)
      }
    }
    fetchSessionUser()
  }, [])

  const handleUpdateUsername = async (newUsername: string) => {
    setUsernameError('')
    setUpdatingUsername(true)

    try {
      const result = await updateUsername(newUsername)
      if (!result.success) {
        setUsernameError(result.error || 'Failed to update username')
        return
      }

      setShowUsernameModal(false)
      logger.info('user-profile', 'Username updated successfully')

      // Refresh the page to reflect the new username
      if (typeof window !== 'undefined') {
        window.location.reload()
      }
    } catch (error: any) {
      logger.error('user-profile', 'Username update error:', error)
      setUsernameError(error?.message || 'Failed to update username')
    } finally {
      setUpdatingUsername(false)
    }
  }

  // Fallback when profile missing
  if (!profile && !loadingSession) {
    return (
      <Surface padded bordered radius="md">
        <Heading align="center" style={{ marginBottom: S.space.xs }}>
          Account
        </Heading>

        <Body align="center" color="$textSecondary" style={{ marginBottom: S.space.md, opacity: 0.8 }}>
          Unable to load profile information.
        </Body>

        <Button
          text="Return to Login"
          variant="primary"
          onPress={() => {
            const target = buildNavigationTarget('/login/welcome', {}, []);
            router.replace(target as any);
          }}
          style={{ alignSelf: 'center', minWidth: 140 }}
        />
      </Surface>
    )
  }

  // ✅ Main Profile Panel
  return (
    <View >

      <View
        style={{
          marginBottom: S.space.lg,
        }}
      >
          {/* Email */}
          <Body variant="semi" style={{ marginBottom: S.space.xs }}>
            Email
          </Body>
          <SubTitle italic>{sessionUser?.email || 'Loading...'}</SubTitle>
      </View>

        {/* Username */}
        {profile?.username && (
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S.space.xs }}>
              <Body variant="semi">Username</Body>
              <IconButton
                content={<Ionicons name="settings-outline" size={18} color={$(
                  'textPrimary'
                )} />}
                variant="icon"
                onPress={() => setShowUsernameModal(true)}
                size="sm"
              />
            </View>
            <SubTitle italic>{profile.username}</SubTitle>
          </View>
        )}

        {loadingSession && (
          <Body italic align="center" color="$textSecondary" style={{ marginTop: S.space.sm }}>
            Loading profile...
          </Body>
        )}


      {/* Username Update Modal */}
      {profile?.username && (
        <UpdateUsernameModal
          visible={showUsernameModal}
          currentUsername={profile.username}
          onCancel={() => {
            setShowUsernameModal(false)
            setUsernameError('')
          }}
          onConfirm={handleUpdateUsername}
          loading={updatingUsername}
          errorText={usernameError}
        />
      )}
    </View>
  )
}
