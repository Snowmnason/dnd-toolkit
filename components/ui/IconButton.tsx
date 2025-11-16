import { $ } from '@/theme'
import * as Haptics from 'expo-haptics'
import { ReactNode } from 'react'
import {
  GestureResponderEvent,
  Platform,
  Pressable,
  ViewStyle,
} from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { AppTooltip } from './AppToolTip'
import { IconButtonView } from './Resuables/ComponentViews'

/* ───────────────────────────────
   🎨 Types & Variants
──────────────────────────────── */

export type IconButtonVariant = 'text' | 'icon' | 'svg'

export interface IconButtonProps {
  /** Content variant: 'text' (string), 'icon' (ReactNode), 'svg' (SVG component) */
  variant?: IconButtonVariant
  content: ReactNode | string
  onPress?: (event: GestureResponderEvent) => void
  size?: 'sm' | 'md' | 'lg' | number
  disabled?: boolean
  selected?: boolean
  tooltip?: string
  style?: ViewStyle
  textColor?: string
}

/* ───────────────────────────────
   🔘 IconButton - Main Component
   
   Variants:
   - 'text' (default): Renders string as Text
   - 'icon': Renders ReactNode directly (icons from libraries)
   - 'svg': Renders SVG components
──────────────────────────────── */

export function IconButton({
  variant = 'text',
  content,
  onPress,
  size = 'md',
  disabled = false,
  selected = false,
  tooltip,
  style,
  textColor,
}: IconButtonProps) {
  // Reanimated shared values
  const scale = useSharedValue(1)
  const bgOpacity = useSharedValue(selected ? 1 : 0)

  const getSize = (): number => {
    switch (size) {
      case 'sm':
        return 28
      case 'md':
        return 38
      case 'lg':
        return 48
      default:
        return typeof size === 'number' ? size : 38
    }
  }

  const buttonSize = getSize()

  // Handlers
  const handlePressIn = () => {
    if (disabled) return
    scale.value = withTiming(0.88, { duration: 100 })
  }

  const handlePressOut = () => {
    if (disabled) return
    scale.value = withTiming(1, { duration: 100 })
  }

  const handlePress = (event: GestureResponderEvent) => {
    if (disabled) return
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
    onPress?.(event)
  }

  const handleMouseEnter = () => {
    if (disabled || selected) return
    bgOpacity.value = withTiming(1, { duration: 150 })
  }

  const handleMouseLeave = () => {
    if (disabled || selected) return
    bgOpacity.value = withTiming(0, { duration: 100 })
  }

  // Animated styles
  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const bgStyle = useAnimatedStyle(() => ({
    opacity: bgOpacity.value,
    backgroundColor: 'var(--accent)',
  }))

  // Render content based on variant
  const renderContent = () => {
    const accentColor = Platform.OS === 'web' ? 'var(--accent)' : $('accent')
    switch (variant) {
      case 'text': {
        const fontSize = buttonSize / 2
        return (
          <Animated.Text
            style={{
              color: textColor || accentColor,
              fontSize,
              textAlign: 'center',
              fontWeight: '600',
            }}
          >
            {content}
          </Animated.Text>
        )
      }
      case 'icon':
      case 'svg':
      default: {
        // For icon and SVG variants, render as ReactNode
        return content as ReactNode
      }
    }
  }

  const pressableProps: any = {
    accessibilityRole: 'button',
    disabled,
    onPressIn: handlePressIn,
    onPressOut: handlePressOut,
    onPress: handlePress,
  }

  // Add hover handlers for web only
  if (Platform.OS === 'web') {
    pressableProps.onMouseEnter = handleMouseEnter
    pressableProps.onMouseLeave = handleMouseLeave
  }

  const button = (
    <Animated.View style={scaleStyle}>
      <Pressable
        {...pressableProps}
        style={{
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {/* Background layer - animated */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderRadius: buttonSize / 2,
            },
            bgStyle,
          ]}
        />

        {/* IconButtonView - centered content */}
        <IconButtonView
          size={buttonSize}
          backgroundColor="transparent"
          style={[{ zIndex: 10 }, style]}
        >
          {renderContent()}
        </IconButtonView>
      </Pressable>
    </Animated.View>
  )

  // Wrap with tooltip if provided
  if (tooltip) {
    return (
      <AppTooltip text={tooltip} enableMobilePress={true}>
        {button}
      </AppTooltip>
    )
  }

  return button
}
