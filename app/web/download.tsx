import { SmartDownloadButton } from '@/components/SmartDownloadButton'
import { AppPage, Body, Caption, Heading, Surface, Title } from '@/components/ui'
import { usePlatform } from '@/contexts/PlatformContext'
import { useScale } from '@/theme'
import { useEffect, useState } from 'react'
import { Platform, ScrollView, View } from 'react-native'

type PlatformType = 'ios' | 'android' | 'windows' | 'macos' | 'linux' | 'unknown'

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

function getPlatformName(platform: PlatformType): string {
  const names: Record<PlatformType, string> = {
    ios: 'iOS',
    android: 'Android',
    windows: 'Windows',
    macos: 'macOS',
    linux: 'Linux',
    unknown: 'Your Device'
  }
  // Safe access: platform is constrained to PlatformType which has all keys in names
  return names[platform as PlatformType]
}

export default function DownloadScreen() {
  const S = useScale()
  const { isDesktop } = usePlatform()
  const [detectedPlatform, setDetectedPlatform] = useState<PlatformType>('unknown')

  useEffect(() => {
    setDetectedPlatform(detectPlatform())
  }, [])

  return (
    <AppPage tone="base">
      <ScrollView 
        contentContainerStyle={{ 
          paddingTop: S.space.xl,
          paddingBottom: S.space.xl
        }}
      >
        {/* Hero Section */}
        <View style={{ alignItems: 'center', paddingHorizontal: S.space.lg, marginBottom: S.space.xl }}>
          <Title style={{ marginBottom: S.space.md, textAlign: 'center' }}>
            Download D&D Toolkit
          </Title>
          <Body 
            textType="secondary" 
            style={{ 
              textAlign: 'center',
              maxWidth: 600,
              marginBottom: S.space.lg
            }}
          >
            Manage your campaigns everywhere. Play offline, sync seamlessly, create unforgettable adventures.
          </Body>

          {/* Smart Download Button - One Button to Rule Them All */}
          <SmartDownloadButton style={{ width: isDesktop ? 240 : '100%', maxWidth: 400 }} />

          <Caption 
            textType="secondary" 
            style={{ 
              marginTop: S.space.md,
              textAlign: 'center'
            }}
          >
            {detectedPlatform === 'unknown' 
              ? 'Downloading for ' + getPlatformName(detectedPlatform)
              : 'Optimized download for ' + getPlatformName(detectedPlatform)
            }
          </Caption>
        </View>

        {/* Platform Cards Section */}
        <View style={{ paddingHorizontal: S.space.lg }}>
        </View>

        {/* Info Section */}
        <View style={{ paddingHorizontal: S.space.lg, marginTop: S.space.xl }}>
          <Surface radius="lg" padded variant="base">
            <Heading style={{ marginBottom: S.space.md }}>Why Download?</Heading>
            <View style={{ gap: S.space.sm }}>
              <View style={{ flexDirection: 'row', gap: S.space.md }}>
                <Body style={{ fontSize: 20 }}>⚡</Body>
                <Body textType="secondary" style={{ flex: 1 }}>
                  <Body style={{ fontWeight: '600' }}>Faster Performance</Body>
                  {' '}– Native desktop app runs smoother than web
                </Body>
              </View>
              <View style={{ flexDirection: 'row', gap: S.space.md }}>
                <Body style={{ fontSize: 20 }}>🔌</Body>
                <Body textType="secondary" style={{ flex: 1 }}>
                  <Body style={{ fontWeight: '600' }}>Offline Support</Body>
                  {' '}– Access campaigns even without internet
                </Body>
              </View>
              <View style={{ flexDirection: 'row', gap: S.space.md }}>
                <Body style={{ fontSize: 20 }}>📲</Body>
                <Body textType="secondary" style={{ flex: 1 }}>
                  <Body style={{ fontWeight: '600' }}>Always Updated</Body>
                  {' '}– Auto-updates keep you on the latest version
                </Body>
              </View>
            </View>
          </Surface>
        </View>
      </ScrollView>
    </AppPage>
  )
}
