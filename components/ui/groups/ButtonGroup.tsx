import { $, useScale, UseTheme, type Sizing } from '@/theme'
import { forwardRef, useImperativeHandle, useState } from 'react'
import { StyleProp, View, ViewStyle } from 'react-native'
import { ObjHeading } from '../AppText'
import { Button } from '../BaseButton'
import { GroupView } from '../Resuables/SpecializedViews'

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
  background?: string
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
      background = 'transparent',
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

    return (
      <View
        style={[
          {
            width: '100%',
            flexDirection: 'column',
            borderWidth: outlined ? 1.5 : 0,
            borderColor: outlined ? $('border') : 'transparent',
            borderRadius: outlined ? S.radius.md : 0,
            paddingHorizontal: outlined ? S.space.sm : 0,
            paddingVertical: outlined ? S.space.sm : 0,
            backgroundColor: background,
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
        <GroupView
          direction={direction === 'horizontal' ? 'row' : 'column'}
          gap={spacing}
          wrap={direction === 'horizontal'}
          justifyContent={fullWidth ? 'space-evenly' : 'flex-start'}
          alignItems={direction === 'horizontal' ? 'center' : 'stretch'}
          style={{ width: fullWidth ? '100%' : undefined }}
        >
          {items.map((item) => {
            const isActive = selected === item.key
            return (
              <Button
                key={item.key}
                text={item.label}
                variant={isActive ? item.variant ?? 'primary' : 'secondary'}
                onPress={() => setSelected(item.key)}
                minWidth={100}
                style={{
                  flex: fullWidth && direction === 'vertical' ? 1 : undefined,
                  opacity: isActive ? 1 : 0.85,
                }}
              />
            )
          })}
        </GroupView>
      </View>
    )
  }
)

ButtonGroup.displayName = 'ButtonGroup'
