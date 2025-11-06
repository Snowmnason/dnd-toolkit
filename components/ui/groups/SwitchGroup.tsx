import { ObjHeading } from '@/components/ui/AppText'
import { Switch } from '@/components/ui/Switch'
import { $, useScale, UseTheme } from '@/theme'
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
    const { theme } = UseTheme()
    const [activeKeys, setActiveKeys] = useState<string[]>(defaultActive)
    const activeOrder = useRef<string[]>(defaultActive)

    const handleToggle = (key: string, newValue: boolean) => {
      setActiveKeys((prev) => {
        let next = [...prev]

        if (exclusive) {
          // In exclusive mode, only one can be active at a time
          // If turning on, set to this key only
          // If turning off the active one, allow deactivation
          next = newValue ? [key] : []
        } else if (maxActive !== undefined) {
          // Max active mode - limit number of active switches
          if (newValue) {
            // Trying to turn ON a switch
            if (!prev.includes(key)) {
              // Not currently active, so we're adding it
              if (prev.length >= maxActive) {
                // Already at max, remove the oldest one
                const rest = activeOrder.current.slice(1)
                next = [...rest, key]
                activeOrder.current = [...rest, key]
              } else {
                // Not at max yet, just add it
                next = [...prev, key]
                activeOrder.current = [...activeOrder.current, key]
              }
            }
          } else {
            // Turning OFF a switch
            next = prev.filter((k) => k !== key)
            activeOrder.current = activeOrder.current.filter((k) => k !== key)
          }
        } else {
          // Normal mode - no restrictions
          if (newValue) {
            if (!prev.includes(key)) {
              next.push(key)
            }
          } else {
            next = next.filter((k) => k !== key)
          }
        }

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
              backgroundColor: outlined ? $('background', theme) : 'transparent',
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
