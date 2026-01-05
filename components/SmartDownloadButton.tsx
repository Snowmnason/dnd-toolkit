import { Button } from '@/components/ui'
import { useEffect, useState } from 'react'
import { Linking, Platform } from 'react-native'

type PlatformType = 'ios' | 'android' | 'windows' | 'macos' | 'linux' | 'unknown'

interface SmartDownloadButtonProps {
  onPress?: () => void
  style?: any
  text?: string
}

// GitHub API types
interface GitHubReleaseAsset {
  name: string
  browser_download_url: string
  content_type: string
  size: number
}

interface GitHubRelease {
  assets: GitHubReleaseAsset[]
  tag_name: string
  name: string
}

// Simple in-memory cache for release URLs
// Key: platform, Value: { url: string, timestamp: number }
const releaseUrlCache = new Map<PlatformType, { url: string; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes in milliseconds

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

  // Check cache first
  const cached = releaseUrlCache.get(platform)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.url
  }

  try {
    // Fetch latest release from GitHub API
    const response = await fetch(
      'https://api.github.com/repos/Snowmnason/dnd-toolkit/releases/latest',
      { headers: { Accept: 'application/vnd.github.v3+json' } }
    )
    
    // Check rate limiting headers
    const remaining = response.headers.get('X-RateLimit-Remaining')
    if (remaining !== null) {
      const remainingRequests = parseInt(remaining, 10)
      if (remainingRequests < 5) {
        console.warn(`GitHub API rate limit low: ${remainingRequests} requests remaining`)
      }
    }

    // Handle rate limit exceeded (403)
    if (response.status === 403) {
      const rateLimitReset = response.headers.get('X-RateLimit-Reset')
      if (rateLimitReset) {
        const resetTime = new Date(parseInt(rateLimitReset, 10) * 1000)
        console.error(`GitHub API rate limit exceeded. Reset at: ${resetTime.toISOString()}`)
      }
      // Fall back to releases page
      const fallbackUrl = 'https://github.com/Snowmnason/dnd-toolkit/releases/latest'
      releaseUrlCache.set(platform, { url: fallbackUrl, timestamp: Date.now() })
      return fallbackUrl
    }

    if (!response.ok) {
      console.warn('Failed to fetch latest release, falling back to releases page')
      const fallbackUrl = 'https://github.com/Snowmnason/dnd-toolkit/releases/latest'
      releaseUrlCache.set(platform, { url: fallbackUrl, timestamp: Date.now() })
      return fallbackUrl
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const release: GitHubRelease = await response.json()
    
    // Find the first asset matching the platform pattern
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const asset = release.assets?.find((a: any) => a.name.endsWith(pattern))
    
    if (asset?.browser_download_url) {
      // Cache the successful result
      releaseUrlCache.set(platform, { url: asset.browser_download_url, timestamp: Date.now() })
      return asset.browser_download_url
    }

    // Fallback to releases page if asset not found
    console.warn(`No ${platform} asset found in latest release`)
    const fallbackUrl = 'https://github.com/Snowmnason/dnd-toolkit/releases/latest'
    releaseUrlCache.set(platform, { url: fallbackUrl, timestamp: Date.now() })
    return fallbackUrl
  } catch (error) {
    console.error('Error fetching latest release:', error)
    const fallbackUrl = 'https://github.com/Snowmnason/dnd-toolkit/releases/latest'
    // Cache the fallback for this error too
    releaseUrlCache.set(platform, { url: fallbackUrl, timestamp: Date.now() })
    return fallbackUrl
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
 * Automatically detects platform and provides direct download link with rate limiting & caching
 * - Desktop (Win/Mac/Linux): Directly downloads latest installer from GitHub with rate limit handling
 * - Mobile: Links to app store
 * - Unknown: Links to web version
 * 
 * Features:
 * - Caches release URLs for 5 minutes to reduce API calls
 * - Monitors GitHub API rate limits (60/hour for unauthenticated requests)
 * - Shows loading state during API fetch
 * - Falls back gracefully on rate limit or API errors
 */
export function SmartDownloadButton({
  onPress,
  style,
  text = 'Download Now'
}: SmartDownloadButtonProps) {
  const platform = detectPlatform()
  const [isLoading, setIsLoading] = useState(false)

  // Pre-fetch the download URL on mount to improve UX
  useEffect(() => {
    if (platform === 'ios' || platform === 'android' || platform === 'unknown') {
      // No need to pre-fetch for mobile/unknown (instant store links)
      return
    }

    // Pre-fetch for desktop platforms to avoid delay on click
    getLatestReleaseAssetUrl(platform).catch((error) => {
      console.warn('Error pre-fetching release URL:', error)
    })
  }, [platform])

  const handlePress = async () => {
    if (onPress) {
      onPress()
      return
    }

    setIsLoading(true)
    try {
      let downloadUrl: string
      
      // Mobile platforms use store links (instant)
      if (platform === 'ios' || platform === 'android') {
        downloadUrl = getMobileStoreUrl(platform)
      } else {
        // Desktop platforms fetch latest release asset (cached after first call)
        downloadUrl = await getLatestReleaseAssetUrl(platform)
      }
      
      await Linking.openURL(downloadUrl)
    } catch (error) {
      console.error('Failed to open download link', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant="primary"
      text={isLoading ? 'Preparing download...' : text}
      onPress={handlePress}
      disabled={isLoading}
      style={[style, { minWidth: 800 }]}
    />
  )
}
