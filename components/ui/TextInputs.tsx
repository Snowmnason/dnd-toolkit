import { $, tone, useScale, UseTheme } from '@/theme'
import React, { useState } from 'react'
import { Platform, TextInput as RNTextInput, StyleSheet, TextInputProps, View } from 'react-native'
import { ObjHeading, TextType } from './AppText'

interface BaseInputProps extends TextInputProps {
  heading?: string                   // 👈 Renamed from label
  error?: boolean
  filled?: boolean
  underline?: boolean,
  textTypeHeading?: TextType
}

/**
 * ✏️ TextInput — for short, single-line text fields
 */
export function TextInput({ heading, error, filled, underline, textTypeHeading='primary', style, ...rest }: BaseInputProps) {
  const { theme } = UseTheme()
  const S = useScale()
  const [focused, setFocused] = useState(false)

  const borderColor = error
    ? tone($('accent', theme), 'border', undefined, undefined, theme)
    : focused
    ? tone($('accent', theme), 'accent', undefined, undefined, theme)
    : $('borderSubtle' as any, theme)

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
            backgroundColor: filled ? tone($('bgInverse', theme), 'alt', undefined, undefined, theme) : $('bgInverse', theme),
            borderColor,
          },
        ]}
      >
        <RNTextInput
          placeholderTextColor={tone($('textInverse', theme), 'disabled', undefined, undefined, theme)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
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
export function DescInput({ heading, error, filled, style, textTypeHeading='primary', maxHeightDelta = 0, minLines = 3, accentScrollbar = true, ...rest }: BaseInputProps & { maxHeightDelta?: number; minLines?: number; accentScrollbar?: boolean }) {
  const { theme } = UseTheme()
  const S = useScale()
  const [focused, setFocused] = useState(false)

  const borderColor = error
    ? tone($('accent', theme), 'border', undefined, undefined, theme)
    : focused
    ? tone($('accent', theme), 'accent', undefined, undefined, theme)
    : $('borderSubtle' as any, theme)

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
            backgroundColor: filled ? tone($('bgInverse', theme), 'alt', undefined, undefined, theme) : $('bgInverse', theme),
            borderColor,
          },
        ]}
      >
        <RNTextInput
          multiline
          textAlignVertical="top"
          placeholderTextColor={tone($('textInverse', theme), 'disabled', undefined, undefined, theme)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          underlineColorAndroid="transparent"
          style={[
            styles.input,
            {
              color: $('textPrimary', theme),
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
