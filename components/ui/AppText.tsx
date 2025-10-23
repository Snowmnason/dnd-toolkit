import { S, UseTheme, useThemeTokens } from '@/theme'
import React from 'react'
import { StyleProp, Text, TextProps, TextStyle } from 'react-native'

/* ───────────────────────────────
   🔤 Base AppText
   Handles color + font resolution
──────────────────────────────── */
type AppTextProps = TextProps & {
  fontSize?: string | number
  color?: string
  fontFamily?: string
  fontWeight?: TextStyle['fontWeight']
  italic?: boolean
  variant?: 'regular' | 'semi' | 'bold'
  deco?: 'none' | 'underline' | 'line-through' | 'underline line-through'
  cursor?: 'default' | 'pointer' | 'text'
  align?: 'left' | 'center' | 'right' | 'justify'
  style?: StyleProp<TextStyle>
  children: React.ReactNode
}

function AppText({
  fontSize = '$md',
  color = '$textPrimary',
  fontFamily,
  fontWeight,
  italic,
  variant = 'regular',
  deco = 'none',
  cursor = 'default',
  style,
  children,
  align = 'left',
  ...rest
}: AppTextProps) {
  const { theme } = UseTheme()
  const { resolve } = useThemeTokens()

  const resolved = resolve({
    fontSize,
    color,
    fontFamily: fontFamily ?? theme.fontFamily,
  })

  const weight = (() => {
    if (fontWeight) return fontWeight
    switch (variant) {
      case 'semi': return '600'
      case 'bold': return '700'
      default: return '400'
    }
  })()

  return (
<Text
  {...rest}
  style={
    [
      resolved,
      { fontWeight: weight, fontStyle: italic ? 'italic' : 'normal' },
      style,
    ] as StyleProp<TextStyle>
  }
/>
  )
}

/* ───────────────────────────────
   🏷️ Typography Variants
──────────────────────────────── */

/* — Heading — */
export function Heading({
  fontSize = '$title',
  color = '$textPrimary',
  style,
  ...rest
}: AppTextProps) {
  const { theme } = UseTheme()
  return (
    <AppText
      fontSize={fontSize}
      color={color}
      fontFamily={theme.fontFamilyTitle}
      fontWeight="700"
      style={[{ marginBottom: S.space.lg }, style]}
      {...rest}
    />
  )
}
export function Title(props: AppTextProps) {
  return <Heading style={[{ textAlign: 'center' }, props.style]} {...props} />
}

/* — ObjHeading — */
export function ObjHeading({
  fontSize = '$lg',
  color = '$textPrimary',
  style,
  ...rest
}: AppTextProps) {
  const { theme } = UseTheme()
  return (
    <AppText
      fontSize={fontSize}
      color={color}
      fontFamily={theme.fontFamilyTitle}
      fontWeight="600"
      style={[{ marginBottom: S.space.xs }, style]}
      {...rest}
    />
  )
}

/* — Body — */
export function Body({
  fontSize = '$md',
  color = '$textPrimary',
  variant = 'regular',
  opacity = 1, // 👈 add default opacity
  style,
  ...rest
}: AppTextProps & { opacity?: number }) { // 👈 extend props type
  const { theme } = UseTheme()
  return (
    <AppText
      fontSize={fontSize}
      color={color}
      variant={variant}
      fontFamily={theme.fontFamily}
      style={[{ opacity }, style]} // 👈 merge opacity
      {...rest}
    />
  )
}

/* — Paragraph — */
export function Paragraph({
  fontSize = '$md',
  color = '$textPrimary',
  style,
  ...rest
}: AppTextProps) {
  const { theme } = UseTheme()
  return (
    <AppText
      fontSize={fontSize}
      color={color}
      fontFamily={theme.fontFamilyPara}
      style={style}
      {...rest}
    />
  )
}

/* — SubTitle — */
export function SubTitle({
  fontSize = '$sm',
  color = '$textSecondary',
  style,
  ...rest
}: AppTextProps) {
  const { theme } = UseTheme()
  return (
    <AppText
      fontSize={fontSize}
      color={color}
      italic
      fontFamily={theme.fontFamily}
      style={style}
      {...rest}
    />
  )
}

/* — Caption — */
export function Caption({
  fontSize = '$xs',
  color = '$textSecondary',
  style,
  ...rest
}: AppTextProps) {
  const { theme } = UseTheme()
  return (
    <AppText
      fontSize={fontSize}
      color={color}
      fontFamily={theme.fontFamilyPara}
      style={style}
      {...rest}
    />
  )
}

/* — Link — */
export function Link({
  fontSize = '$md',
  color = '$accent',
  style,
  ...rest
}: AppTextProps) {
  const { theme } = UseTheme()
  return (
    <AppText
      fontSize={fontSize}
      color={color}
      fontFamily={theme.fontFamily}
      fontWeight="600"
      style={[{ textDecorationLine: 'underline' }, style]}
      {...rest}
    />
  )
}

/* — ButtonText — */
export function ButtonText({
  fontSize = '$md',
  color = '$textPrimary',
  style,
  ...rest
}: AppTextProps) {
  const { theme } = UseTheme()
  return (
    <AppText
      fontSize={fontSize}
      color={color}
      fontFamily={theme.fontFamily}
      fontWeight="600"
      style={style}
      {...rest}
    />
  )
}

export function BodyLogin({ style, ...props }: React.ComponentProps<typeof Body>) {
  return (
    <Body
      style={[
        {
          marginBottom:  40, // fallback to 40 S.space.xl ??
          textAlign: 'center',
          paddingHorizontal: S.space.lg ?? 20,
          lineHeight: 22,
        },
        style,
      ]}
      {...props}
    />
  )
}
