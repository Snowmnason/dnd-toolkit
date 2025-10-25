import { UpdateUsernameModal } from '@/components/modals'
import { Body, Button, Heading, IconButton, SubTitle, Surface } from '@/components/ui'
import { logger, updateUsername } from '@/lib'
import { $, tone, useScale } from '@/theme'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import React, { useEffect, useState } from 'react'

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
        const {
          data: { user },
        } = await supabase.auth.getUser()
        setSessionUser(user)
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
          onPress={() => router.replace('/login/welcome')}
          style={{ alignSelf: 'center', minWidth: 140 }}
        />
      </Surface>
    )
  }

  // ✅ Main Profile Panel
  return (
    <Surface padded bordered radius="md">
      <Heading align="center" style={{ marginBottom: S.space.sm }}>
        Profile
      </Heading>

      <Surface
        variant="accent"
        bordered
        padded
        radius="md"
        style={{
          marginBottom: S.space.lg,
          backgroundColor: tone($('accent'), 'alt'),
        }}
      >
        {/* Email */}
        <Body variant="semi" style={{ marginBottom: S.space.xs }}>
          Email
        </Body>
        <SubTitle italic>{sessionUser?.email || 'Loading...'}</SubTitle>

        {/* Username */}
        {profile?.username && (
          <Surface variant="base" style={{ marginTop: S.space.md, padding: S.space.sm, borderRadius: S.radius.md }}>
            <Surface
              variant="base"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: S.space.xs,
              }}
            >
              <Body variant="semi">Username</Body>
              <IconButton
                icon={<Ionicons name="settings-outline" size={18} color={$(
                  'textPrimary'
                )} />}
                onPress={() => setShowUsernameModal(true)}
                size="sm"
              />
            </Surface>

            <SubTitle italic>{profile.username}</SubTitle>
          </Surface>
        )}

        {loadingSession && (
          <Body italic align="center" color="$textSecondary" style={{ marginTop: S.space.sm }}>
            Loading profile...
          </Body>
        )}
      </Surface>

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
    </Surface>
  )
}
