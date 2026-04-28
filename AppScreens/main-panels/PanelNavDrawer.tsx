import { Body, Button, Caption } from '@/components/ui'
import { useActivePanel, useNavigation } from '@/hooks/navigation'
import { useUserRole, useWorldId } from '@/providers'
import { $, UseTheme, useScale } from '@/theme'
import { Ionicons } from '@expo/vector-icons'
import { Pressable, ScrollView, View } from 'react-native'
import { panelConfigs } from './PanelData'

interface PanelNavDrawerProps {
  /** Render icon-only collapsed state (no headings, no items). */
  collapsed?: boolean
}

/**
 * PanelNavDrawer
 *
 * DnD-specific nav drawer content driven entirely by shared panelConfigs.
 * Renders either:
 *   - collapsed: icon-only column per panel + clickable settings footer
 *   - expanded: icon + heading (non-navigable) + compact item rows per panel,
 *               with a pinned clickable settings footer
 *
 * Icon size and icon-column width are unified between states so the transition
 * feels like an opening rather than a layout swap.
 *
 * Active state is derived from the current route via useActivePanel().
 */
export function PanelNavDrawer({ collapsed = false }: PanelNavDrawerProps) {
  const activePanelKey = useActivePanel()
  const navigate = useNavigation()
  const worldId = useWorldId()
  const userRole = useUserRole()
  const S = useScale()
  const { theme } = UseTheme()

  const navigateToFeature = (featurePath: string) => {
    const params: Record<string, string> = {}
    if (worldId) params.worldId = worldId
    if (userRole) params.userRole = userRole as string
    navigate.replace(`/main/${featurePath}`, params)
  }

  // TODO: Open world settings modal when it exists
  const openWorldSettings = () => { /* no-op until world settings modal is built */ }

  // ─── Collapsed: icon column + settings footer ─────────────────

  if (collapsed) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
        }}
      >
        {/* Panel icon list */}
        <View style={{ gap: S.space.sm }}>
          {panelConfigs.map((panel) => {
            const isActive = activePanelKey === panel.key
            return (
              // Icon container — independent View, ready for future animation
              <View
                key={panel.key}
                style={{
                  width: S.size.lg,
                  height: S.size.lg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons
                  name={(isActive ? panel.iconName : `${panel.iconName}-outline`) as any}
                  size={S.size.md}
                  color={isActive ? $('accent', theme) : $('textSecondary', theme)}
                />
              </View>
            )
          })}
        </View>

        {/* Spacer — pushes settings icon to the bottom */}
        <View style={{ flex: 1 }} />

        {/* Settings footer — clickable icon */}
        <Pressable
          onPress={openWorldSettings}
          accessibilityRole="button"
          accessibilityLabel="Settings"
          style={({ pressed }) => ({
            width: S.size.lg,
            height: S.size.lg,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Ionicons
            name="settings-outline"
            size={S.size.md}
            color={$('textSecondary', theme)}
          />
        </Pressable>
      </View>
    )
  }

  // ─── Expanded: scrollable sections + pinned settings footer ───

  return (
    <View style={{ flex: 1 }}>

      {/* Scrollable panel sections */}
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: S.space.xxs,
          paddingBottom: S.space.xxs,
          gap: S.space.xxs,
        }}
        showsVerticalScrollIndicator={false}
        // minHeight: 0 is required on web: CSS flex gives ScrollView min-height: auto by
        // default (= scroll content height), preventing it from shrinking to its flex
        // allocation. Without this, the footer gets pushed outside the shell and clipped.
        style={{ flex: 1, minHeight: 0 }}
      >
        {panelConfigs.map((panel) => {
          const isActive = activePanelKey === panel.key

          return (
            <View key={panel.key}>

              {/* Section header — icon + title, NON-NAVIGABLE */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: S.space.sm,
                  marginBottom: S.space.xxs,
                }}
              >
                {/* Icon container — width matches collapsed for visual alignment */}
                <View style={{ width: S.size.lg, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons
                    name={(isActive ? panel.iconName : `${panel.iconName}-outline`) as any}
                    size={S.size.md}
                    color={isActive ? $('accent', theme) : $('textSecondary', theme)}
                  />
                </View>

                {/* Section label */}
                <View>
                  <Body
                    variant={isActive ? 'bold' : 'regular'}
                    color={isActive ? '$accent' : '$textSecondary'}
                  >
                    {panel.title.split(' ')[0]}
                  </Body>
                </View>
              </View>

              {/* Feature items — indented to align with section label */}
              <View
                style={{
                  paddingLeft: S.space.lg + S.space.md,
                  gap: S.space.xxs,
                }}
              >
                {panel.items.map((item) => (
                  <Pressable
                    key={item.name}
                    onPress={() => navigateToFeature(item.route)}
                    accessibilityRole="button"
                    style={({ pressed }) => ({
                      paddingVertical: S.space.xxs,
                      paddingHorizontal: S.space.xs,
                      borderRadius: S.radius.sm,
                      opacity: pressed ? 0.6 : 1,
                    })}
                  >
                    <Caption color="$textPrimary">{item.name}</Caption>
                  </Pressable>
                ))}
              </View>

            </View>
          )
        })}
      </ScrollView>

      {/* Settings footer — pinned, always visible */}
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: $('borderSubtle', theme),
          paddingTop: S.space.xs,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        {/* Standalone icon — not interactive, purely decorative */}
        <View style={{ width: S.size.lg, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons
            name="settings-outline"
            size={S.size.md}
            color={$('textSecondary', theme)}
          />
        </View>

        {/* Ghost button for the label */}
        <Button
          variant="ghost"
          size="sm"
          align="left"
          text="Settings"
          onPress={openWorldSettings}
        />
      </View>

    </View>
  )
}
