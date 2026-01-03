import { AppPage, AppText, Button, Card, Heading, Surface, Title } from '@/components/ui'
import { usePlatform } from '@/contexts/PlatformContext'
import { tone, useScale, UseTheme } from '@/theme'
import { useEffect, useState } from 'react'
import { Linking, Platform, ScrollView, View } from 'react-native'


type PlatformType = 'ios' | 'android' | 'windows' | 'macos' | 'linux' | 'unknown'

interface DownloadOption {
  id: string
  name: string
  description: string
  emoji: string
  url: string
  platforms: PlatformType[]
  badge?: string
}

const downloadOptions: DownloadOption[] = [
  {
    id: 'app-store',
    name: 'App Store',
    description: 'iPhone & iPad',
    emoji: '🍎',
    url: 'https://apps.apple.com/app/dnd-toolkit/id1234567890',
    platforms: ['ios'],
    badge: 'Coming Soon'
  },
  {
    id: 'google-play',
    name: 'Google Play',
    description: 'Android',
    emoji: '🤖',
    url: 'https://play.google.com/store/apps/details?id=com.thesnowpost.dndtoolkit',
    platforms: ['android'],
    badge: 'Coming Soon'
  },
  {
    id: 'windows',
    name: 'Windows',
    description: 'Windows 10+',
    emoji: '🪟',
    url: 'https://github.com/Snowmnason/dnd-toolkit/releases/download/latest/dnd-toolkit-win-x64.exe',
    platforms: ['windows'],
    badge: 'Coming Soon'
  },
  {
    id: 'macos',
    name: 'macOS',
    description: 'Intel & Apple Silicon',
    emoji: '🍎',
    url: 'https://github.com/Snowmnason/dnd-toolkit/releases/download/latest/dnd-toolkit-macos.dmg',
    platforms: ['macos'],
    badge: 'Coming Soon'
  },
  {
    id: 'linux',
    name: 'Linux',
    description: 'AppImage',
    emoji: '🐧',
    url: 'https://github.com/Snowmnason/dnd-toolkit/releases/download/latest/dnd-toolkit-linux-x64.AppImage',
    platforms: ['linux'],
    badge: 'Coming Soon'
  },
  {
    id: 'web',
    name: 'Web',
    description: 'Browser',
    emoji: '🌐',
    url: 'https://dnd-tool.thesnowpost.com',
    platforms: ['ios', 'android', 'windows', 'macos', 'linux', 'unknown']
  }
]

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
  return names[platform]
}

export default function DownloadScreen() {
  const S = useScale()
  const { theme } = UseTheme()
  const { isDesktop } = usePlatform()
  const [detectedPlatform, setDetectedPlatform] = useState<PlatformType>('unknown')

  useEffect(() => {
    setDetectedPlatform(detectPlatform())
  }, [])

  const recommendedDownload = downloadOptions.find(
    opt => opt.platforms.includes(detectedPlatform) && opt.id !== 'web'
  )

  const handleDownload = (url: string) => {
    Linking.openURL(url).catch(() => {
      console.error('Failed to open URL')
    })
  }

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
          <Title style={{ fontSize: 44, marginBottom: S.space.sm, textAlign: 'center' }}>
            Get D&D Toolkit
          </Title>
          <AppText 
            textType="secondary" 
            style={{ 
              fontSize: 16, 
              textAlign: 'center',
              maxWidth: 720,
              lineHeight: 26,
              marginBottom: S.space.md
            }}
          >
            Manage your campaigns everywhere. Play offline, sync seamlessly, create unforgettable adventures.
          </AppText>
          <Button
            variant="primary"
            text="Try Web Version"
            onPress={() => handleDownload(downloadOptions.find(o => o.id === 'web')!.url)}
            style={{ width: 220 }}
          />
        </View>

        {/* Recommended Download Card */}
        {recommendedDownload && (
          <View style={{ paddingHorizontal: S.space.lg, marginBottom: S.space.xl }}>
            <Surface radius="lg" padded style={{ overflow: 'hidden' }}>
              <View style={{ flexDirection: isDesktop ? 'row' : 'column', alignItems: 'center', gap: S.space.md }}>
                <View style={{ width: isDesktop ? 96 : 72, height: isDesktop ? 96 : 72, borderRadius: S.radius.md, backgroundColor: tone(theme.surface, 'alt', undefined, undefined, theme), alignItems: 'center', justifyContent: 'center' }}>
                  <AppText style={{ fontSize: isDesktop ? 40 : 32 }}>{recommendedDownload.emoji}</AppText>
                </View>

                <View style={{ flex: 1 }}>
                  <AppText color={theme.textInverse} style={{ fontSize: 12, fontWeight: '700', marginBottom: S.space.xs }}>
                    RECOMMENDED FOR {getPlatformName(detectedPlatform).toUpperCase()}
                  </AppText>
                  <Heading style={{ fontSize: 22, color: theme.textInverse }}>{recommendedDownload.name}</Heading>
                  <AppText textType="secondary" style={{ marginTop: S.space.xs, fontSize: 15 }}>
                    {recommendedDownload.description}
                  </AppText>
                </View>

                <View style={{ width: isDesktop ? 220 : '100%', marginTop: isDesktop ? 0 : S.space.md }}>
                  <Button variant="primary" text="Download" onPress={() => handleDownload(recommendedDownload.url)} style={{ width: '100%' }} />
                </View>
              </View>
            </Surface>
          </View>
        )} 

        {/* Grid of all downloads */}
        <View style={{ paddingHorizontal: S.space.lg }}>
          <AppText 
            textType="secondary" 
            style={{ 
              fontSize: 12,
              fontWeight: '600',
              marginBottom: S.space.lg,
              textTransform: 'uppercase'
            }}
          >
            Other Platforms
          </AppText>

          <View style={{ gap: S.space.md, flexDirection: isDesktop ? 'row' : 'column', flexWrap: 'wrap' }}>
            {downloadOptions.filter(opt => !recommendedDownload || opt.id !== recommendedDownload.id).map((option) => (
              <Card key={option.id} padded={true} radius="md" style={{ width: isDesktop ? '48%' : '100%', marginBottom: S.space.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: tone(theme.surface, 'alt', undefined, undefined, theme), alignItems: 'center', justifyContent: 'center', marginRight: S.space.md }}>
                      <AppText style={{ fontSize: 28 }}>{option.emoji}</AppText>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Heading style={{ fontSize: 16 }}>{option.name}</Heading>
                      <AppText textType="secondary" style={{ fontSize: 13, marginTop: 2 }}>{option.description}</AppText>
                    </View>
                  </View>

                  <View style={{ marginLeft: S.space.md }}>
                    <Button variant={option.badge ? 'secondary' : 'primary'} text={option.badge ? 'Notify' : 'Download'} onPress={() => handleDownload(option.url)} />
                  </View>
                </View>
              </Card>
            ))}
          </View> 
        </View>

        {/* Features Section */}
        <View 
          style={{ 
            marginTop: S.space.xl, 
            paddingHorizontal: S.space.lg,
            paddingVertical: S.space.lg,
            backgroundColor: tone(theme.surface, 'alt', undefined, undefined, theme),
            borderRadius: S.radius.lg,
            marginHorizontal: S.space.lg
          }}
        >
          <Heading style={{ fontSize: 20, marginBottom: S.space.md }}>
            Why D&D Toolkit?
          </Heading>
          <View style={{ gap: S.space.md }}>
            {[
              { emoji: '📱', title: 'Multi-Platform', desc: 'Use on phone, tablet, or desktop' },
              { emoji: '🌐', title: 'Cloud Sync', desc: 'Your data syncs across all devices' },
              { emoji: '⚡', title: 'Offline First', desc: 'Play and manage campaigns without internet' },
              { emoji: '🎲', title: 'Built for D&D', desc: 'Features designed by players, for players' }
            ].map((feature, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: S.space.md, alignItems: 'center' }}>
                <AppText style={{ fontSize: 24 }}>
                  {feature.emoji}
                </AppText>
                <View style={{ flex: 1 }}>
                  <AppText style={{ fontWeight: '700', marginBottom: 4, fontSize: 14 }}>
                    {feature.title}
                  </AppText>
                  <AppText textType="secondary" style={{ fontSize: 13 }}>
                    {feature.desc}
                  </AppText>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* CTA Footer */}
        <View style={{ paddingHorizontal: S.space.lg, marginTop: S.space.xl, alignItems: 'center' }}>
          <AppText textType="secondary" style={{ fontSize: 13, textAlign: 'center' }}>
            Questions? Check the{' '}
            <AppText 
              style={{ color: theme.accent, fontWeight: '600' }}
              onPress={() => Linking.openURL('https://github.com/Snowmnason/dnd-toolkit')}
            >
              GitHub
            </AppText>
          </AppText>
        </View>

        <View style={{ height: S.space.xl }} />
      </ScrollView>
    </AppPage>
  )
}
