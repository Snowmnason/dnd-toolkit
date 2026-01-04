import { Button } from '@/components/ui'
import { Linking, Platform } from 'react-native'

type PlatformType = 'ios' | 'android' | 'windows' | 'macos' | 'linux' | 'unknown'

interface SmartDownloadButtonProps {
  onPress?: () => void
  style?: any
  text?: string
}

function detectPlatform(): PlatformType {
  if (Platform.OS === 'web') {
    if (typeof navigator === 'undefined') return 'unknown'
    
    const ua = navigator.userAgent.toLowerCase()
    if (ua.indexOf('win') > -1) return 'windows'
    if (ua.indexOf('mac') > -1) return 'macos'
    if (ua.indexOf('linux') > -1) return 'linux'
    if (ua.indexOf('iphone') > -1 || ua.indexOf('ipad') > -1) return 'ios'
    if (ua.indexOf('android') > -1) return 'android'
  }
  return 'unknown'
}

function getDownloadUrl(platform: PlatformType): string {
  const urls: Record<PlatformType, string> = {
    windows: 'https://github.com/Snowmnason/dnd-toolkit/releases/latest',
    macos: 'https://github.com/Snowmnason/dnd-toolkit/releases/latest',
    linux: 'https://github.com/Snowmnason/dnd-toolkit/releases/latest',
    ios: 'https://apps.apple.com/app/dnd-toolkit/id1234567890',
    android: 'https://play.google.com/store/apps/details?id=com.thesnowpost.dndtoolkit',
    unknown: 'https://dnd-tool.thesnowpost.com'
  }
  return urls[platform]
}

/**
 * Smart Download Button
 * Automatically detects platform and provides appropriate download link
 * - Desktop (Win/Mac/Linux): Links to GitHub releases
 * - Mobile: Links to app store or does nothing with option to redirect
 * - Unknown: Links to web version
 */
export function SmartDownloadButton({
  onPress,
  style,
  text = 'Download Now'
}: SmartDownloadButtonProps) {
  const platform = detectPlatform()
  const downloadUrl = getDownloadUrl(platform)

  const handlePress = async () => {
    if (onPress) {
      onPress()
    } else {
      try {
        await Linking.openURL(downloadUrl)
      } catch (error) {
        console.error('Failed to open download link', error)
      }
    }
  }

  return (
    <Button
      variant="primary"
      text={text}
      onPress={handlePress}
      style={[style, { minWidth: 800 }]}
    />
  )
}
