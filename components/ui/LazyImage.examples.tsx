/**
 * LazyImage Usage Examples
 * 
 * This file demonstrates various use cases for the LazyImage component
 * with best practices for different scenarios.
 */

import { LazyImage } from '@/components/ui'
import { View } from 'react-native'

// ============================================================================
// Example 1: Basic Large Image (World Map)
// ============================================================================
export function WorldMapExample({ mapUrl }: { mapUrl: string }) {
  return (
    <LazyImage
      src={mapUrl}
      width="100%"
      height={500}
      contentFit="cover"
      optimizeSupabase
      optimizeWidth={1200}
      optimizeQuality={85}
      showSkeleton
    />
  )
}

// ============================================================================
// Example 2: Avatar with Fallback
// ============================================================================
export function AvatarExample({ 
  avatarUrl, 
  fallbackImage 
}: { 
  avatarUrl: string
  fallbackImage: any 
}) {
  return (
    <LazyImage
      src={avatarUrl}
      fallbackSrc={fallbackImage}
      width={80}
      height={80}
      borderRadius={40}
      contentFit="cover"
      optimizeSupabase
      optimizeWidth={200}
      optimizeQuality={90}
    />
  )
}

// ============================================================================
// Example 3: Thumbnail in a List
// ============================================================================
export function ThumbnailExample({ thumbnailUrl }: { thumbnailUrl: string }) {
  return (
    <LazyImage
      src={thumbnailUrl}
      width={120}
      height={80}
      borderRadius={8}
      contentFit="cover"
      optimizeSupabase
      optimizeWidth={300}
      optimizeQuality={75}
      threshold={0.2}
      rootMargin="100px"
    />
  )
}

// ============================================================================
// Example 4: Hero/Banner Image
// ============================================================================
export function HeroImageExample({ bannerUrl }: { bannerUrl: string }) {
  return (
    <LazyImage
      src={bannerUrl}
      width="100%"
      height={400}
      contentFit="cover"
      optimizeSupabase
      optimizeWidth={1600}
      optimizeQuality={90}
      showSkeleton
      transition={500}
    />
  )
}

// ============================================================================
// Example 5: Card with Image
// ============================================================================
export function CardImageExample({ 
  imageUrl, 
  title 
}: { 
  imageUrl: string
  title: string 
}) {
  return (
    <View style={{ width: 300, borderRadius: 12, overflow: 'hidden' }}>
      <LazyImage
        src={imageUrl}
        width="100%"
        height={200}
        contentFit="cover"
        optimizeSupabase
        optimizeWidth={600}
        optimizeQuality={80}
      />
      {/* Card content here */}
    </View>
  )
}

// ============================================================================
// Example 6: Full-Screen Background
// ============================================================================
export function BackgroundImageExample({ bgUrl }: { bgUrl: string }) {
  return (
    <View style={{ flex: 1, position: 'relative' }}>
      <LazyImage
        src={bgUrl}
        width="100%"
        height="100%"
        contentFit="cover"
        optimizeSupabase
        optimizeWidth={1600}
        optimizeQuality={80}
        showSkeleton
        containerStyle={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      />
      {/* Foreground content here */}
    </View>
  )
}

// ============================================================================
// Example 7: Gallery Item with Custom Skeleton
// ============================================================================
export function GalleryItemExample({ imageUrl }: { imageUrl: string }) {
  return (
    <LazyImage
      src={imageUrl}
      width={250}
      height={250}
      borderRadius={16}
      contentFit="cover"
      optimizeSupabase
      optimizeWidth={500}
      optimizeQuality={85}
      showSkeleton
      threshold={0.1}
      rootMargin="200px"
    />
  )
}

// ============================================================================
// Example 8: Non-Supabase Image (External URL)
// ============================================================================
export function ExternalImageExample({ imageUrl }: { imageUrl: string }) {
  return (
    <LazyImage
      src={imageUrl}
      width="100%"
      height={300}
      contentFit="cover"
      optimizeSupabase={false}  // Disable Supabase optimization for external URLs
      showSkeleton
    />
  )
}

// ============================================================================
// Example 9: Conditional Lazy Loading
// ============================================================================
export function ConditionalExample({ 
  imageUrl, 
  isLargeImage 
}: { 
  imageUrl: string
  isLargeImage: boolean 
}) {
  // Use LazyImage for large images, regular Image for small ones
  if (isLargeImage) {
    return (
      <LazyImage
        src={imageUrl}
        width="100%"
        height={500}
        optimizeSupabase
        optimizeWidth={1200}
        optimizeQuality={85}
      />
    )
  }
  
  // For small images, you might use regular Image component
  // import { Image } from 'expo-image'
  // return <Image source={{ uri: imageUrl }} style={{ width: 50, height: 50 }} />
  return null
}

// ============================================================================
// Example 10: Profile Header with Multiple Images
// ============================================================================
export function ProfileHeaderExample({
  bannerUrl,
  avatarUrl,
  fallbackAvatar,
}: {
  bannerUrl: string
  avatarUrl: string
  fallbackAvatar: any
}) {
  return (
    <View style={{ position: 'relative' }}>
      {/* Banner */}
      <LazyImage
        src={bannerUrl}
        width="100%"
        height={200}
        contentFit="cover"
        optimizeSupabase
        optimizeWidth={1200}
        optimizeQuality={85}
      />
      
      {/* Avatar overlapping banner */}
      <View style={{ position: 'absolute', bottom: -40, left: 20 }}>
        <LazyImage
          src={avatarUrl}
          fallbackSrc={fallbackAvatar}
          width={100}
          height={100}
          borderRadius={50}
          contentFit="cover"
          optimizeSupabase
          optimizeWidth={200}
          optimizeQuality={90}
          containerStyle={{
            borderWidth: 4,
            borderColor: '#fff',
          }}
        />
      </View>
    </View>
  )
}
