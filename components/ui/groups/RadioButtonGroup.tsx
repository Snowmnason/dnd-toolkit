import { ObjHeading } from '@/components/ui/AppText'
import { RadioButton } from '@/components/ui/RadioButton'
import { $, useScale, type Sizing } from '@/theme'
import React, { forwardRef, useImperativeHandle, useState } from 'react'
import { View } from 'react-native'

interface RadioButtonItem {
  key: string
  label: string
  color?: string
}

export interface RadioButtonGroupRef {
  getValue: () => string | null
}

type SpaceKey = keyof Sizing['space']

interface RadioButtonGroupProps {
  title?: string
  items: RadioButtonItem[]
  defaultSelected?: string
  direction?: 'horizontal' | 'vertical'
  spacing?: SpaceKey
  fullWidth?: boolean
  outlined?: boolean
}

/**
 * 🔘 RadioButtonGroup (v1)
 * Exclusive selection group for radio buttons.
 * Supports outline frame, title, and ref-based manual access.
 */
export const RadioButtonGroup = forwardRef<RadioButtonGroupRef, RadioButtonGroupProps>(
  (
    {
      title,
      items,
      defaultSelected,
      direction = 'vertical',
      spacing = 'sm',
      fullWidth = false,
      outlined = false,
    },
    ref
  ) => {
    const S = useScale()
    const [selected, setSelected] = useState<string | null>(
      defaultSelected ?? items[0]?.key ?? null
    )

    useImperativeHandle(ref, () => ({
      getValue: () => selected,
    }))

    return (
      <View
        style={{
          borderWidth: outlined ? 1.5 : 0,
          borderColor: outlined ? $('border') : 'transparent',
          borderRadius: outlined ? S.radius.md : 0,
          padding: outlined ? S.space.sm : 0,
          width: '100%',
        }}
      >
        {/* Title */}
        {title && (
          <ObjHeading
            style={{
              position: outlined ? 'absolute' : 'relative',
              top: outlined ? -S.space.md : 0,
              left: outlined ? S.space.sm : 0,
              paddingHorizontal: outlined ? S.space.xs : 0,
              backgroundColor: outlined ? $('background') : 'transparent',
              marginBottom: outlined ? S.space.xs : S.space.sm,
            }}
          >
            {title}
          </ObjHeading>
        )}

        {/* Radio List */}
        <View
          style={{
            flexDirection: direction === 'horizontal' ? 'row' : 'column',
            gap: S.space[spacing],
            width: fullWidth ? '100%' : undefined,
          }}
        >
          {items.map((item) => (
            <RadioButton
              key={item.key}
              label={item.label}
              color={item.color}
              checked={selected === item.key}
              onChange={() => setSelected(item.key)}
            />
          ))}
        </View>
      </View>
    )
  }
)

RadioButtonGroup.displayName = 'RadioButtonGroup'
