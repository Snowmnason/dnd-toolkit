/**
 * 🎨 Gradient Demo
 * Shows all gradient variations for Card and Surface components
 * Run this in StyleDesktop or StyleMobile to see gradients in action
 */

import { Body, Card, Heading, SubTitle, Surface } from '@/components/ui'
import { useScale } from '@/theme'
import React from 'react'
import { ScrollView, View } from 'react-native'

export function GradientDemo() {
  const S = useScale()

  return (
    <ScrollView style={{ flex: 1, padding: S.space.lg }}>
      <Heading>🌈 Gradient System Demo</Heading>
      <Body style={{ marginBottom: S.space.xl }}>
        Tight, dramatic gradients from light to dark
      </Body>

      {/* Cards with Gradients */}
      <Heading style={{ marginTop: S.space.xl, marginBottom: S.space.md }}>
        Cards (Dramatic Gradient by Default)
      </Heading>

      <View style={{ marginBottom: S.space.lg, gap: S.space.md }}>
        <Card gradient>
          <SubTitle>Dramatic Top-to-Bottom (Default)</SubTitle>
          <Body>Tight transition at 70% for strong depth effect</Body>
        </Card>

        <Card gradient gradientDirection="bottom-to-top">
          <SubTitle>Dramatic Bottom-to-Top</SubTitle>
          <Body>Inverted gradient for alternative styling</Body>
        </Card>

        <Card gradient gradientIntensity="moderate">
          <SubTitle>Moderate Intensity</SubTitle>
          <Body>Softer transition, less contrast</Body>
        </Card>

        <Card gradient gradientIntensity="subtle">
          <SubTitle>Subtle Intensity</SubTitle>
          <Body>Very gentle gradient, barely noticeable</Body>
        </Card>

        <Card gradient toneVariant="accent">
          <SubTitle>Accent Variant with Gradient</SubTitle>
          <Body>Gradient applied to accent-toned background</Body>
        </Card>
      </View>

      {/* Surfaces with Gradients */}
      <Heading style={{ marginTop: S.space.xl, marginBottom: S.space.md }}>
        Surfaces (Subtle Gradient by Default)
      </Heading>

      <View style={{ marginBottom: S.space.lg, gap: S.space.md }}>
        <Surface gradient>
          <SubTitle>Subtle Top-to-Bottom (Default)</SubTitle>
          <Body>Gentle gradient for large background panels</Body>
        </Surface>

        <Surface gradient gradientIntensity="dramatic">
          <SubTitle>Dramatic Surface</SubTitle>
          <Body>More pronounced gradient on surface</Body>
        </Surface>

        <Surface gradient variant="elevated">
          <SubTitle>Elevated Variant with Gradient</SubTitle>
          <Body>Gradient on elevated surface tone</Body>
        </Surface>
      </View>

      {/* Comparison */}
      <Heading style={{ marginTop: S.space.xl, marginBottom: S.space.md }}>
        Side-by-Side Comparison
      </Heading>

      <View style={{ flexDirection: 'row', gap: S.space.md, marginBottom: S.space.xxl }}>
        <Card style={{ flex: 1 }}>
          <SubTitle>No Gradient</SubTitle>
          <Body>Flat background</Body>
        </Card>

        <Card gradient style={{ flex: 1 }}>
          <SubTitle>With Gradient</SubTitle>
          <Body>Dramatic depth</Body>
        </Card>
      </View>
    </ScrollView>
  )
}
