import React from 'react'
import { View } from 'react-native'
import { Controller, Control, FieldPath, FieldValues } from 'react-hook-form'
import AuthInput from '../AuthInput'
import { SubTitle } from '@/components/ui'
import { useScale } from '@/theme'

/**
 * RHF wrapper for AuthInput
 */
export type FormAuthInputProps<T extends FieldValues> = {
  control: Control<T>
  name: FieldPath<T>
  inputRef?: React.RefObject<any>
  onChangeText?: (text: string) => void // optional external sync
} & Omit<React.ComponentProps<typeof AuthInput>, 'value' | 'onChangeText'>

export function FormAuthInput<T extends FieldValues>({ control, name, inputRef, ...props }: FormAuthInputProps<T>) {
  const S = useScale()
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <View>
          <AuthInput
            ref={inputRef}
            {...props}
            value={(field.value as string) ?? ''}
            onChangeText={(val) => {
              if (props.onChangeText) props.onChangeText(val)
              field.onChange(val)
            }}
            style={{
              ...(props.style as any),
              borderColor: fieldState.error ? '#dc3545' : (props.style as any)?.borderColor,
              borderWidth: fieldState.error ? 3 : (props.style as any)?.borderWidth,
            }}
          />
          {/* Show error with negative margin to pull content up */}
          {fieldState.error && (
            <SubTitle
              fontSize="$caption"
              italic={false}
              textType="primary"
              style={{
                color: '#dc3545',
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
