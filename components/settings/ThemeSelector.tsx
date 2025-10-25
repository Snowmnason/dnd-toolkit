import { useThemeSwitcher } from '@/hooks/useThemeSwitcher'
import { $, allThemes, ThemeFamily, ThemeMode, useScale } from '@/theme'
import React from 'react'
import { Text, TouchableOpacity, View } from 'react-native'

/**
 * 🎨 ThemeSelector
 * Displays a grid of theme families with light/dark swatches.
 */
export function ThemeSelector() {
  const { activeTheme, mode, changeTheme, toggleMode } = useThemeSwitcher()
  const S = useScale()

  const handleSelect = (themeName: ThemeFamily, themeMode: ThemeMode) => {
    // Change theme family first
    changeTheme(themeName)

    // Then, ensure the mode matches
    if (mode !== themeMode) toggleMode()
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-around',
        flexWrap: 'wrap',
        gap: S.space.lg,
        marginTop: S.space.lg,
      }}
    >
      {Object.entries(allThemes).map(([key, theme]) => {
        const themeKey = key as ThemeFamily
        const isActiveFamily = themeKey === activeTheme

        return (
          <View
            key={themeKey}
            style={{
              alignItems: 'center',
              padding: S.space.sm,
            }}
          >
            {/* ─────────── Theme Name ─────────── */}
            <Text
              style={{
                color: $('textPrimary'),
                fontWeight: isActiveFamily ? 'bold' : '600',
                marginBottom: S.space.sm,
              }}
            >
              {themeKey.charAt(0).toUpperCase() + themeKey.slice(1)}
            </Text>

            {/* ─────────── Light & Dark Swatches ─────────── */}
            <View style={{ flexDirection: 'row', gap: S.space.sm }}>
              {(Object.keys(theme) as ThemeMode[]).map((m) => (
                <TouchableOpacity
                  key={m}
                  onPress={() => handleSelect(themeKey, m)}
                  activeOpacity={0.85}
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: S.radius.md,
                    backgroundColor: theme[m]?.background ?? '#222',
                    borderWidth:
                      isActiveFamily && mode === m ? 3 : 1,
                    borderColor:
                      isActiveFamily && mode === m
                        ? $('accent')
                        : $('border'),
                  }}
                />
              ))}
            </View>
          </View>
        )
      })}
    </View>
  )
}
