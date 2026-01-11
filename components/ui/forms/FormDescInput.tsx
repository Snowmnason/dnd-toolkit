import { $, UseTheme, useScale } from '@/theme'
import React from 'react'
import { Control, Controller, FieldPath, FieldValues } from 'react-hook-form'
import { View } from 'react-native'
import { Caption } from '../AppText'
import { DescInput } from '../TextInputs'

/**
 * RHF wrapper for DescInput
 */
export type FormDescInputProps<T extends FieldValues> = {
  control: Control<T>
  name: FieldPath<T>
} & Omit<React.ComponentProps<typeof DescInput>, 'value' | 'onChangeText' | 'error'>

export function FormDescInput<T extends FieldValues>({ control, name, ...props }: FormDescInputProps<T>) {
  const { theme } = UseTheme()
  const S = useScale()
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <View>
          <DescInput
            {...props}
            value={(field.value as string) ?? ''}
            onChangeText={field.onChange}
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
                marginBottom: -S.space.sm,
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
