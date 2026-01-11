import { $, UseTheme, useScale } from '@/theme'
import React from 'react'
import { Control, Controller, FieldPath, FieldValues } from 'react-hook-form'
import { View } from 'react-native'
import { Caption } from '../AppText'
import { TextInput } from '../TextInputs'

/**
 * RHF wrapper for TextInput
 * Keeps base UI clean while making form usage concise
 */
export type FormTextInputProps<T extends FieldValues> = {
  control: Control<T>
  name: FieldPath<T>
  onChangeText?: (text: string) => void // optional external sync
} & Omit<React.ComponentProps<typeof TextInput>, 'value' | 'onChangeText' | 'error'>

export function FormTextInput<T extends FieldValues>({ control, name, ...props }: FormTextInputProps<T>) {
  const { theme } = UseTheme()
  const S = useScale()
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <View>
          <TextInput
            {...props}
            value={(field.value as string) ?? ''}
            onChangeText={(val) => {
              field.onChange(val) // Update RHF state first
              if (props.onChangeText) props.onChangeText(val) // Then call external handler
            }}
            error={!!fieldState.error}
          />
          {/* Show error with negative margin to pull content up */}
          {fieldState.error && (
            <Caption
              fontSize="$caption"
              italic={false}
              textType="primary"
              style={{
                color: $('danger', theme),
                marginTop: S.space.xs * 0.5,
                marginBottom: -S.space.md,
                overflow: 'hidden',
              }}
            >
              {fieldState.error?.message}
            </Caption>
          )}
        </View>
      )}
    />
  )
}
