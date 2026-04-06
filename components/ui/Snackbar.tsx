import { useScale } from '@/theme'
import { View } from 'react-native'
import { Body, Link } from './AppText'
import { ComponentView } from './Resuables/ComponentViews'
import { getShadowStyle } from './Resuables/shadows'

export interface SnackBarProps {
  message: string
  tone?: 'success' | 'warning' | 'error' | 'info'
  actionText?: string
  onAction?: () => void
}

/**
 * 🍫 SnackBar — Pure Visual Component
 * Renders the styled snackbar content (message + optional action button).
 * Positioning, animation, timing, and keyboard awareness are handled by SnackBarLayer.
 */
export function SnackBar({
  message,
  tone: toneType = 'info',
  actionText,
  onAction,
}: SnackBarProps) {
  const S = useScale()

  const borderTone =
    toneType === 'success'
      ? 'success'
      : toneType === 'error'
      ? 'danger'
      : toneType === 'warning'
      ? 'warning'
      : 'info'

  return (
    <ComponentView
      gradient
      borderTone={borderTone as 'success' | 'danger' | 'warning' | 'info'}
      gradientIntensity={35}
      gradientTransitionPoint={65}
      gradientDirection={181}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: S.space.sm,
        paddingHorizontal: S.space.md,
        borderRadius: S.radius.lg,
        ...getShadowStyle('softer'),
      }}
    >
      <Body textType='inverse' style={{ flex: 1 }}>
        {message}
      </Body>

      {/* Fixed action column - always reserve space */}
      <View style={{ alignItems: 'flex-end', minWidth: 80 }}>
        {actionText && onAction && (
          <Link onPress={onAction}>
            {actionText}
          </Link>
        )}
      </View>
    </ComponentView>
  )
}
