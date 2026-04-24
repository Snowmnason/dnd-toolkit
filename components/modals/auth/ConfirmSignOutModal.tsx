import AuthError from '@/components/auth_components/AuthError'
import { AppModal, Button } from '@/components/ui'
import { registerModal } from '@/contexts/modal-context'
import { useScale } from '@/theme'
import { View } from 'react-native'

interface ConfirmSignOutModalProps {
  onCancel: () => void
  onConfirm: () => void
  loading?: boolean
  errorText?: string
  syncQueueSize?: number
  /** When true, shows the "Force Sign Out" option — sync failed case. */
  showForceOption?: boolean
  forceActionLabel?: string
  onForceAction?: () => void
  forceActionLoading?: boolean
}

/**
 * 🚪 ConfirmSignOutModal
 * Confirms a standard sign-out, with an optional "Force Sign Out" path
 * when the offline sync queue failed to drain.
 */
export function ConfirmSignOutModal({
  onCancel,
  onConfirm,
  loading = false,
  errorText = '',
  syncQueueSize = 0,
  showForceOption = false,
  forceActionLabel = 'Force Sign Out',
  onForceAction,
  forceActionLoading = false,
}: ConfirmSignOutModalProps) {
  const S = useScale()

  const heading = showForceOption ? 'Sign Out Failed' : 'Sign Out?'
  const body = showForceOption
    ? `Data sync failed. Force sign out anyway? (${syncQueueSize} pending item${syncQueueSize !== 1 ? 's' : ''} may not sync)`
    : `${syncQueueSize} pending item${syncQueueSize !== 1 ? 's' : ''} will be synced.`

  return (
    <AppModal
      visible={true}
      onClose={onCancel}
      heading={heading}
      body={body}
      borderTone="danger"
    >
      <View style={{ width: '100%', marginTop: S.space.sm, gap: S.space.sm }}>
        {!!errorText && <AuthError error={errorText} />}

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'flex-end',
            gap: S.space.sm,
            marginTop: S.space.md,
          }}
        >
          <Button
            text="Cancel"
            variant="secondary"
            onPress={onCancel}
            disabled={loading || forceActionLoading}
          />
          {showForceOption && onForceAction && (
            <Button
              text={forceActionLabel}
              variant="secondary"
              onPress={onForceAction}
              disabled={loading || forceActionLoading}
            />
          )}
          <Button
            text={loading ? 'Processing...' : 'Sign Out'}
            variant="destructive"
            onPress={onConfirm}
            disabled={loading}
          />
        </View>
      </View>
    </AppModal>
  )
}

// Register modal for centralized management
registerModal('confirm-signout', ConfirmSignOutModal)
