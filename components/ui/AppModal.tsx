import { usePlatform } from '@/contexts/PlatformContext'
import { $, tone, useScale, UseTheme } from '@/theme'
import * as Haptics from 'expo-haptics'
import React, { useEffect } from 'react'
import {
  Animated,
  BackHandler,
  Dimensions,
  Easing,
  Modal,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native'
import { Body, Heading } from './AppText'
import { IconButton } from './IconButton'

type BorderTone = 'accent' | 'success' | 'warning' | 'danger'

interface AppModalProps {
  visible: boolean
  onClose: () => void
  heading: string
  body?: string | null
  disableOutsideClose?: boolean
  dimColor?: string
  accentOverlay?: boolean
  borderTone?: BorderTone   
  width?: number | 'auto'
  height?: number | 'auto'
  children?: React.ReactNode
  animateOnDestruction?: boolean
}

export function AppModal({
  visible,
  onClose,
  heading,
  body = null,
  disableOutsideClose = false,
  dimColor,
  borderTone = 'accent',
  accentOverlay = false,
  width,
  height,
  animateOnDestruction = false,
  children,
}: AppModalProps) {
  const { width: screenWidth } = Dimensions.get('window')
  const S = useScale()
  const { theme } = UseTheme()
  const { isMobile } = usePlatform()
  const isWeb = Platform.select({ web: true, default: false }) as boolean

  // ✅ Platform-based sizing
  const modalWidth = width ?? (isMobile ? screenWidth * 0.9 : Math.min(screenWidth * 0.9, 700))

  const fadeAnim = React.useRef(new Animated.Value(0)).current
  // Web: slide down (start above). Native: slide up (start below).
  const initialTranslateY = isWeb ? -S.space.xxl * 3 : S.space.lg
  const slideAnim = React.useRef(new Animated.Value(initialTranslateY)).current
  // Subtle scale for web during slide (gives depth); native stays at 1
  const initialScale = isWeb ? 0.96 : 1
  const scaleAnim = React.useRef(new Animated.Value(initialScale)).current
  const shake = React.useRef(new Animated.Value(0)).current
  // Keep modal mounted long enough to play exit animation
  const [rendered, setRendered] = React.useState(visible)

  // 🔹 Fade + slide + (optional shake) animation
  useEffect(() => {
    if (visible) {
      // Ensure it's mounted before animating in
      setRendered(true)
      // Reset positions for a fresh entrance
      slideAnim.setValue(initialTranslateY)
      fadeAnim.setValue(0)
      scaleAnim.setValue(initialScale)
      // ✅ Haptic feedback on open
      if (isMobile) {
        // Light open haptic, stronger if destructive
        const hapticStyle =
          borderTone === 'danger'
            ? Haptics.ImpactFeedbackStyle.Medium
            : Haptics.ImpactFeedbackStyle.Light
        Haptics.impactAsync(hapticStyle)
      }

      // Start fade + slide in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: isMobile,
        }),
        isWeb
          ? Animated.timing(slideAnim, {
              toValue: 0,
              duration: 280,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: false,
            })
          : Animated.spring(slideAnim, {
              toValue: 0,
              friction: 6,
              useNativeDriver: isMobile,
            }),
        isWeb
          ? Animated.timing(scaleAnim, {
              toValue: 1,
              duration: 280,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: false,
            })
          : Animated.timing(scaleAnim, {
              toValue: 1,
              duration: 1,
              useNativeDriver: isMobile,
            }),
  ]).start()

      // 💥 Optional "panic" shake if destructive
      if (borderTone === 'danger' && animateOnDestruction) {
        // Slight delay so it feels natural
        setTimeout(() => {
          Animated.sequence([
            Animated.timing(shake, { toValue: -10, duration: 80, useNativeDriver: Platform.OS !== 'web' }),
            Animated.timing(shake, { toValue: 10, duration: 80, useNativeDriver: Platform.OS !== 'web' }),
            Animated.timing(shake, { toValue: -6, duration: 60, useNativeDriver: Platform.OS !== 'web' }),
            Animated.timing(shake, { toValue: 6, duration: 60, useNativeDriver: Platform.OS !== 'web' }),
            Animated.timing(shake, { toValue: 0, duration: 50, useNativeDriver: Platform.OS !== 'web' }),
          ]).start()

          // Optional haptic feedback during shake (extra tactile "panic")
          if (isMobile) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
          }
        }, 300)
      }
    } else {
      // Fade + slide out
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: isMobile,
        }),
        isWeb
          ? Animated.timing(slideAnim, {
              toValue: initialTranslateY,
              duration: 220,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: false,
            })
          : Animated.timing(slideAnim, {
              toValue: initialTranslateY,
              duration: 200,
              useNativeDriver: isMobile,
            }),
        isWeb
          ? Animated.timing(scaleAnim, {
              toValue: initialScale,
              duration: 200,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: false,
            })
          : Animated.timing(scaleAnim, {
              toValue: 1,
              duration: 1,
              useNativeDriver: isMobile,
            }),
      ]).start(() => {
        // After exit animation completes, unmount
        setRendered(false)
      })
    }
  }, [visible, fadeAnim, slideAnim, scaleAnim, borderTone, animateOnDestruction, shake, isMobile, isWeb, initialTranslateY, initialScale])


  const handleOutsidePress = () => {
    if (!disableOutsideClose) onClose()
  }

  // 🔹 Hardware back + Escape key
  useEffect(() => {
    if (!visible) return

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    const handleBackPress = () => {
      onClose()
      return true
    }

    document?.addEventListener?.('keydown', handleKeyPress)
    const backSub = BackHandler.addEventListener('hardwareBackPress', handleBackPress)

    return () => {
      document?.removeEventListener?.('keydown', handleKeyPress)
      backSub?.remove()
    }
  }, [visible, onClose])

  if (!rendered) return null

  const overlayColor = dimColor
    ? dimColor
    : accentOverlay
    ? tone($('accent', theme), 'changeOpacity', undefined, .35, theme)
    : 'rgba(0, 0, 0, 0.45)'

  return (
  <Modal transparent visible={rendered} animationType="none">
      <TouchableOpacity
        activeOpacity={1}
        onPress={handleOutsidePress}
        style={[styles.backdrop, { backgroundColor: overlayColor }]}
      >
        <View style={styles.center}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <Animated.View
              style={[
                styles.modalContainer,
                {
                  width: modalWidth,
                  height: height ?? 'auto',
                  backgroundColor: $('surface', theme),
                  borderRadius: S.radius.lg,
                  padding: S.space.lg,
                  borderColor:
                  (borderTone === 'success'
                    ? $('success', theme)
                    : borderTone === 'warning'
                    ? $('warning', theme)
                    : borderTone === 'danger'
                    ? $('danger', theme)
                    : $('accent', theme)),
                  opacity: fadeAnim,
                  transform: [
                    { translateY: slideAnim },
                    { scale: scaleAnim },
                    { translateX: shake }, // 👈 added
                  ],
                },
              ]}
            >
              <View style={[styles.closeButton, { top: S.space.sm, right: S.space.sm }]}>
                <IconButton icon="✕" fontColor={$('textPrimary', theme)} onPress={onClose} />
              </View>

              <Heading align="center" style={{ marginBottom: body ? S.space.sm : S.space.md }}>
                {heading}
              </Heading>

              {body && (
                <Body align="center" style={{ marginBottom: children ? S.space.md : 0 }}>
                  {body}
                </Body>
              )}

              {children}
            </Animated.View>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  safetyZone: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    margin: 20,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    borderWidth: 2,
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.25)',
    elevation: 6,
  },
  closeButton: {
    position: 'absolute',
    zIndex: 10,
  },
})
