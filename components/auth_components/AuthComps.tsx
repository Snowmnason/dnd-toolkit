import { Body, Caption, SubTitle, Title } from '@/components/ui/AppText'
import { Button } from '@/components/ui/BaseButton'
import { S } from '@/theme'
import React from 'react'

/* ────────────────────────────────────────────────
   🔘 Auth Buttons (extend BaseButton)
────────────────────────────────────────────────── */

export function AuthButton({
  style,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      {...props}
      bg="#8B4513"
      borderColor="#8B4513"
      textColor="#F5E6D3"
      style={[{ width: '100%' }, style]}
    />
  )
}

export function AuthButtonSecondary({
  style,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      {...props}
      bg="rgba(139,69,19,0.15)"
      borderColor="#8B4513"
      textColor="#F5E6D3"
      style={[{ width: '100%' }, style]}
    />
  )
}

export function AuthButtonBack({
  style,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      {...props}
      bg="rgba(139,69,19,0.2)"
      borderColor="transparent"
      textColor="#F5E6D3"
      style={[
        {
          height: 36,
          paddingHorizontal: 16,
          borderRadius: S.radius.sm,
          width: 'auto',
          alignSelf: 'flex-start',
        },
        style,
      ]}
    />
  )
}

/* ────────────────────────────────────────────────
   🔤 Auth Text Components (extend AppText)
────────────────────────────────────────────────── */

export function AuthTitle({
  style,
  ...props
}: React.ComponentProps<typeof Title>) {
  return (
    <Title
      {...props}
      color="#F5E6D3"
      align="center"
      style={[{ marginBottom: S.space.lg }, style]}
    />
  )
}

export function AuthSubTitle({
  style,
  ...props
}: React.ComponentProps<typeof SubTitle>) {
  return (
    <SubTitle
      {...props}
      color="#D4AF37"
      align="center"
      style={[{ marginBottom: S.space.md, opacity: 0.9 }, style]}
    />
  )
}

export function AuthBody({
  style,
  ...props
}: React.ComponentProps<typeof Body>) {
  return (
    <Body
      {...props}
      color="#F5E6D3"
      align="center"
      opacity={0.8}
      style={[
        {
          textAlign: 'center',
          lineHeight: 22,
          paddingHorizontal: S.space.lg,
          marginBottom: S.space.lg,
        },
        style,
      ]}
    />
  )
}

AuthBody.InCard = function AuthBodyInCard({
  style,
  ...props
}: React.ComponentProps<typeof Body>) {
  return (
    <Body
      {...props}
      color="#8B4513"
      align="center"
      opacity={0.9}
      style={[
        {
          lineHeight: 20,
          paddingHorizontal: S.space.md,
          marginBottom: S.space.sm,
        },
        style,
      ]}
    />
  )
}

export function AuthCaption({
  style,
  ...props
}: React.ComponentProps<typeof Caption>) {
  return (
    <Caption
      {...props}
      color="#F5E6D3"
      align="center"
      style={[
        {
          marginTop: S.space.md,
          opacity: 0.5,
          lineHeight: 16,
          paddingHorizontal: 20,
        },
        style,
      ]}
    />
  )
}
