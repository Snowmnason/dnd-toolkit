import { Switch } from '@/components/ui/Switch'
import { S } from '@/theme'
import React, { useEffect, useRef, useState } from 'react'
import { View } from 'react-native'

interface SwitchItem {
  key: string
  label: string
}

interface SwitchGroupProps {
  items: SwitchItem[]
  defaultActive?: string[]                // preselected keys
  exclusive?: boolean                     // only one active at a time
  maxActive?: number                      // limit of active switches
  direction?: 'vertical' | 'horizontal'   // layout direction
  disabledKeys?: string[]                 // disables specific switches
  onChange?: (activeKeys: string[]) => void
}

/**
 * 🧱 SwitchGroup (v3)
 * Self-contained stateful switch group with exclusive + maxActive logic.
 * Tracks active keys internally and returns them via onChange().
 */
export function SwitchGroup({
  items,
  defaultActive = [],
  exclusive = false,
  maxActive,
  direction = 'vertical',
  disabledKeys = [],
  onChange,
}: SwitchGroupProps) {
  const [activeKeys, setActiveKeys] = useState<string[]>(defaultActive)
  const activeOrder = useRef<string[]>(defaultActive)

  // Keep parent in sync when state changes
  useEffect(() => {
    onChange?.(activeKeys)
  }, [activeKeys, onChange])

  const handleToggle = (key: string, newValue: boolean) => {
    setActiveKeys((prev) => {
      let next = [...prev]

      if (exclusive) {
        // Radio-like behavior: only one can be active
        next = newValue ? [key] : []
      } else if (maxActive && newValue) {
        // Enforce limit on active switches
        const stillActive = next.filter((k) => k !== key)
        activeOrder.current = activeOrder.current.filter((k) => stillActive.includes(k))
        activeOrder.current.push(key)

        if (stillActive.length >= maxActive) {
          const oldest = activeOrder.current.shift()
          next = stillActive.filter((k) => k !== oldest)
        } else {
          next = [...stillActive, key]
        }
      } else {
        // Regular multi-toggle
        if (newValue) next.push(key)
        else next = next.filter((k) => k !== key)
      }

      activeOrder.current = next
      return next
    })
  }

  return (
    <View
      style={{
        flexDirection: direction === 'horizontal' ? 'row' : 'column',
        gap: S.space.sm,
      }}
    >
      {items.map((item) => (
        <Switch
          key={item.key}
          label={item.label}
          checked={activeKeys.includes(item.key)}
          onChange={(val) => handleToggle(item.key, val)}
          disabled={disabledKeys.includes(item.key)}
        />
      ))}
    </View>
  )
}
