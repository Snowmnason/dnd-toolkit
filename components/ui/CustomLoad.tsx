import { UseTheme } from '@/theme'
import { useEffect } from 'react'
import { Image, ImageProps, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

interface CustomLoadProps extends Omit<ImageProps, 'source' | 'style'> {
  size?: 'small' | 'medium' | 'large' | 'xlarge' | number
  /** 'gif' shows the loading GIF (default), 'spinner' shows a rotating ring */
  mode?: 'gif' | 'spinner'
  /** Spinner ring color (default: theme.textSecondary) */
  color?: string
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center'
  style?: ImageProps['style']
}

function SpinnerRing({ size: ringSize, color: ringColor }: { size: number; color: string }) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 800, easing: Easing.linear }),
      -1,
      false,
    );
  }, [rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View
      style={[
        {
          width: ringSize,
          height: ringSize,
          borderRadius: ringSize / 2,
          borderWidth: Math.max(ringSize * 0.1, 2),
          borderColor: ringColor,
          borderTopColor: 'transparent',
        },
        animatedStyle,
      ]}
    />
  );
}

export default function CustomLoad({
  size = 'large',
  mode = 'gif',
  color,
  resizeMode = 'contain',
  style,
  ...props
}: CustomLoadProps) {
  const { theme } = UseTheme()

  const getSizeValue = (): number => {
    switch (size) {
      case 'small': return 30
      case 'medium': return 50
      case 'large': return 100
      case 'xlarge': return 150
      default: return typeof size === 'number' ? size : 60
    }
  }

  const sizeValue = getSizeValue()

  if (mode === 'spinner') {
    return (
      <View
        style={[
          {
            width: sizeValue,
            height: sizeValue,
            alignItems: 'center',
            justifyContent: 'center',
          },
          style,
        ]}
      >
        <SpinnerRing size={sizeValue * 0.8} color={color ?? theme.textSecondary} />
      </View>
    )
  }

  return (
    <Animated.View
      style={[
        {
          width: sizeValue,
          height: sizeValue,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Image
        source={require('@/assets/images/required/load.gif')}
        style={{
          width: sizeValue,
          height: sizeValue,
        }}
        resizeMode={resizeMode}
        {...props}
      />
    </Animated.View>
  )
}
