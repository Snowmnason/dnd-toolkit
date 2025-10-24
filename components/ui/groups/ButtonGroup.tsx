import { Button } from '@/components/ui'
import { S } from '@/theme'
import React, { useEffect, useState } from 'react'
import { StyleProp, View, ViewStyle } from 'react-native'

interface ButtonGroupItem {
  key: string
  label: string
  variant?: 'primary' | 'secondary' | 'destructive' | 'auth'
}

interface ButtonGroupProps {
  items: ButtonGroupItem[]
  defaultSelected?: string
  onChange?: (selectedKey: string) => void
  direction?: 'horizontal' | 'vertical'
  spacing?: keyof typeof S.space
  fullWidth?: boolean
  style?: StyleProp<ViewStyle>
}

/**
 * 🎛️ ButtonGroup
 * Exclusive selection group for theme or layout controls.
 * Handles its own state but can report back via onChange().
 */
export function ButtonGroup({
  items,
  defaultSelected,
  onChange,
  direction = 'horizontal',
  spacing = 'sm',
  fullWidth = false,
  style,
}: ButtonGroupProps) {
  const [selected, setSelected] = useState(defaultSelected ?? items[0]?.key)

  useEffect(() => {
    if (onChange) onChange(selected)
  }, [selected, onChange])

  const flexDirection: ViewStyle['flexDirection'] =
    direction === 'horizontal' ? 'row' : 'column'

  return (
    <View
      style={[
        {
          flexDirection,
          gap: S.space[spacing],
          width: fullWidth ? '100%' : undefined,
        },
        style,
      ]}
    >
      {items.map((item) => {
        const isActive = selected === item.key

        return (
          <Button
            key={item.key}
            text={item.label}
            variant={isActive ? item.variant ?? 'primary' : 'secondary'}
            onPress={() => setSelected(item.key)}
            style={{
              flex: fullWidth ? 1 : undefined,
              opacity: isActive ? 1 : 0.85,
            }}
          />
        )
      })}
    </View>
  )
}
