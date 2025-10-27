import {
    AuthStateManager,
    deleteUserAccount,
    logger,
    signOutUser,
    supabase,
    usersDB,
} from '@/lib'
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Alert, Platform } from 'react-native'

// 🧱 New UI Components
import { CredentialConfirmModal } from '@/components/modals'
import {
    AppLoading,
    AppPage,
    Body,
    Button,
    Heading,
    Surface,
} from '@/components/ui'
import UserProfile from '../components/settings/user-profile'

// 🎨 Theme + Loading
import { useScale } from '@/theme'

export default function SettingsPage() {
  const router = useRouter()
  const S = useScale()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const isMobile = Platform.OS === 'ios' || Platform.OS === 'android';

  // Sign-out + delete state
  const [signingOut, setSigningOut] = useState(false)
  const [buttonDisabled, setButtonDisabled] = useState(false)
  const [buttonDeleteDisabled, setButtonDeleteDisabled] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const isAuth = await AuthStateManager.isAuthenticated()
        if (!isAuth) {
          logger.debug('settings', 'User not authenticated, redirecting')
          router.replace('/login/welcome')
          return
        }
      } catch (error) {
        logger.error('settings', 'Settings auth check error:', error)
        router.replace('/login/welcome')
        return
      }
    }

    checkAuth()

    supabase.auth
      .getUser()
      .then((res: { data?: { user?: User | null }; error?: any }) => {
        setLoading(false)
      })
      .catch((err: unknown) => {
        logger.error('settings', 'Error fetching user on settings mount:', err)
        setLoading(false)
      })

    usersDB
      .getCurrentUser()
      .then((profile) => {
        setProfile(profile ?? null)
      })
      .catch((err: unknown) => {
        logger.error('settings', 'Error fetching profile on settings mount:', err)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, _session: Session | null) => {
        if (event === 'SIGNED_OUT') {
          router.replace('/login/welcome')
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [router])

  const handleSignOutConfirm = async () => {
    if (buttonDisabled) return

    if (!signingOut) {
      setSigningOut(true)
      setButtonDisabled(true)
      setTimeout(() => setButtonDisabled(false), 1500)
    } else {
      setButtonDisabled(true)
      try {
        await signOutUser()
        router.replace('/login/welcome')
      } catch (error) {
        logger.error('settings', 'Sign out error:', error)
        Alert.alert('Error', 'Failed to sign out. Please try again.')
        setSigningOut(false)
        setButtonDisabled(false)
      }
    }
  }

  const handleDeleteConfirm = async () => {
    if (buttonDeleteDisabled) return

    if (!confirmDelete) {
      setConfirmDelete(true)
      setButtonDeleteDisabled(true)
      setTimeout(() => setButtonDeleteDisabled(false), 1500)
      return
    }

    setButtonDeleteDisabled(true)
    setShowDeleteModal(true)
  }

  const handleDeleteAccount = async (password: string) => {
    setDeleteError('')
    setDeleting(true)

    try {
      const result = await deleteUserAccount(password)
      if (!result.success) throw new Error(result.error || 'Failed to delete account')

      setShowDeleteModal(false)
      router.replace('/login/welcome')
    } catch (error: any) {
      logger.error('settings', 'Delete account error:', error)
      setDeleteError(error?.message || 'Failed to delete account. Please try again.')
      setButtonDeleteDisabled(false)
      setConfirmDelete(false)
    } finally {
      setDeleting(false)
    }
  }

  const handleCloseDeleteModal = () => {
    setShowDeleteModal(false)
    setConfirmDelete(false)
    setButtonDeleteDisabled(false)
    setDeleteError('')
  }

  if (loading) {
    return (
      <AppLoading loadMessage="Loading Settings..." />
    )
  }

  return (
    <AppPage gap="lg">
      {/* User Profile */}
      <Surface padded bordered radius="md" style={{ marginBottom: S.space.lg }}>
        <UserProfile profile={profile} />
      </Surface>

      {/* App Settings Section */}
      <Surface bordered padded radius="md">
        <Heading align="center" style={{ marginBottom: S.space.sm }}>
          App Settings
        </Heading>
        <Body
          italic
          align="center"
          color="$textSecondary"
          style={{ opacity: 0.7 }}
        >
          🎲 Coming Soon: Theme settings, backup options, and more!
          <Button variant="secondary" onPress={() => {
            if(isMobile) {
              router.replace('../StyleMobile');
              return;
            }else {
              router.replace('../StyleDesktop');
              return;
            }}}>Playground</Button>
        </Body>
      </Surface>

      {/* Sign Out Button */}
      <AppPage center gap="md" style={{ marginTop: S.space.xl }}>
        <Button
          text={signingOut ? 'Confirm Sign Out' : 'Sign Out'}
          variant="destructive"
          onPress={handleSignOutConfirm}
          disabled={buttonDisabled}
          loading={false}
          style={{ minWidth: 200 }}
        />
      </AppPage>

      {/* Delete Account Button */}
      <AppPage center gap="md" style={{ marginTop: S.space.lg }}>
        <Button
          text={confirmDelete ? 'Confirm Delete' : 'Delete Account'}
          variant="destructive"
          onPress={handleDeleteConfirm}
          disabled={buttonDeleteDisabled}
          style={{ minWidth: 200 }}
        />
      </AppPage>

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
  )
}
