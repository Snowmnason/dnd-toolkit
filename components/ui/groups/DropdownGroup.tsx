import { Dropdown } from '@/components/ui'
import { S } from '@/theme'
import React, { useEffect, useState } from 'react'
import { View } from 'react-native'

interface DropdownOption {
  label: string
  value: string
}

interface DropdownItem {
  key: string
  label: string
  options: DropdownOption[]
}

interface DropdownGroupProps {
  items: DropdownItem[]
  defaultValues?: Record<string, string>        // key → default value
  onChange?: (values: Record<string, string>) => void
  direction?: 'vertical' | 'horizontal'
  spacing?: keyof typeof S.space
  fullWidth?: boolean
}

/**
 * 🧱 DropdownGroup
 * Inclusive group of dropdowns — each always has one value selected.
 * Returns an object mapping keys to selected values.
 */
export function DropdownGroup({
  items,
  defaultValues = {},
  onChange,
  direction = 'vertical',
  spacing = 'sm',
  fullWidth = false,
}: DropdownGroupProps) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    items.forEach((item) => {
      initial[item.key] =
        defaultValues[item.key] ?? item.options[0]?.value ?? ''
    })
    return initial
  })

  // Keep parent synced
  useEffect(() => {
    onChange?.(values)
  }, [values, onChange])

  const handleSelect = (key: string, newValue: string) => {
    setValues((prev) => ({ ...prev, [key]: newValue }))
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
        <Dropdown
          key={item.key}
          heading={item.label}
          items={item.options}
          value={values[item.key] || null}
          onChange={(val) => handleSelect(item.key, val ?? '')}
        />
      ))}
    </View>
  )
}
