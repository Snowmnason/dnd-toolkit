import { Image, ImageProps } from 'react-native'
import Animated from 'react-native-reanimated'

interface CustomLoadProps extends Omit<ImageProps, 'source' | 'style'> {
  size?: 'small' | 'medium' | 'large' | 'xlarge' | number
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center'
  style?: ImageProps['style']
}

export default function CustomLoad({
  size = 'large',
  resizeMode = 'contain',
  style,
  ...props
}: CustomLoadProps) {
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
        source={require('@/assets/images/load.gif')}
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
