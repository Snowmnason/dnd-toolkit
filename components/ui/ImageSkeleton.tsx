import { $, useScale } from '@/theme'
import { useEffect } from 'react'
import { View, ViewStyle } from 'react-native'
import Animated, {
    cancelAnimation,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated'

interface ImageSkeletonProps {
  width?: number | string
  height?: number | string
  borderRadius?: number
  style?: ViewStyle
}

/**
 * ImageSkeleton - Animated placeholder for loading images
 * 
 * Displays a pulsing skeleton loader while images are loading.
 * Uses theme-aware colors and smooth animations.
 * 
 * @example
 * ```tsx
 * <ImageSkeleton width="100%" height={200} borderRadius={8} />
 * ```
 */
export function ImageSkeleton({
  width = '100%',
  height = 200,
  borderRadius,
  style,
}: ImageSkeletonProps) {
  const S = useScale()
  const opacity = useSharedValue(0.3)

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 1000 }),
        withTiming(0.3, { duration: 1000 })
      ),
      -1,
      false
    )

    return () => {
      cancelAnimation(opacity)
    }
  }, [opacity])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }))

  return (
    <View
      style={[
        {
          width: width as any,
          height: height as any,
          backgroundColor: $('surface'),
          borderRadius: borderRadius ?? S.radius.md,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          {
            width: '100%',
            height: '100%',
            backgroundColor: $('border'),
          },
          animatedStyle,
        ]}
      />
    </View>
  )
}
