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

// Asset patterns for each platform (from electron-builder)
const ASSET_PATTERNS: Record<PlatformType, string | null> = {
  windows: 'Setup.exe', // NSIS installer
  macos: '.dmg', // DMG disk image
  linux: '.AppImage', // AppImage
  ios: null, // App Store
  android: null, // Play Store
  unknown: null
}

async function getLatestReleaseAssetUrl(platform: PlatformType): Promise<string> {
  const pattern = ASSET_PATTERNS[platform]
  
  // For mobile apps, return store links (handled elsewhere)
  if (!pattern) {
    return 'https://dnd-tool.thesnowpost.com'
  }

  try {
    // Fetch latest release from GitHub API
    const response = await fetch(
      'https://api.github.com/repos/Snowmnason/dnd-toolkit/releases/latest',
      { headers: { Accept: 'application/vnd.github.v3+json' } }
    )
    
    if (!response.ok) {
      console.warn('Failed to fetch latest release, falling back to releases page')
      return 'https://github.com/Snowmnason/dnd-toolkit/releases/latest'
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const release: any = await response.json()
    
    // Find the first asset matching the platform pattern
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const asset = release.assets?.find((a: any) => a.name.endsWith(pattern))
    
    if (asset?.browser_download_url) {
      return asset.browser_download_url
    }

    // Fallback to releases page if asset not found
    console.warn(`No ${platform} asset found in latest release`)
    return 'https://github.com/Snowmnason/dnd-toolkit/releases/latest'
  } catch (error) {
    console.error('Error fetching latest release:', error)
    return 'https://github.com/Snowmnason/dnd-toolkit/releases/latest'
  }
}

function getMobileStoreUrl(platform: PlatformType): string {
  const urls: Record<PlatformType, string> = {
    ios: 'https://apps.apple.com/app/dnd-toolkit/id1234567890',
    android: 'https://play.google.com/store/apps/details?id=com.thesnowpost.dndtoolkit',
    windows: '', // Not applicable
    macos: '', // Not applicable
    linux: '', // Not applicable
    unknown: 'https://dnd-tool.thesnowpost.com'
  }
  return urls[platform]
}

/**
 * Smart Download Button
 * Automatically detects platform and provides direct download link
 * - Desktop (Win/Mac/Linux): Directly downloads latest installer from GitHub
 * - Mobile: Links to app store
 * - Unknown: Links to web version
 */
export function SmartDownloadButton({
  onPress,
  style,
  text = 'Download Now'
}: SmartDownloadButtonProps) {
  const platform = detectPlatform()

  const handlePress = async () => {
    if (onPress) {
      onPress()
      return
    }

    try {
      let downloadUrl: string
      
      // Mobile platforms use store links
      if (platform === 'ios' || platform === 'android') {
        downloadUrl = getMobileStoreUrl(platform)
      } else {
        // Desktop platforms fetch latest release asset
        downloadUrl = await getLatestReleaseAssetUrl(platform)
      }
      
      await Linking.openURL(downloadUrl)
    } catch (error) {
      console.error('Failed to open download link', error)
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
