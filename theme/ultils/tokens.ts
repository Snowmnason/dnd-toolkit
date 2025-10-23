import { ThemeTokens } from '@/theme/tokens'
import { UseTheme } from '../ThemeProvider'
import { S } from './sizing'

/* ───────────────────────────────
   MERGED TOKEN SOURCE
   Combines colors (theme) + sizing (S)
──────────────────────────────── */
function mergeTokens(theme: ThemeTokens) {
  return {
    ...theme,          // all color tokens
    ...S.font,         // font sizes ($sm, $md, etc.)
    ...S.space,        // spacing ($sm, $md, etc.)
    ...S.radius,       // radius tokens ($sm, $md, etc.)
    ...S.border,       // border width tokens
  }
}

/* ───────────────────────────────
   $() – explicit token lookup
   Example: color: $('background')
──────────────────────────────── */
export function $(key: keyof ThemeTokens | keyof typeof S.font | keyof typeof S.space): any {
  const { theme } = UseTheme()
  const tokens = mergeTokens(theme)
  return tokens[key as keyof typeof tokens]
}

/* ───────────────────────────────
   resolveStyleTokens – resolves "$token" in style objects
──────────────────────────────── */
export function resolveStyleTokens<T extends Record<string, any>>(
  style: T,
  theme: ThemeTokens
): T {
  const tokens = mergeTokens(theme)
  const resolved: any = {}

  for (const key in style) {
    const value = style[key]

    if (typeof value === 'string' && value.startsWith('$')) {
      const tokenName = value.slice(1)
      resolved[key] = tokens[tokenName as keyof typeof tokens]
    } else if (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value)
    ) {
      resolved[key] = resolveStyleTokens(value, theme)
    } else {
      resolved[key] = value
    }
  }

  return resolved
}

/* ───────────────────────────────
   useThemeTokens – Hook version
──────────────────────────────── */
export function useThemeTokens() {
  const { theme } = UseTheme()
  const resolve = <T extends Record<string, any>>(style: T) =>
    resolveStyleTokens(style, theme)

  const tokens = mergeTokens(theme)
  return { theme, tokens, resolve }
}
