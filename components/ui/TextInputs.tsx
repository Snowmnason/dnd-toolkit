import { $, tone, useScale, UseTheme } from '@/theme'
import React, { useState } from 'react'
import { TextInput as RNTextInput, StyleSheet, TextInputProps, View } from 'react-native'
import { ObjHeading } from './AppText'

interface BaseInputProps extends TextInputProps {
  heading?: string                   // 👈 Renamed from label
  error?: boolean
  filled?: boolean
}

/**
 * ✏️ TextInput — for short, single-line text fields
 */
export function TextInput({ heading, error, filled, style, ...rest }: BaseInputProps) {
  const { theme } = UseTheme()
  const S = useScale()
  const [focused, setFocused] = useState(false)

  const borderColor = error
    ? tone($('accent', theme), 'border', undefined, undefined, theme)
    : focused
    ? tone($('accent', theme), 'accent', undefined, undefined, theme)
    : tone($('border', theme), 'subtle', undefined, undefined, theme)

  return (
    <View style={{ width: '100%' }}>
      {heading && (
        <ObjHeading style={{ marginBottom: S.space.xs }}>
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
            backgroundColor: filled ? tone($('surface', theme), 'alt', undefined, undefined, theme) : $('surface', theme),
            borderColor,
          },
        ]}
      >
        <RNTextInput
          placeholderTextColor={tone($('textPrimary', theme), 'disabled', undefined, undefined, theme)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            styles.input,
            {
              color: $('textPrimary', theme),
              fontFamily: theme.fontFamily,
              fontSize: S.font.body1,
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
export function DescInput({ heading, error, filled, style, ...rest }: BaseInputProps) {
  const { theme } = UseTheme()
  const S = useScale()
  const [focused, setFocused] = useState(false)

  const borderColor = error
    ? tone($('accent'), 'border')
    : focused
    ? tone($('accent'), 'accent')
    : tone($('border'), 'subtle')

  return (
    <View style={{ width: '100%' }}>
      {heading && (
        <ObjHeading style={{ marginBottom: S.space.xs }}>
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
            backgroundColor: filled ? tone($('surface'), 'alt') : $('surface'),
            borderColor,
          },
        ]}
      >
        <RNTextInput
          multiline
          textAlignVertical="top"
          placeholderTextColor={tone($('textPrimary'), 'disabled')}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            styles.input,
            {
              color: $('textPrimary'),
              fontFamily: theme.fontFamilyPara, // paragraph font
              height: 120,
              fontSize: S.font.para,
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
