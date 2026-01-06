import { $, useScale, UseTheme, type Sizing } from '@/theme'
import { forwardRef, useImperativeHandle, useState } from 'react'
import { View } from 'react-native'
import { ObjHeading } from '../AppText'
import { GroupView } from '../Resuables/SpecializedViews'
import { DescInput, TextInput } from '../TextInputs'

interface TextInputItem {
  key: string
  heading: string // 👈 individual input heading
  placeholder?: string
  defaultValue?: string
  multiline?: boolean
  type?: 'input' | 'desc' // 👈 specify input type
}

export interface TextInputGroupRef {
  getValues: () => Record<string, string>
}

type SpaceKey = keyof Sizing['space']

interface TextInputGroupProps {
  title?: string // 👈 group title
  items: TextInputItem[]
  direction?: 'vertical' | 'horizontal'
  spacing?: SpaceKey
  fullWidth?: boolean
  outlined?: boolean // 👈 optional border style
  background?: string // 👈 optional background
  onLastEnter?: () => void // 👈 called when last input receives Enter key
}

/**
 * ✍️ TextInputGroup (ref-based)
 * Group of text inputs with internal state, accessible via ref.getValues().
 * Consistent with DropdownGroup styling + props.
 */
export const TextInputGroup = forwardRef<TextInputGroupRef, TextInputGroupProps>(
  (
    {
      title,
      items,
      direction = 'vertical',
      spacing = 'md',
      fullWidth = false,
      outlined = false,
      background = 'transparent',
      onLastEnter,
    },
    ref
  ) => {
    const S = useScale()
    const { theme } = UseTheme()
    const [values, setValues] = useState<Record<string, string>>(() => {
      const initial: Record<string, string> = {}
      items.forEach((item) => {
        initial[item.key] = item.defaultValue ?? ''
      })
      return initial
    })

    const handleChange = (key: string, text: string) => {
      setValues((prev) => ({ ...prev, [key]: text }))
    }

    const handleTabPress = (index: number) => {
      // Tab moves to next item — auto-focused by platform
      // (on web: Tab key naturally moves to next input)
      // (on mobile: user can manually focus or use navigation)
    }

    const handleEnterPress = (index: number) => {
      // Last item: call onLastEnter callback
      if (index === items.length - 1) {
        onLastEnter?.()
      }
    }

    // expose .getValues() for parent access
    useImperativeHandle(ref, () => ({
      getValues: () => values,
    }))

    return (
      <GroupView
        borderWidth={outlined ? 1.5 : 0}
        borderColor={outlined ? $('border') : 'transparent'}
        borderRadius={outlined ? 'md' : undefined}
        padding={outlined ? 'sm' : undefined}
        backgroundColor={background}
        direction="column"
        style={{ width: fullWidth ? '100%' : undefined }}
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

        {/* Text Inputs */}
        <View
          style={{
            flexDirection: direction === 'horizontal' ? 'row' : 'column',
            gap: S.space[spacing as keyof typeof S.space],
          }}
        >
          {items.map((item, index) => {
            const InputComponent = item.type === 'desc' ? DescInput : TextInput
            return (
              <InputComponent
                key={item.key}
                heading={item.heading}
                value={values[item.key]}
                onChangeText={(text) => handleChange(item.key, text)}
                placeholder={item.placeholder}
                multiline={item.multiline}
                enableTabNavigation
                onTabPress={() => handleTabPress(index)}
                onEnterPress={() => handleEnterPress(index)}
              />
            )
          })}
        </View>
      </GroupView>
    )
  }
)

TextInputGroup.displayName = 'TextInputGroup'
