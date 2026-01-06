import { $, tone, useScale, UseTheme } from '@/theme'
import React, { useMemo } from 'react'
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

  const resolvedFontSize = (() => {
    if (typeof fontSize === 'string' && fontSize.startsWith('$')) {
      const token = fontSize.slice(1) as keyof typeof S.font
      // Safe access: token is constrained to keyof typeof S.font
      const tokenValue = S.font[token as keyof typeof S.font]
      if (typeof tokenValue === 'number') {
        return tokenValue
      }
    }
    return Number(fontSize)
  })()

  // Resolve theme colors at top level
  const textPrimaryColor = $('textPrimary')
  const textSecondaryColor = $('textSecondary')
  const textInverseColor = $('textInverse')
  const textInverseThemed = $('textInverse', theme)
  const accentColor = $('accent')

  const resolvedColor = useMemo(() => {
    if (color) {
      if (typeof color === 'string' && color.startsWith('$')) {
        const token = color.slice(1) as keyof typeof theme
        // Safe access: token is constrained to keyof typeof theme
        const tokenValue = theme[token as keyof typeof theme]
        if (typeof tokenValue === 'string') {
          return tokenValue
        }
      }
      return color
    }

    switch (textType) {
      case 'primary':
        return textPrimaryColor
      case 'secondary':
        return textSecondaryColor
      case 'inverse':
        return textInverseColor
      case 'onAccent':
        return tone(textInverseThemed, 'border', undefined, undefined, theme)
      case 'onCard':
        return accentColor
      default:
        return textPrimaryColor
    }
  }, [color, textType, theme, textPrimaryColor, textSecondaryColor, textInverseColor, textInverseThemed, accentColor])

  //const resolvedFontFamily = fontFamily ?? theme.fontFamily

  let weight: TextStyle['fontWeight']
  if (fontWeight) {
    weight = fontWeight
  } else {
    switch (variant) {
      case 'semi': 
        weight = '600'
        break
      case 'bold': 
        weight = '700'
        break
      default: 
        weight = '400'
    }
  }

  // On native mobile, disable italics to avoid fonts without italic faces rendering poorly
  const isMobile = Platform.OS === 'ios' || Platform.OS === 'android'
  const shouldItalic = italic && !isMobile

  // Scale lineHeight proportionally with scale factor for consistent typography
  const scaledLineHeight = typeof lineHeight === 'number' ? lineHeight * S.scale : lineHeight

  const baseStyle: any = {
    fontSize: resolvedFontSize,
    color: resolvedColor,
    // Respect explicit fontFamily prop; fallback to theme default
    fontFamily: fontFamily ?? $('fontFamily'),
    fontWeight: weight,
    fontStyle: shouldItalic ? 'italic' : 'normal',
    textAlign: align,
    textDecorationLine: deco,
    opacity: opacity,
    lineHeight: scaledLineHeight,
  };

  // Add cursor only on web
  if (Platform.OS === 'web') {
    (baseStyle as any).cursor = cursor;
  }

  return (
    <Text
      {...rest}
      style={[baseStyle, style]}
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
  lineHeight,
  style,
  ...rest
}: AppTextProps) {
  const S = useScale()
  const resolvedLineHeight = lineHeight ?? S.lineHeight.title
  return (
    <AppText
      fontSize={fontSize}
      fontFamily={$(`fontFamilyTitle`)}
      fontWeight={fontWeight}
      variant={variant}
      align={align}
      lineHeight={resolvedLineHeight}
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
  lineHeight,
  style,
  ...rest
}: AppTextProps) {
  const S = useScale()
  const resolvedLineHeight = lineHeight ?? S.lineHeight.heading1
  return (
    <AppText
      fontSize={fontSize}
      fontFamily={$(`fontFamilyTitle`)}
      fontWeight={fontWeight}
      variant={variant}
      lineHeight={resolvedLineHeight}
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
  lineHeight,
  style,
  ...rest
}: AppTextProps) {
  const S = useScale()
  const resolvedLineHeight = lineHeight ?? S.lineHeight.heading2
  return (
    <AppText
      fontSize={fontSize}
      fontFamily={$(`fontFamilyTitle`)}
      fontWeight={fontWeight}
      variant={variant}
      lineHeight={resolvedLineHeight}
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
  lineHeight,
  style,
  ...rest
}: AppTextProps) {
  const S = useScale()
  const resolvedLineHeight = lineHeight ?? S.lineHeight.body1
  return (
    <AppText
      fontSize={fontSize}
      fontFamily={$(`fontFamily`)}
      lineHeight={resolvedLineHeight}
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
  lineHeight,
  style,
  ...rest
}: AppTextProps) {
  const S = useScale()
  const resolvedLineHeight = lineHeight ?? S.lineHeight.para
  return (
    <AppText
      fontSize={fontSize}
      fontFamily={$(`fontFamilyPara`)}
      lineHeight={resolvedLineHeight}
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
  lineHeight,
  style,
  ...rest
}: AppTextProps) {
  const S = useScale()
  const resolvedLineHeight = lineHeight ?? S.lineHeight.subtitle
  return (
    <AppText
      fontSize={fontSize}
      textType={textType}
      fontFamily={$(`fontFamily`)}
      italic={italic}
      opacity={opacity}
      lineHeight={resolvedLineHeight}
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
  lineHeight,
  style,
  ...rest
}: AppTextProps) {
  const S = useScale()
  const resolvedLineHeight = lineHeight ?? S.lineHeight.caption
  return (
    <AppText
      fontSize={fontSize}
      textType={textType}
      fontFamily={$(`fontFamilyPara`)}
      opacity={opacity}
      lineHeight={resolvedLineHeight}
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
  lineHeight,
  style,
  onPress,
  ...rest
}: AppTextProps & { onPress?: () => void }) {
  const S = useScale()
  const resolvedLineHeight = lineHeight ?? S.lineHeight.body1
  return (
    <AppText
      fontSize={fontSize}
      color={color}
      fontFamily={$(`fontFamily`)}
      deco={deco}
      cursor={cursor}
      lineHeight={resolvedLineHeight}
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
  lineHeight,
  style,
  ...rest
}: AppTextProps) {
  const S = useScale()
  const resolvedLineHeight = lineHeight ?? S.lineHeight.body1
  return (
    <AppText
      fontSize={fontSize}
      fontFamily={$(`fontFamily`)}
      fontWeight={fontWeight}
      variant={variant}
      align={align}
      lineHeight={resolvedLineHeight}
      style={style}
      {...rest}
    />
  )
}


