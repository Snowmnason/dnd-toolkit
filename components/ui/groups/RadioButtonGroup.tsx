import { ObjHeading } from '@/components/ui/AppText'
import { RadioButton } from '@/components/ui/RadioButton'
import { $, useScale, UseTheme, type Sizing } from '@/theme'
import { forwardRef, useImperativeHandle, useState } from 'react'
import { View } from 'react-native'
import { GroupView } from '../Resuables/SpecializedViews'

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
  background?: string
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
      items = [],
      defaultSelected,
      direction = 'vertical',
      spacing = 'sm',
      fullWidth = false,
      outlined = false,
      background = 'transparent',
    },
    ref
  ) => {
    const S = useScale()
    const { theme } = UseTheme()
    // Call all hooks before any potential throwing computations
    const [selected, setSelected] = useState<string | null>(
      defaultSelected ?? items?.[0]?.key ?? null
    )
    // Resolve tokens (pure functions) after hooks to avoid hook order mismatch if they throw
    const borderTokenColor = $('border', theme)
    const titleBgColor = $('background', theme)

    useImperativeHandle(ref, () => ({
      getValue: () => selected,
    }))

    return (
      <GroupView
        borderWidth={outlined ? 1.5 : 0}
        borderColor={outlined ? borderTokenColor : 'transparent'}
        borderRadius={outlined ? 'md' : undefined}
        padding={outlined ? 'sm' : undefined}
        backgroundColor={background}
        direction="column"
        style={{ width: fullWidth ? '100%' : undefined }}
      >
        {/* Title */}
        {title && (
          <ObjHeading
            style={{
              position: outlined ? 'absolute' : 'relative',
              top: outlined ? -S.space.md : 0,
              left: outlined ? S.space.sm : 0,
              paddingHorizontal: outlined ? S.space.xs : 0,
              backgroundColor: outlined ? titleBgColor : 'transparent',
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
            gap: S.space[spacing as keyof typeof S.space],
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
      </GroupView>
    )
  }
)

RadioButtonGroup.displayName = 'RadioButtonGroup'
