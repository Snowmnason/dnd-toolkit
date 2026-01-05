import { View } from 'react-native'
import CustomLoad from './ui/CustomLoad'

interface LoadingOverlayProps {
  message?: string
  error?: Error | null
  assetsLoaded?: boolean
}

export default function LoadingOverlay({
  message = 'Loading...',
  error,
  assetsLoaded = false,
}: LoadingOverlayProps) {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#2f353d',
        zIndex: 9999,
      }}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={assetsLoaded ? 'Checking authentication...' : message}
    >
      <CustomLoad size="large" />
    </View>
  )
}
