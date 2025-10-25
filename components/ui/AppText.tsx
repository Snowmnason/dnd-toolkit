import { useScale, UseTheme } from '@/theme'
import React from 'react'
import { Platform, StyleProp, Text, TextProps, TextStyle } from 'react-native'

/* ───────────────────────────────
   🔤 Base AppText
   Handles color + font resolution
   All typography variants extend this
──────────────────────────────── */

export type TextType = 'primary' | 'secondary' | 'inverse' | 'onAccent' | 'onCard'

export type AppTextProps = TextProps & {
  textType?: TextType
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
  opacity?: number
  lineHeight?: number
  children?: React.ReactNode
}

export function AppText({
  textType = 'primary',
  fontSize = '$body1',
  color,
  fontFamily,
  fontWeight,
  italic = false,
  variant = 'regular',
  deco = 'none',
  cursor = 'default',
  align = 'left',
  opacity = 1,
  lineHeight = 24,
  style,
  children,
  ...rest
}: AppTextProps) {
  const { theme } = UseTheme()
  const S = useScale()

  // Resolve token strings to actual values
  const resolvedFontSize = (() => {
    if (typeof fontSize === 'string' && fontSize.startsWith('$')) {
      const token = fontSize.slice(1) as keyof typeof S.font
      return S.font[token] ?? fontSize
    }
    return fontSize
  })() as number

  // Resolve color: custom color overrides textType
  const resolvedColor = (() => {
    // Custom color takes priority
    if (color) {
      // Resolve token if it starts with $
      if (typeof color === 'string' && color.startsWith('$')) {
        return theme[color.slice(1) as keyof typeof theme] as string
      }
      return color
    }
    
    // Otherwise use textType
    switch (textType) {
      case 'primary': return theme.textPrimary
      case 'secondary': return theme.textSecondary
      case 'inverse': return theme.textInverse
      case 'onAccent': return theme.textOnAccent
      case 'onCard': return theme.accentText
      default: return theme.textPrimary
    }
  })()

  const weight = (() => {
    if (fontWeight) return fontWeight
    switch (variant) {
      case 'semi': return '600'
      case 'bold': return '700'
      default: return '400'
    }
  })()

  // On native mobile, disable italics to avoid fonts without italic faces rendering poorly
  const isMobile = Platform.OS === 'ios' || Platform.OS === 'android'
  const shouldItalic = italic && !isMobile

  return (
    <Text
      {...rest}
      style={[
        {
          fontSize: resolvedFontSize,
          color: resolvedColor,
          fontFamily: fontFamily ?? theme.fontFamily,
          fontWeight: weight,
          fontStyle: shouldItalic ? 'italic' : 'normal',
          textAlign: align,
          textDecorationLine: deco,
          cursor: cursor,
          opacity: opacity,
          lineHeight: lineHeight,
        },
        style, // User style can override everything
      ]}
    >
      {children}
    </Text>
  )
}


/* ───────────────────────────────
   🏷️ Typography Variants
   All extend AppText with explicit defaults
──────────────────────────────── */

/* ───── Title ───── 
   Largest text, display titles
   Default: $title (48px), semi-bold, centered, primary color
*/
export function Title({
  fontSize = '$title',
  fontWeight = '600',
  variant = 'semi',
  align = 'center',
  lineHeight = 56,
  style,
  ...rest
}: AppTextProps) {
  const { theme } = UseTheme()
  const S = useScale()
  return (
    <AppText
      fontSize={fontSize}
      fontFamily={theme.fontFamilyTitle}
      fontWeight={fontWeight}
      variant={variant}
      align={align}
      lineHeight={lineHeight}
      style={[{ marginBottom: S.space.lg }, style]}
      {...rest}
    />
  )
}

/* ───── Heading ───── 
   Section headings, page titles
   Default: $heading1 (34px), semi-bold, left-aligned, primary color
*/
export function Heading({
  fontSize = '$heading1',
  fontWeight = '600',
  variant = 'semi',
  lineHeight = 40,
  style,
  ...rest
}: AppTextProps) {
  const { theme } = UseTheme()
  const S = useScale()
  return (
    <AppText
      fontSize={fontSize}
      fontFamily={theme.fontFamilyTitle}
      fontWeight={fontWeight}
      variant={variant}
      lineHeight={lineHeight}
      style={[{ marginBottom: S.space.md }, style]}
      {...rest}
    />
  )
}

/* ───── ObjHeading ───── 
   Object/item headings (cards, list items)
   Default: $heading2 (30px), semi-bold, left-aligned, primary color
*/
export function ObjHeading({
  fontSize = '$heading2',
  fontWeight = '600',
  variant = 'semi',
  lineHeight = 36,
  style,
  ...rest
}: AppTextProps) {
  const { theme } = UseTheme()
  const S = useScale()
  return (
    <AppText
      fontSize={fontSize}
      fontFamily={theme.fontFamilyTitle}
      fontWeight={fontWeight}
      variant={variant}
      lineHeight={lineHeight}
      style={[{ marginBottom: S.space.xs }, style]}
      {...rest}
    />
  )
}

/* ───── Body ───── 
   Default body text, most common
   Default: $body1 (18px), regular, left-aligned, primary color
*/
export function Body({
  fontSize = '$body1',
  lineHeight = 24,
  style,
  ...rest
}: AppTextProps) {
  const { theme } = UseTheme()
  return (
    <AppText
      fontSize={fontSize}
      fontFamily={theme.fontFamily}
      lineHeight={lineHeight}
      style={style}
      {...rest}
    />
  )
}

/* ───── Paragraph ───── 
   Long-form readable text
   Default: $para (16px), regular, left-aligned, primary color, optimized line-height
*/
export function Paragraph({
  fontSize = '$para',
  lineHeight = 26,
  style,
  ...rest
}: AppTextProps) {
  const { theme } = UseTheme()
  return (
    <AppText
      fontSize={fontSize}
      fontFamily={theme.fontFamilyPara}
      lineHeight={lineHeight}
      style={style}
      {...rest}
    />
  )
}

/* ───── SubTitle ───── 
   Subtitle text, secondary info under headings
   Default: $subtitle (14px), italic, left-aligned, secondary color
*/
export function SubTitle({
  fontSize = '$subtitle',
  textType = 'secondary',
  italic = true,
  opacity = 0.8,
  lineHeight = 20,
  style,
  ...rest
}: AppTextProps) {
  const { theme } = UseTheme()
  return (
    <AppText
      fontSize={fontSize}
      textType={textType}
      fontFamily={theme.fontFamily}
      italic={italic}
      opacity={opacity}
      lineHeight={lineHeight}
      style={style}
      {...rest}
    />
  )
}

/* ───── Caption ───── 
   Small text, hints, metadata
   Default: $caption (8px), regular, left-aligned, secondary color
*/
export function Caption({
  fontSize = '$caption',
  textType = 'secondary',
  opacity = 0.7,
  lineHeight = 12,
  style,
  ...rest
}: AppTextProps) {
  const { theme } = UseTheme()
  return (
    <AppText
      fontSize={fontSize}
      textType={textType}
      fontFamily={theme.fontFamilyPara}
      opacity={opacity}
      lineHeight={lineHeight}
      style={style}
      {...rest}
    />
  )
}

/* ───────────────────────────────
   🎯 Specialized Variants
   Context-specific text with preset styles
──────────────────────────────── */

/* ───── Link ───── 
   Clickable/tappable link text
   Default: $body1 (18px), underlined, accent color, pointer cursor
*/
export function Link({
  fontSize = '$body1',
  color = '$accent',
  deco = 'underline',
  cursor = 'pointer',
  lineHeight = 24,
  style,
  onPress,
  ...rest
}: AppTextProps & { onPress?: () => void }) {
  const { theme } = UseTheme()
  return (
    <AppText
      fontSize={fontSize}
      color={color}
      fontFamily={theme.fontFamily}
      deco={deco}
      cursor={cursor}
      lineHeight={lineHeight}
      style={style}
      onPress={onPress}
      {...rest}
    />
  )
}

/* ───── ButtonText ───── 
   Text inside buttons
   Default: $body1 (18px), semi-bold, centered, inherits button text color
*/
export function ButtonText({
  fontSize = '$body1',
  fontWeight = '600',
  variant = 'semi',
  align = 'center',
  lineHeight = 22,
  style,
  ...rest
}: AppTextProps) {
  const { theme } = UseTheme()
  return (
    <AppText
      fontSize={fontSize}
      fontFamily={theme.fontFamily}
      fontWeight={fontWeight}
      variant={variant}
      align={align}
      lineHeight={lineHeight}
      style={style}
      {...rest}
    />
  )
}


