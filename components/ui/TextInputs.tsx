import { $, S, tone, UseTheme } from '@/theme'
import React, { useState } from 'react'
import { TextInput as RNTextInput, StyleSheet, TextInputProps, View } from 'react-native'
import { ObjHeading } from './AppText'

interface BaseInputProps extends TextInputProps {
  label?: string                     // 👈 Optional ObjHeader
  error?: boolean
  filled?: boolean
}

/**
 * ✏️ TextInput — for short, single-line text fields
 */
export function TextInput({ label, error, filled, style, ...rest }: BaseInputProps) {
  const { theme } = UseTheme()
  const [focused, setFocused] = useState(false)

  const borderColor = error
    ? tone($('accent'), 'border')
    : focused
    ? tone($('accent'), 'accent')
    : tone($('border'), 'subtle')

  return (
    <View style={{ width: '100%' }}>
      {label && (
        <ObjHeading style={{ marginBottom: S.space.xs }}>
          {label}
        </ObjHeading>
      )}

      <View
        style={[
          styles.base,
          {
            backgroundColor: filled ? tone($('surface'), 'alt') : $('surface'),
            borderColor,
          },
        ]}
      >
        <RNTextInput
          placeholderTextColor={tone($('textPrimary'), 'disabled')}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            styles.input,
            {
              color: $('textPrimary'),
              fontFamily: theme.fontFamily,
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
export function DescInput({ label, error, filled, style, ...rest }: BaseInputProps) {
  const { theme } = UseTheme()
  const [focused, setFocused] = useState(false)

  const borderColor = error
    ? tone($('accent'), 'border')
    : focused
    ? tone($('accent'), 'accent')
    : tone($('border'), 'subtle')

  return (
    <View style={{ width: '100%' }}>
      {label && (
        <ObjHeading style={{ marginBottom: S.space.xs }}>
          {label}
        </ObjHeading>
      )}

      <View
        style={[
          styles.base,
          styles.textarea,
          {
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
              fontFamily: theme.fontFamilyPara, // 👈 uses paragraph font
              height: 120,
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
    borderRadius: S.radius.md,
    paddingHorizontal: S.space.md,
    paddingVertical: S.space.sm,
  },
  input: {
    fontSize: S.font.md,
  },
  textarea: {
    paddingVertical: S.space.md,
  },
})
