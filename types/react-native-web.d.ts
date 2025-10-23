import 'react-native'

declare module 'react-native' {
  interface TouchableOpacityProps {
    onMouseEnter?: (event: any) => void
    onMouseLeave?: (event: any) => void
    // Optional bonus (for future hover/tooltip logic)
    onMouseMove?: (event: any) => void
  }
}
