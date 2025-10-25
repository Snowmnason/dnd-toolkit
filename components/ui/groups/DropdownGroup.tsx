import { useScale, type Sizing } from '@/theme'
import React, { forwardRef, useImperativeHandle, useState } from 'react'
import { View } from 'react-native'
import { ObjHeading } from '../AppText'
import Dropdown from '../Dropdown'

interface DropdownOption {
  label: string
  value: string
}

interface DropdownItem {
  key: string
  heading: string
  options: DropdownOption[]
}

export interface DropdownGroupRef {
  getValues: () => Record<string, string>
}

type SpaceKey = keyof Sizing['space']

interface DropdownGroupProps {
  title?: string
  items: DropdownItem[]
  defaultValues?: Record<string, string>
  direction?: 'vertical' | 'horizontal'
  spacing?: SpaceKey
  fullWidth?: boolean
}

/**
 * 🧱 DropdownGroup (v2)
 * Each dropdown always has one selected value.
 * Returns all current values via ref.getValues().
 */
export const DropdownGroup = forwardRef<DropdownGroupRef, DropdownGroupProps>(
  (
    {
      title,
      items,
      defaultValues = {},
      direction = 'vertical',
      spacing = 'sm',
      fullWidth = false,
    },
    ref
  ) => {
    const S = useScale()
    const [values, setValues] = useState<Record<string, string>>(() => {
      const initial: Record<string, string> = {}
      items.forEach((item) => {
        initial[item.key] =
          defaultValues[item.key] ?? item.options[0]?.value ?? ''
      })
      return initial
    })

    const handleSelect = (key: string, newValue: string) => {
      setValues((prev) => ({ ...prev, [key]: newValue }))
    }

    // Expose ref method
    useImperativeHandle(ref, () => ({
      getValues: () => values,
    }))

    return (
      <View
        style={{
          flexDirection: direction === 'horizontal' ? 'row' : 'column',
          gap: S.space[spacing],
          width: fullWidth ? '100%' : undefined,
        }}
      >
        {title && (
          <ObjHeading
            style={{
              marginBottom: S.space.xs,
              marginLeft: S.space.xs,
              opacity: 0.9,
            }}
          >
            {title}
          </ObjHeading>
        )}

        {items.map((item) => (
          <Dropdown
            key={item.key}
            heading={item.heading}
            items={item.options}
            value={values[item.key] || null}
            onChange={(val) => handleSelect(item.key, val ?? '')}
          />
        ))}
      </View>
    )
  }
)

DropdownGroup.displayName = 'DropdownGroup'
