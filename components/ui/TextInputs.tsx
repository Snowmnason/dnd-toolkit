import { $, tone, useScale, UseTheme } from '@/theme'
import { useMemo, useState } from 'react'
import { Platform, TextInput as RNTextInput, StyleSheet, TextInputProps, View } from 'react-native'
import { ObjHeading, TextType } from './AppText'

interface BaseInputProps extends TextInputProps {
  heading?: string                   // 👈 Renamed from label
  error?: boolean
  filled?: boolean
  underline?: boolean,
  textTypeHeading?: TextType
  onTabPress?: () => void            // Called when Tab key is pressed
  onEnterPress?: () => void          // Called when Enter key is pressed (single-line)
  enableTabNavigation?: boolean      // Default: false. If true, Tab/Enter moves to next field
  keyboardOffset?: number            // Extra offset for keyboard on mobile (default: 0)
}

/**
 * ✏️ TextInput — for short, single-line text fields
 */
export function TextInput({ 
  heading, 
  error, 
  filled, 
  underline, 
  textTypeHeading='primary',
  onTabPress,
  onEnterPress,
  enableTabNavigation = false,
  keyboardOffset = 0,
  style, 
  ...rest 
}: BaseInputProps) {
  const { theme } = UseTheme()
  const S = useScale()
  const [focused, setFocused] = useState(false)

  const borderColor = useMemo(() =>
    error
      ? tone($('accent', theme), 'border', undefined, undefined, theme)
      : focused
      ? tone($('accent', theme), 'accent', undefined, undefined, theme)
      : tone($('borderSubtle' as any, theme), 'base', undefined, undefined, theme),
  [error, focused, theme])

  const backgroundColor = useMemo(() =>
    filled 
      ? tone($('bgInverse', theme), 'alt', undefined, undefined, theme)
      : $('bgInverse'),
  [filled, theme])

  const disabledTextColor = useMemo(() =>
    tone($('textInverse', theme), 'disabled', undefined, undefined, theme),
  [theme])

  const handleKeyPress = (e: any) => {
    // Handle Tab key
    if (e.nativeEvent.key === 'Tab' || (Platform.OS === 'web' && e.key === 'Tab')) {
      if (enableTabNavigation) {
        e.preventDefault()
        onTabPress?.()
      }
    }
    // Handle Enter key
    if (e.nativeEvent?.key === 'Enter' || (Platform.OS === 'web' && e.key === 'Enter')) {
      if (enableTabNavigation) {
        e.preventDefault()
        onEnterPress?.()
      } else {
        onEnterPress?.()
      }
    }
  }

  return (
    <View style={{ width: '100%' }}>
      {heading && (
        <ObjHeading textType={textTypeHeading} style={{ marginBottom: S.space.xs }}>
          {heading}
        </ObjHeading>
      )}

      <View
        style={[
          styles.base,
          {
            borderRadius: S.radius.md,
            paddingHorizontal: S.space.md,
            paddingVertical: S.space.sm,
            backgroundColor,
            borderColor,
          },
        ]}
      >
        <RNTextInput
          placeholderTextColor={disabledTextColor}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyPress={handleKeyPress}
          underlineColorAndroid="transparent"
          style={[
            styles.input,
            {
              color: $('textInverse', theme),
              fontFamily: theme.fontFamily,
              fontSize: S.font.body1,
              borderColor: 'transparent',
              borderWidth: 0,
              // Remove default web focus ring/outline
              ...(Platform.OS === 'web' ? {
                outlineStyle: 'none',
                outlineWidth: 0,
                outlineColor: 'transparent',
              } as any : {}),
            },
            style,
          ]}
          {...rest}
        />
      </View>
    </View>
  )
}

/**
 * 📝 DescInput — for longer, multi-line text areas (descriptions, notes)
 */
export function DescInput({ 
  heading, 
  error, 
  filled, 
  style, 
  textTypeHeading='primary', 
  maxHeightDelta = 0, 
  minLines = 3, 
  accentScrollbar = true,
  onTabPress,
  onEnterPress,
  enableTabNavigation = false,
  keyboardOffset = 0,
  ...rest 
}: BaseInputProps & { maxHeightDelta?: number; minLines?: number; accentScrollbar?: boolean }) {
  const { theme } = UseTheme()
  const S = useScale()
  const [focused, setFocused] = useState(false)

  const borderColor = useMemo(() =>
    error
      ? tone($('accent', theme), 'border', undefined, undefined, theme)
      : focused
      ? tone($('accent', theme), 'accent', undefined, undefined, theme)
      : tone($('borderSubtle' as any, theme), 'base', undefined, undefined, theme),
  [error, focused, theme])

  const backgroundColor = useMemo(() =>
    filled ? tone($('bgInverse', theme), 'alt', undefined, undefined, theme) : $('bgInverse'),
  [filled, theme])

  const disabledTextColor = useMemo(() =>
    tone($('textInverse', theme), 'disabled', undefined, undefined, theme),
  [theme])

  const textColor = useMemo(() => $('textInverse'), [])

  const handleKeyPress = (e: any) => {
    // Handle Tab key
    if (e.nativeEvent.key === 'Tab' || (Platform.OS === 'web' && e.key === 'Tab')) {
      if (enableTabNavigation) {
        e.preventDefault()
        onTabPress?.()
      }
    }
  }

  return (
    <View style={{ width: '100%' }}>
      {heading && (
        <ObjHeading textType={textTypeHeading} style={{ marginBottom: S.space.xs }}>
          {heading}
        </ObjHeading>
      )}

      <View
        style={[
          styles.base,
          {
            borderRadius: S.radius.md,
            paddingHorizontal: S.space.md,
            paddingVertical: S.space.md,
            backgroundColor,
            borderColor,
          },
        ]}
      >
        <RNTextInput
          multiline
          textAlignVertical="top"
          placeholderTextColor={disabledTextColor}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyPress={handleKeyPress}
          underlineColorAndroid="transparent"
          style={[
            styles.input,
            {
              color: textColor,
              fontFamily: theme.fontFamilyPara, // paragraph font
              fontSize: S.font.para,
              lineHeight: Math.round(S.font.para * 1.4),
              // Size constraints
              minHeight: Math.round(S.font.para * 1.4) * Math.max(1, minLines),
              maxHeight: 240 + maxHeightDelta,
              // Remove inner borders/outline
              borderColor: 'transparent',
              borderWidth: 0,
              ...(Platform.OS === 'web'
                ? ({
                    outlineStyle: 'none',
                    outlineWidth: 0,
                    outlineColor: 'transparent',
                    // Best-effort custom scrollbar on web
                    ...(accentScrollbar
                      ? ({
                          scrollbarWidth: 'thin',
                          scrollbarColor: `${$('accent', theme)} transparent`,
                        } as any)
                      : {}),
                  } as any)
                : {}),
            },
            style,
          ]}
          {...rest}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
  },
  input: {},
})
