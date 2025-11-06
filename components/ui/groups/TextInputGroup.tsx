import { $, useScale, UseTheme, type Sizing } from '@/theme'
import React, { forwardRef, useImperativeHandle, useState } from 'react'
import { View } from 'react-native'
import { ObjHeading } from '../AppText'
import { TextInput } from '../TextInputs'

interface TextInputItem {
  key: string
  heading: string // 👈 individual input heading
  placeholder?: string
  defaultValue?: string
  multiline?: boolean
}

export interface TextInputGroupRef {
  getValues: () => Record<string, string>
}

type SpaceKey = keyof Sizing['space']

interface TextInputGroupProps {
  title?: string // 👈 group title
  items: TextInputItem[]
  direction?: 'vertical' | 'horizontal'
  spacing?: SpaceKey
  fullWidth?: boolean
  outlined?: boolean // 👈 optional border style
}

/**
 * ✍️ TextInputGroup (ref-based)
 * Group of text inputs with internal state, accessible via ref.getValues().
 * Consistent with DropdownGroup styling + props.
 */
export const TextInputGroup = forwardRef<TextInputGroupRef, TextInputGroupProps>(
  (
    {
      title,
      items,
      direction = 'vertical',
      spacing = 'md',
      fullWidth = false,
      outlined = false,
    },
    ref
  ) => {
    const S = useScale()
    const { theme } = UseTheme()
    const [values, setValues] = useState<Record<string, string>>(() => {
      const initial: Record<string, string> = {}
      items.forEach((item) => {
        initial[item.key] = item.defaultValue ?? ''
      })
      return initial
    })

    const handleChange = (key: string, text: string) => {
      setValues((prev) => ({ ...prev, [key]: text }))
    }

    // expose .getValues() for parent access
    useImperativeHandle(ref, () => ({
      getValues: () => values,
    }))

    return (
      <View
        style={{
          borderWidth: outlined ? 1.5 : 0,
          borderColor: outlined ? $('border') : 'transparent',
          borderRadius: outlined ? S.radius.md : 0,
          backgroundColor: outlined ? 'transparent' : undefined,
          padding: outlined ? S.space.sm : 0,
          width: fullWidth ? '100%' : undefined,
        }}
      >
        {/* Group Title */}
        {title && (
          <ObjHeading
            style={{
              position: outlined ? 'absolute' : 'relative',
              top: outlined ? -S.space.md : 0,
              left: outlined ? S.space.sm : 0,
              paddingHorizontal: outlined ? S.space.xs : 0,
              backgroundColor: outlined ? $('background', theme) : 'transparent',
              marginBottom: outlined ? S.space.xs : S.space.sm,
            }}
          >
            {title}
          </ObjHeading>
        )}

        {/* Text Inputs */}
        <View
          style={{
            flexDirection: direction === 'horizontal' ? 'row' : 'column',
            gap: S.space[spacing],
          }}
        >
          {items.map((item) => (
            <TextInput
              key={item.key}
              heading={item.heading} // 👈 changed from label → heading
              value={values[item.key]}
              onChangeText={(text) => handleChange(item.key, text)}
              placeholder={item.placeholder}
              multiline={item.multiline}
            />
          ))}
        </View>
      </View>
    )
  }
)

TextInputGroup.displayName = 'TextInputGroup'
