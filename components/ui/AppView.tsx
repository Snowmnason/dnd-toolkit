import LoadingOverlay from '@/components/LoadingOverlay'
import { $, S, UseTheme, tone, } from '@/theme'
import React, { ComponentType, ReactNode } from 'react'
import {
  ImageBackground,
  Platform,
  ScrollView,
  StyleProp,
  View,
  ViewProps,
  ViewStyle,
  useWindowDimensions,
} from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

// 🪶 Type definitions
type AppViewVariant =
  | 'page'
  | 'panel'
  | 'split'
  | 'loading'

interface AppViewProps extends ViewProps {
    variant?: AppViewVariant
    scroll?: boolean
    center?: boolean
    gap?: keyof typeof S.space
    tone?: 'base' | 'alt' | 'accent' | 'surface'
    backgroundImage?: any
    left?: ReactNode
    right?: ReactNode
    children?: ReactNode
    style?: StyleProp<ViewStyle>

    loadMessage?: string
    error?: Error | null
    assetsLoaded?: boolean
}

/* ───────────────────────────────────────────────
   🧱 AppView — Base layout container
   Handles theming, spacing, scrolling, and layout
──────────────────────────────────────────────── */
export function AppView({
  variant = 'page',
  scroll = false,
  center = false,
  gap = 'md',
  tone: toneVariant = 'base',
  backgroundImage,
  left,
  right,
  style,
  children,

  loadMessage,
  assetsLoaded = false,
  error,
  ...rest
}: AppViewProps) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { theme: _theme } = UseTheme()
  const { width } = useWindowDimensions()
  const isDesktop = Platform.OS === 'web' && width >= 900

  /* Animation stubs — used for future slide/gesture logic */
  const slide = useSharedValue(0)
  const slideAnim = useAnimatedStyle(() => ({
    transform: [{ translateX: withTiming(slide.value * -width) }],
  }))

    if (variant === 'loading') {
    return (
      <LoadingOverlay
        message={loadMessage ?? 'Loading...'}
        error={error}
        assetsLoaded={assetsLoaded}
      />
    )
  }

  /* Base styles shared across all variants */
  const base: ViewStyle = {
    flex: 1,
    padding: S.space[gap],
    backgroundColor: $('background'),
  }

  /* Variant definitions */
  const variants: Record<AppViewVariant, ViewStyle> = {
    page: {
      justifyContent: center ? 'center' : undefined,
      alignItems: center ? 'center' : undefined,
      backgroundColor: $('background'),
    },
    panel: {
      flex: 1,
        backgroundColor:
        toneVariant === 'alt'
            ? tone($('background'), 'alt')
            : toneVariant === 'accent'
            ? tone($('background'), 'accent')
            : toneVariant === 'surface'
            ? $('surface')
            : $('background'),
      borderRadius: S.radius.lg,
      overflow: 'hidden',
    },
    split: {
      flex: 1,
      flexDirection: isDesktop ? 'row' : 'column',
      backgroundColor: $('background'),
    },
    loading: {
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: $('background'),
    },
  }

  /* Handle background image layering (for panel variant) */
    const Wrapper = (backgroundImage
    ? ImageBackground
    : View) as ComponentType<any>

    const wrapperProps = backgroundImage
    ? { source: backgroundImage, resizeMode: 'cover' as const }
    : {}

  /* Core content renderer */
  const Content = (
    <Animated.View
      style={[
        base,
        variants[variant],
        slideAnim,
        style,
      ]}
      {...rest}
    >
      {/* Split variant logic */}
      {variant === 'split' ? (
        <>
          <View
            style={{
              flex: isDesktop ? 1 : undefined,
              width: isDesktop ? '35%' : '100%',
              borderRightWidth: isDesktop ? 1 : 0,
              borderRightColor: tone($('border'), 'subtle'),
              paddingRight: isDesktop ? S.space.md : 0,
            }}
          >
            {scroll ? (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: S.space.xl }}
              >
                {left}
              </ScrollView>
            ) : (
              left
            )}
          </View>

          <View
            style={{
              flex: isDesktop ? 2 : undefined,
              width: isDesktop ? '65%' : '100%',
              paddingLeft: isDesktop ? S.space.md : 0,
              marginTop: isDesktop ? 0 : S.space.lg,
            }}
          >
            {scroll ? (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: S.space.xl }}
              >
                {right ?? children}
              </ScrollView>
            ) : (
              right ?? children
            )}
          </View>
        </>
      ) : scroll ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: center ? 'center' : undefined,
            paddingBottom: S.space.xl,
          }}
        >
          {children}
        </ScrollView>
      ) : (
        children
      )}
    </Animated.View>
  )

  /* Return wrapped (with optional image) */
  return <Wrapper {...wrapperProps}>{Content}</Wrapper>
}

/* Optional: named aliases for clarity */

export const AppPanel = (props: AppViewProps) => (
  <AppView {...props} variant="panel" />
)

export const AppSplitView = (props: AppViewProps) => (
  <AppView {...props} variant="split" />
)


export const AppLoadingView = (props: AppViewProps) => (
  <AppView {...props} variant="loading" center scroll={false} />
)
