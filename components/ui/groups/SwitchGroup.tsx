import { ObjHeading } from '@/components/ui/AppText'
import { Switch } from '@/components/ui/Switch'
import { $, useScale } from '@/theme'
import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { View } from 'react-native'

interface SwitchItem {
  key: string
  heading?: string           // title above each individual switch
  leftLabel?: string         // optional label on the left side
  rightLabel?: string        // optional label on the right side
}

export interface SwitchGroupRef {
  getValues: () => string[]
}

interface SwitchGroupProps {
  title?: string             // group title
  items: SwitchItem[]
  defaultActive?: string[]   // initially active switches
  exclusive?: boolean        // radio-like mode
  maxActive?: number         // limit number of active
  direction?: 'vertical' | 'horizontal'
  disabledKeys?: string[]
  outlined?: boolean         // optional border
}

/**
 * 🧱 SwitchGroup (v4)
 * Self-contained, ref-based switch group with support for per-switch headings
 * and left/right labels.
 */
export const SwitchGroup = forwardRef<SwitchGroupRef, SwitchGroupProps>(
  (
    {
      title,
      items,
      defaultActive = [],
      exclusive = false,
      maxActive,
      direction = 'vertical',
      disabledKeys = [],
      outlined = false,
    },
    ref
  ) => {
    const S = useScale()
    const [activeKeys, setActiveKeys] = useState<string[]>(defaultActive)
    const activeOrder = useRef<string[]>(defaultActive)

    const handleToggle = (key: string, newValue: boolean) => {
      setActiveKeys((prev) => {
        let next = [...prev]

        if (exclusive) {
          next = newValue ? [key] : []
        } else if (maxActive && newValue) {
          const stillActive = next.filter((k) => k !== key)
          activeOrder.current = activeOrder.current.filter((k) =>
            stillActive.includes(k)
          )
          activeOrder.current.push(key)

          if (stillActive.length >= maxActive) {
            const oldest = activeOrder.current.shift()
            next = stillActive.filter((k) => k !== oldest)
          } else {
            next = [...stillActive, key]
          }
        } else {
          if (newValue) next.push(key)
          else next = next.filter((k) => k !== key)
        }

        activeOrder.current = next
        return next
      })
    }

    // expose values via ref
    useImperativeHandle(ref, () => ({
      getValues: () => activeKeys,
    }))

    return (
      <View
        style={{
          borderWidth: outlined ? 1.5 : 0,
          borderColor: outlined ? $('border') : 'transparent',
          borderRadius: outlined ? S.radius.md : 0,
          backgroundColor: outlined ? 'transparent' : undefined,
          padding: outlined ? S.space.sm : 0,
          width: '100%',
        }}
      >
        {/* Group Title */}
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

        {/* Switches */}
        <View
          style={{
            flexDirection: direction === 'horizontal' ? 'row' : 'column',
            gap: S.space.sm,
          }}
        >
          {items.map((item) => (
            <Switch
              key={item.key}
              heading={item.heading}
              leftLabel={item.leftLabel}
              rightLabel={item.rightLabel}
              checked={activeKeys.includes(item.key)}
              onChange={(val) => handleToggle(item.key, val)}
              disabled={disabledKeys.includes(item.key)}
            />
          ))}
        </View>
      </View>
    )
  }
)

SwitchGroup.displayName = 'SwitchGroup'
