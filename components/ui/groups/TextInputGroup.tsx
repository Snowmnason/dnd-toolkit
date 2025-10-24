import { TextInput } from '@/components/ui'
import { S } from '@/theme'
import React, { useEffect, useState } from 'react'
import { View } from 'react-native'

interface TextInputItem {
  key: string
  label: string
  placeholder?: string
  defaultValue?: string
  multiline?: boolean
}

interface TextInputGroupProps {
  items: TextInputItem[]
  onChange?: (values: Record<string, string>) => void
  direction?: 'vertical' | 'horizontal'
  spacing?: keyof typeof S.space
  fullWidth?: boolean
}

/**
 * ✍️ TextInputGroup
 * Inclusive input group — every field always exists and is tracked internally.
 * Perfect for character creation, profile editing, or world info forms.
 */
export function TextInputGroup({
  items,
  onChange,
  direction = 'vertical',
  spacing = 'md',
  fullWidth = false,
}: TextInputGroupProps) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    items.forEach((item) => {
      initial[item.key] = item.defaultValue ?? ''
    })
    return initial
  })

  useEffect(() => {
    onChange?.(values)
  }, [values, onChange])

  const handleChange = (key: string, text: string) => {
    setValues((prev) => ({ ...prev, [key]: text }))
  }

  return (
    <View
      style={{
        flexDirection: direction === 'horizontal' ? 'row' : 'column',
        gap: S.space[spacing],
        width: fullWidth ? '100%' : undefined,
      }}
    >
      {items.map((item) => (
        <View key={item.key} style={{ flex: fullWidth ? 1 : undefined }}>
          <TextInput
            label={item.label}
            value={values[item.key]}
            onChangeText={(text) => handleChange(item.key, text)}
            placeholder={item.placeholder}
            multiline={item.multiline}
          />
        </View>
      ))}
    </View>
  )
}
