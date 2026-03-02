import { ThemeTokens } from "@/theme/tokens";
import { UseTheme } from "@/providers";
import { $ as cssVarDollar } from "./cssVars";
import { S } from "./sizing";

/* ───────────────────────────────
   MERGED TOKEN SOURCE
   Combines colors (theme) + sizing (S)
──────────────────────────────── */
function mergeTokens(theme: ThemeTokens) {
  return {
    ...theme, // all color tokens
    ...S.font, // font sizes ($sm, $md, etc.)
    ...S.space, // spacing ($sm, $md, etc.)
    ...S.radius, // radius tokens ($sm, $md, etc.)
    ...S.border, // border width tokens
  };
}

/* ───────────────────────────────
   $() – Web-optimized token lookup
   Example: color: $('background', theme)
   
   - On web: returns CSS variables for color tokens (instant theme updates)
   - On native: returns resolved token values
   - All platforms: returns direct values for sizing tokens
   
   Theme parameter is optional; if omitted, fetches from context.
──────────────────────────────── */
export function $(
  key: keyof ThemeTokens | keyof typeof S.font | keyof typeof S.space,
  theme?: ThemeTokens,
): any {
  // Check if this is a sizing/spacing token (not a color)
  const sizingTokens = { ...S.font, ...S.space, ...S.radius, ...S.border };
  if (key in sizingTokens) {
    return sizingTokens[key as keyof typeof sizingTokens];
  }

  // For color tokens, use the web-optimized cssVar helper
  return cssVarDollar(key as any, theme);
}

/* ───────────────────────────────
   resolveStyleTokens – resolves "$token" in style objects
──────────────────────────────── */
export function resolveStyleTokens<T extends Record<string, any>>(
  style: T,
  theme: ThemeTokens,
): T {
  const tokens = mergeTokens(theme);
  const resolved: any = {};
   
  for (const key in style) {
    /* eslint-disable-next-line security/detect-object-injection */
    const value = style[key];

    if (typeof value === "string" && value.startsWith("$")) {
      const tokenName = value.slice(1);
      /* eslint-disable-next-line security/detect-object-injection -- safe: tokenName originates from style token string in code */
      resolved[key] = tokens[tokenName as keyof typeof tokens];
    } else if (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value)
    ) {
      // eslint-disable-next-line security/detect-object-injection
      resolved[key] = resolveStyleTokens(value, theme);
    } else {
      // eslint-disable-next-line security/detect-object-injection
      resolved[key] = value;
    }
  }

  return resolved;
}

/* ───────────────────────────────
   useThemeTokens – Hook version
──────────────────────────────── */
export function useThemeTokens() {
  const { theme } = UseTheme();
  const resolve = <T extends Record<string, any>>(style: T) =>
    resolveStyleTokens(style, theme);

  const tokens = mergeTokens(theme);
  return { theme, tokens, resolve };
}
