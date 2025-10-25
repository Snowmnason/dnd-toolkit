import { $, tone, useScale } from '@/theme'
import * as Haptics from 'expo-haptics'
import React, { useEffect } from 'react'
import {
    Animated,
    BackHandler,
    Dimensions,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
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

  // ✅ Platform-based sizing
  const modalWidth =
    width ??
    (Platform.OS === 'ios' || Platform.OS === 'android'
      ? screenWidth * 0.9 // mobile
      : Math.min(screenWidth * 0.6, 600)) // web / desktop

  const fadeAnim = React.useRef(new Animated.Value(0)).current
  const slideAnim = React.useRef(new Animated.Value(30)).current
  const shake = React.useRef(new Animated.Value(0)).current

  // 🔹 Fade + slide + (optional shake) animation
  useEffect(() => {
    if (visible) {
      // ✅ Haptic feedback on open
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
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
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 6,
          useNativeDriver: true,
        }),
      ]).start()

      // 💥 Optional "panic" shake if destructive
      if (borderTone === 'danger' && animateOnDestruction) {
        // Slight delay so it feels natural
        setTimeout(() => {
          Animated.sequence([
            Animated.timing(shake, { toValue: -10, duration: 80, useNativeDriver: true }),
            Animated.timing(shake, { toValue: 10, duration: 80, useNativeDriver: true }),
            Animated.timing(shake, { toValue: -6, duration: 60, useNativeDriver: true }),
            Animated.timing(shake, { toValue: 6, duration: 60, useNativeDriver: true }),
            Animated.timing(shake, { toValue: 0, duration: 50, useNativeDriver: true }),
          ]).start()

          // Optional haptic feedback during shake (extra tactile "panic")
          if (Platform.OS === 'ios' || Platform.OS === 'android') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
          }
        }, 300)
      }
    } else {
      // Fade + slide out
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 30,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [visible, fadeAnim, slideAnim, borderTone, animateOnDestruction, shake])


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

  if (!visible) return null

  const overlayColor = dimColor
    ? dimColor
    : accentOverlay
    ? tone($('accent'), 'alt')
    : 'rgba(0,0,0,0.45)'

  return (
    <Modal transparent visible={visible} animationType="none">
      <Pressable
        onPress={handleOutsidePress}
        style={[styles.backdrop, { backgroundColor: overlayColor }]}
      >
        <View style={styles.safetyZone}>
          <Pressable style={{ flex: 1 }} onPress={() => {}}>
            {/* absorbs near-clicks */}
          </Pressable>
        </View>
      </Pressable>

      <View style={[styles.center, { pointerEvents: 'box-none' }]}>
        <Animated.View
          style={[
            styles.modalContainer,
            {
              width: modalWidth,
              height: height ?? 'auto',
              backgroundColor: $('surface'),
              borderRadius: S.radius.lg,
              padding: S.space.lg,
              borderColor:
              (borderTone === 'success'
                ? $('success')
                : borderTone === 'warning'
                ? $('warning')
                : borderTone === 'danger'
                ? $('danger')
                : $('accent')),
              opacity: fadeAnim,
              transform: [
                { translateY: slideAnim },
                { translateX: shake }, // 👈 added
              ],
            },
          ]}
        >
          <View style={[styles.closeButton, { top: S.space.sm, right: S.space.sm }]}>
            <IconButton icon="✕" onPress={onClose} />
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
      </View>
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
