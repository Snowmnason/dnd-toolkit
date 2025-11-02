import LoadingOverlay from '@/components/LoadingOverlay'
import { usePlatform } from '@/contexts/PlatformContext'
import { $, Sizing, UseTheme, tone, useScale } from '@/theme'
import React, { ComponentType, ReactNode, useEffect } from 'react'
import {
  ImageBackground,
  Platform,
  ScrollView,
  StyleProp,
  View,
  ViewProps,
  ViewStyle,
} from 'react-native'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

/* ───────────────────────────────
   🪶 Base AppView Props
──────────────────────────────── */

type SpaceKey = keyof Sizing['space']

export interface AppViewProps extends ViewProps {
  center?: boolean
  gap?: SpaceKey
  tone?: 'base' | 'alt' | 'accent' | 'surface'
  backgroundImage?: any
  children?: ReactNode
  style?: StyleProp<ViewStyle>
  contentContainerStyle?: StyleProp<ViewStyle>
  showScrollIndicator?: boolean
}

export interface AppSplitViewProps extends AppViewProps {
  left?: ReactNode
  right?: ReactNode
  /** Enable slide-in animation for right panel on non-desktop */
  animateRightSlide?: boolean
  /** Controls visibility of right panel when animation is enabled */
  rightVisible?: boolean
}

export interface AppLoadingViewProps extends ViewProps {
  loadMessage?: string
  error?: Error | null
  assetsLoaded?: boolean
}

/* ───────────────────────────────────────────────
   🧱 Base AppView — Internal shared layout logic
──────────────────────────────────────────────── */
function BaseAppView({
  center = false,
  gap = 'md',
  tone: toneVariant = 'base',
  backgroundImage,
  showScrollIndicator = false,
  style,
  contentContainerStyle,
  children,
  variantStyles,
  ...rest
}: AppViewProps & { variantStyles?: ViewStyle }) {
  const { theme } = UseTheme()
  const S = useScale()

  /* Separate child layout properties from ScrollView style properties */
  const layoutProps = ['justifyContent', 'alignItems', 'alignContent', 'flexDirection', 'flexWrap']
  const extractedContentStyle: ViewStyle = {}
  const scrollViewStyle: ViewStyle = {}

  // Extract layout props from style if it's an object
  if (style && typeof style === 'object' && !Array.isArray(style)) {
    Object.entries(style).forEach(([key, value]) => {
      if (layoutProps.includes(key)) {
        extractedContentStyle[key as keyof ViewStyle] = value as any
      } else {
        scrollViewStyle[key as keyof ViewStyle] = value as any
      }
    })
  }

  /* Base styles shared across all variants */
  const base: ViewStyle = {
    flex: 1,
    padding: S.space[gap],
    backgroundColor: $('background', theme),
  }

  /* Handle background image layering */
  const Wrapper = (backgroundImage
    ? ImageBackground
    : View) as ComponentType<any>

  const wrapperProps = backgroundImage
    ? { source: backgroundImage, resizeMode: 'cover' as const }
    : {}

  return (
    <Wrapper {...wrapperProps} style={{ flex: 1 }}>
      <ScrollView
        style={[base, variantStyles, scrollViewStyle]}
        contentContainerStyle={[
          {
            flexGrow: 1,
            justifyContent: center ? 'center' : undefined,
            alignItems: center ? 'center' : undefined,
          },
          extractedContentStyle,
          contentContainerStyle,
        ]}
        showsVerticalScrollIndicator={showScrollIndicator}
        {...rest}
      >
        {children}
      </ScrollView>
    </Wrapper>
  )
}

/* ───────────────────────────────
   📄 Layout Variants
   All extend BaseAppView with specific styles
──────────────────────────────── */

/* ───── AppPage ───── 
   Default page container
   Optionally centered content, standard padding
*/
export function AppPage({
  center = false,
  ...rest
}: AppViewProps) {
  const { theme } = UseTheme()
  
  const variantStyles: ViewStyle = {
    backgroundColor: $('background', theme),
  }
  
  return <BaseAppView center={center} variantStyles={variantStyles} {...rest} />
}

/* ───── AppPanel ───── 
   Elevated panel container
   Rounded corners, themed background, overflow hidden
*/
export function AppPanel({
  tone: toneVariant = 'base',
  ...rest
}: AppViewProps) {
  const S = useScale()
  const { theme } = UseTheme()
  
  const variantStyles: ViewStyle = {
    backgroundColor:
      toneVariant === 'alt'
        ? tone($('background', theme), 'alt', undefined, undefined, theme)
        : toneVariant === 'accent'
        ? tone($('background', theme), 'accent', undefined, undefined, theme)
        : toneVariant === 'surface'
        ? $('surface', theme)
        : $('background', theme),
    borderRadius: S.radius.lg,
    overflow: 'hidden',
  }
  
  return <BaseAppView tone={toneVariant} variantStyles={variantStyles} {...rest} />
}

/* ───── AppSplit ───── 
   Two-column split layout (responsive)
   Desktop: 35% left / 65% right side-by-side
   Mobile: stacked vertically
*/
export function AppSplit({
  left,
  right,
  children,
  gap = 'md',
  showScrollIndicator = false,
  animateRightSlide = false,
  rightVisible = true,
  ...rest
}: AppSplitViewProps) {
  const S = useScale()
  const { theme } = UseTheme()
  const { isDesktop, width } = usePlatform()

  // Shared value to animate right panel in/out on mobile
  const slideProgress = useSharedValue(rightVisible ? 1 : 0)

  useEffect(() => {
    // Animate only when enabled and not desktop
    if (!animateRightSlide || isDesktop) {
      slideProgress.value = rightVisible ? 1 : 0
      return
    }
    slideProgress.value = withTiming(rightVisible ? 1 : 0, {
      duration: 350,
      easing: Easing.out(Easing.cubic),
    })
  }, [rightVisible, animateRightSlide, isDesktop, slideProgress])

  // Animated style for right panel on mobile (slides from right)
  const rightAnimatedStyle = useAnimatedStyle(() => {
    if (isDesktop || !animateRightSlide) return {}
    const translateX = (1 - slideProgress.value) * width
    return {
      transform: [{ translateX }],
    }
  }, [isDesktop, animateRightSlide])
  
  return (
    <View
      style={{
        flex: 1,
        flexDirection: isDesktop ? 'row' : 'column',
        backgroundColor: $('background', theme),
        padding: S.space[gap],
      }}
      {...rest}
    >
      {left && (
        <ScrollView
          style={{
            flex: isDesktop ? 1 : 1,
            width: isDesktop ? '35%' : '100%',
            borderRightWidth: isDesktop ? 1 : 0,
            borderRightColor: tone($('border', theme), 'subtle', undefined, undefined, theme),
            paddingRight: isDesktop ? S.space.md : 0,
          }}
          contentContainerStyle={{
            flexGrow: 1,
          }}
          showsVerticalScrollIndicator={showScrollIndicator}
        >
          {left}
        </ScrollView>
      )}

      {right && (
        isDesktop ? (
          <View
            style={{
              flex: 3,
              width: '65%',
              paddingLeft: S.space.md,
            }}
          >
            {right}
          </View>
        ) : (
          <Animated.View
            style={[
              {
                position: 'absolute',
                left: S.space[gap],
                right: S.space[gap],
                top: S.space[gap],
                bottom: S.space[gap],
                backgroundColor: $('background', theme),
                // Ensure it overlays the left content during slide
                zIndex: 10,
              },
              rightAnimatedStyle,
              // On web, use style.pointerEvents to avoid deprecation
              Platform.OS === 'web' ? { pointerEvents: rightVisible ? 'auto' : 'none' } : {},
            ]}
            // On native, keep prop pointerEvents; on web, omit to avoid deprecation warning
            {...(Platform.OS !== 'web' ? { pointerEvents: (rightVisible ? 'auto' : 'none') as any } : {})}
          >
            {right}
          </Animated.View>
        )
      )}
      
      {/* Render modals, toasts, and other overlays */}
      {children}
    </View>
  )
}

/* ───── AppLoading ───── 
   Loading state overlay
   Shows LoadingOverlay component with message/error
*/
export function AppLoading({
  loadMessage = 'Loading...',
  error = null,
  assetsLoaded = false,
  ...rest
}: AppLoadingViewProps) {
  return (
    <LoadingOverlay
      message={loadMessage}
      error={error}
      assetsLoaded={assetsLoaded}
      {...rest}
    />
  )
}
