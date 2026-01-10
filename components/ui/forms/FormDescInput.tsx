import React from 'react'
import { View } from 'react-native'
import { Controller, Control, FieldPath, FieldValues } from 'react-hook-form'
import { DescInput, SubTitle } from '@/components/ui'
import { UseTheme, useScale, $ } from '@/theme'

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
            <SubTitle
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
            </SubTitle>
          )}
        </View>
      )}
    />
  )
}
