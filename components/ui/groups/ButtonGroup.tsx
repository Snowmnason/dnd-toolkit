import { $, useScale, UseTheme, type Sizing } from '@/theme'
import React, { forwardRef, useImperativeHandle, useState } from 'react'
import { StyleProp, View, ViewStyle } from 'react-native'
import { ObjHeading } from '../AppText'
import { Button } from '../BaseButton'

interface ButtonGroupItem {
  key: string
  label: string
  variant?: 'primary' | 'secondary' | 'destructive' | 'auth'
}

export interface ButtonGroupRef {
  getValue: () => string
}

type SpaceKey = keyof Sizing['space']

interface ButtonGroupProps {
  title?: string
  items: ButtonGroupItem[]
  defaultSelected?: string
  direction?: 'horizontal' | 'vertical'
  spacing?: SpaceKey
  fullWidth?: boolean
  outlined?: boolean
  style?: StyleProp<ViewStyle>
}

/**
 * 🎛️ ButtonGroup (v2)
 * Exclusive selection group — one active at a time.
 * Ref-based for manual access, consistent with other groups.
 */
export const ButtonGroup = forwardRef<ButtonGroupRef, ButtonGroupProps>(
  (
    {
      title,
      items,
      defaultSelected,
      direction = 'horizontal',
      spacing = 'sm',
      fullWidth = false,
      outlined = false,
      style,
    },
    ref
  ) => {
    const S = useScale()
    const { theme } = UseTheme()
    const [selected, setSelected] = useState(defaultSelected ?? items[0]?.key)

    // expose value via ref
    useImperativeHandle(ref, () => ({
      getValue: () => selected,
    }))

    const flexDirection: ViewStyle['flexDirection'] =
      direction === 'horizontal' ? 'row' : 'column'

    return (
      <View
        style={[
          {
            borderWidth: outlined ? 1.5 : 0,
            borderColor: outlined ? $('border') : 'transparent',
            borderRadius: outlined ? S.radius.md : 0,
            backgroundColor: outlined ? 'transparent' : undefined,
            padding: outlined ? S.space.sm : 0,
            width: '100%',
          },
          style,
        ]}
      >
        {/* Group title */}
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

        {/* Buttons */}
        <View
          style={{
            flexDirection,
            gap: S.space[spacing],
            width: fullWidth ? '100%' : undefined,
          }}
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
      </View>
    )
  }
)

ButtonGroup.displayName = 'ButtonGroup'
