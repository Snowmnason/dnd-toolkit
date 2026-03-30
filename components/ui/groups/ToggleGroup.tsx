import { Body, ObjHeading } from '@/components/ui/AppText'
import { $, useScale, UseTheme, type Sizing } from '@/theme'
import React, {
    forwardRef,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from 'react'
import { Pressable, View } from 'react-native'
import { GroupView } from '../Resuables/SpecializedViews'

interface ToggleItem {
  key: string
  icon: React.ReactNode
  color?: string
  tooltip?: string
}

export interface ToggleGroupRef {
  getValues: () => string[]
}

type SpaceKey = keyof Sizing['space']

interface ToggleGroupProps {
  /** Title shown above the group (optional) */
  title?: string
  /** Toggle button definitions */
  items: ToggleItem[]
  /** Default active keys (uncontrolled) */
  defaultActive?: string[]
  /** Controlled active keys */
  active?: string[]
  /** Called whenever selection changes */
  onChange?: (keys: string[]) => void
  /** Exclusive: only one can be active at once */
  exclusive?: boolean
  /** Maximum active items (used when exclusive=false) */
  maxActive?: number
  /** Layout direction */
  direction?: 'horizontal' | 'vertical'
  /** Space between buttons */
  spacing?: SpaceKey
  /** Add subtle border + floating title */
  outlined?: boolean
  /** Background color */
  background?: string
}

/**
 * 🎛️ ToggleGroup v6
 * Accent-highlighted icon toggles with exclusive / multi-select modes,
 * optional outline + title.
 */
export const ToggleGroup = forwardRef<ToggleGroupRef, ToggleGroupProps>(
  (
    {
      title,
      items,
      defaultActive = [],
      active,
      onChange,
      exclusive = true,
      maxActive,
      direction = 'horizontal',
      spacing = 'sm',
      outlined = false,
      background = 'transparent',
    },
    ref
  ) => {
    const S = useScale()
    const { theme } = UseTheme()
    const [internalActive, setInternalActive] = useState(defaultActive)
    const activeItems = active ?? internalActive
    const initializedRef = useRef(false)

    /** core selection logic */
    const handleToggle = (key: string) => {
      let next: string[] = []

      if (exclusive) {
        // only one active — clicking again deselects
        next = activeItems.includes(key) ? [] : [key]
      } else {
        // multi-select
        if (activeItems.includes(key)) {
          next = activeItems.filter((k) => k !== key)
        } else {
          // respect maxActive limit
          if (maxActive && activeItems.length >= maxActive) {
            // remove the first one clicked if we exceed the max
            const [, ...rest] = [...activeItems, key]
            next = rest
          } else {
            next = [...activeItems, key]
          }
        }
      }

      if (!active) setInternalActive(next)
      onChange?.(next)
    }

    useImperativeHandle(ref, () => ({
      getValues: () => activeItems,
    }))

    // Only initialize on mount to avoid infinite loops from array prop recreation
    useEffect(() => {
      if (!initializedRef.current) {
        setInternalActive(defaultActive)
        initializedRef.current = true
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
      <GroupView
        borderWidth={outlined ? 1.5 : 0}
        borderColor={outlined ? $('border') : 'transparent'}
        borderRadius={outlined ? 'md' : undefined}
        padding={outlined ? 'sm' : undefined}
        backgroundColor={background}
        direction="column"
      >
        {/* ─────────────── Title ─────────────── */}
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

        {/* ─────────────── Toggle Buttons ─────────────── */}
        <View
          style={{
            flexDirection: direction === 'horizontal' ? 'row' : 'column',
            alignItems: direction === 'horizontal' ? 'center' : 'flex-start',
            justifyContent: direction === 'horizontal' ? 'space-evenly' : 'flex-start',
            gap: S.space[spacing as keyof typeof S.space],
          }}
        >
          {items.map((item) => {
            const isActive = activeItems.includes(item.key)
            const backgroundColor = isActive ? $('accent', theme) : 'transparent'
            const borderColor = $('accent', theme)

            return (
              <Pressable
                key={item.key}
                onPress={() => handleToggle(item.key)}
                style={{
                  borderWidth: 1.5,
                  borderColor,
                  backgroundColor,
                  borderRadius: S.radius.round,
                  paddingVertical: S.space.sm,
                  paddingHorizontal: S.space.md,
                  justifyContent: 'center',
                  alignItems: 'center',
                  minWidth: 44,
                  minHeight: 44,
                }}
              >
                {typeof item.icon === 'string' ? (
                  <Body>{item.icon}</Body>
                ) : (
                  item.icon
                )}
              </Pressable>
            )
          })}
        </View>
      </GroupView>
    )
  }
)

ToggleGroup.displayName = 'ToggleGroup'
