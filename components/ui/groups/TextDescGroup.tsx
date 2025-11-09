import { $, useScale, UseTheme, type Sizing } from '@/theme'
import { forwardRef, useImperativeHandle, useState } from 'react'
import { View } from 'react-native'
import { ObjHeading } from '../AppText'
import { GroupView } from '../Resuables/SpecializedViews'
import { DescInput } from '../TextInputs'

interface TextDescItem {
  key: string
  heading: string // 👈 individual input heading
  placeholder?: string
  defaultValue?: string
  maxHeightDelta?: number
  minLines?: number
  accentScrollbar?: boolean
}

export interface TextDescGroupRef {
  getValues: () => Record<string, string>
}

type SpaceKey = keyof Sizing['space']

interface TextDescGroupProps {
  title?: string // 👈 group title
  items: TextDescItem[]
  direction?: 'vertical' | 'horizontal'
  spacing?: SpaceKey
  fullWidth?: boolean
  outlined?: boolean // 👈 optional border style
  background?: string // 👈 optional background
  onLastEnter?: () => void // 👈 called when last input receives Enter key
}

/**
 * 📝 TextDescGroup (ref-based)
 * Group of multi-line text inputs (DescInput) with internal state, accessible via ref.getValues().
 * Tab navigates between inputs, Enter on last input triggers callback.
 */
export const TextDescGroup = forwardRef<TextDescGroupRef, TextDescGroupProps>(
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

        {/* Text Descriptions */}
        <View
          style={{
            flexDirection: direction === 'horizontal' ? 'row' : 'column',
            gap: S.space[spacing],
          }}
        >
          {items.map((item, index) => (
            <DescInput
              key={item.key}
              heading={item.heading}
              value={values[item.key]}
              onChangeText={(text) => handleChange(item.key, text)}
              placeholder={item.placeholder}
              maxHeightDelta={item.maxHeightDelta}
              minLines={item.minLines}
              accentScrollbar={item.accentScrollbar}
              enableTabNavigation
              onTabPress={() => handleTabPress(index)}
              onEnterPress={() => handleEnterPress(index)}
            />
          ))}
        </View>
      </GroupView>
    )
  }
)

TextDescGroup.displayName = 'TextDescGroup'
