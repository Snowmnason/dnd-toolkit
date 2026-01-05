import { useScale, type Sizing } from '@/theme'
import { forwardRef, useImperativeHandle, useState } from 'react'
import { ObjHeading } from '../AppText'
import Dropdown from '../Dropdown'
import { GroupView } from '../Resuables/SpecializedViews'

interface DropdownOption {
  label: string
  value: string
}

interface DropdownItem {
  key: string
  heading: string
  options: DropdownOption[]
}

export interface DropdownGroupRef {
  getValues: () => Record<string, string>
}

type SpaceKey = keyof Sizing['space']

interface DropdownGroupProps {
  title?: string
  items: DropdownItem[]
  defaultValues?: Record<string, string>
  direction?: 'vertical' | 'horizontal'
  spacing?: SpaceKey
  fullWidth?: boolean
  background?: string
}

/**
 * 🧱 DropdownGroup (v2)
 * Each dropdown always has one selected value.
 * Returns all current values via ref.getValues().
 */
export const DropdownGroup = forwardRef<DropdownGroupRef, DropdownGroupProps>(
  (
    {
      title,
      items,
      defaultValues = {},
      direction = 'vertical',
      spacing = 'sm',
      fullWidth = false,
      background = 'transparent',
    },
    ref
  ) => {
    const S = useScale()
    const [values, setValues] = useState<Record<string, string>>(() => {
      const initial: Record<string, string> = {}
      items.forEach((item) => {
        initial[item.key] =
          defaultValues[item.key] ?? item.options[0]?.value ?? ''
      })
      return initial
    })

    const handleSelect = (key: string, newValue: string) => {
      setValues((prev) => ({ ...prev, [key]: newValue }))
    }

    // Expose ref method
    useImperativeHandle(ref, () => ({
      getValues: () => values,
    }))

    return (
      <GroupView
        direction={direction === 'horizontal' ? 'row' : 'column'}
        gap={spacing}
        backgroundColor={background}
        style={{ width: fullWidth ? '100%' : undefined }}
      >
        {title && (
          <ObjHeading
            style={{
              marginBottom: S.space.xs,
              marginLeft: S.space.xs,
              opacity: 0.9,
            }}
          >
            {title}
          </ObjHeading>
        )}

        {items.map((item) => (
          <Dropdown
            key={item.key}
            heading={item.heading}
            items={item.options}
            value={values[item.key] || null}
            onChange={(val) => handleSelect(item.key, val ?? '')}
          />
        ))}
      </GroupView>
    )
  }
)

DropdownGroup.displayName = 'DropdownGroup'
