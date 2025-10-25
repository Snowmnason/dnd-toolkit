/**
 * 🔑 Design token names shared by all themes.
 * These represent the "vocabulary" of your UI.
 */
export const TOKENS = {
  primary: 'primary',                 // Primary brand color

  /* 🎨 Background Layers */
  background: 'background',           // Main background
  surface: 'surface',                 // Cards, modals, containers
  elevated: 'elevated',               // Headers, navbars, elevated surfaces

  /* ✍️ Text Colors */
  textPrimary: 'textPrimary',         // Main readable text
  textSecondary: 'textSecondary',     // Muted or secondary text
  textInverse: 'textInverse',         // Text on light or accent backgrounds
  textOnAccent: 'textOnAccent',       // NEW: text on accent BGs

  /* 🔲 Borders */
  border: 'border',                   // Default border
  borderSubtle: 'borderSubtle',       // Faint or inner dividers

  /* 🌟 Accents / Highlights */
  accent: 'accent',                   // Brand highlight color
  accentHover: 'accentHover',         // Accent hover / focus
  accentText: 'accentText',           // Text on accent background
  accentLight: 'accentLight',         // NEW: lighter accent tint
  accentDark: 'accentDark',           // NEW: darker accent shade

  /* ⚠️ Feedback & System States */
  success: 'success',                 // Positive / confirmed
  warning: 'warning',                 // Attention / caution
  danger: 'danger',                   // Error / destructive

  /* 🌫️ Overlays */
  overlayLight: 'overlayLight',       // Light overlay on dark surfaces
  overlayDark: 'overlayDark',         // Dark overlay on light surfaces

  shadow: 'shadow',                   // Standard shadow color
  glow: 'glow',                       // NEW: soft glow color (for effects)

  /* 🔘 Buttons */
  // Primary Button
  primaryButtonBg: 'primaryButtonBg',
  primaryButtonBorder: 'primaryButtonBorder',
  primaryButtonText: 'primaryButtonText',
  primaryButtonHover: 'primaryButtonHover',

  // Secondary Button
  secondaryButtonBg: 'secondaryButtonBg',
  secondaryButtonBorder: 'secondaryButtonBorder',
  secondaryButtonText: 'secondaryButtonText',
  secondaryButtonHover: 'secondaryButtonHover',

  // Destructive Button
  destructiveButton: 'destructiveButton',
  destructiveButtonText: 'destructiveButtonText',

  // Cancel Button
  cancelButton: 'cancelButton',
  cancelButtonText: 'cancelButtonText',

  // Solid / Outlined Buttons
  solidOutButton: 'solidOutButton',
  solidOutButtonText: 'solidOutButtonText',

  // Ghost Button
  ghostButtonText: 'ghostButtonText',

  /* 🔤 Typography */
  fontFamilyTitle: 'fontFamilyTitle', // Used for headings or titles
  fontFamily: 'fontFamily',           // Primary body text
  fontFamilyPara: 'fontFamilyPara',   // Long-form or paragraph text
} as const

export type TokenName = keyof typeof TOKENS
export type ThemeTokens = Record<TokenName, string>
export type ThemeResolver = (token: TokenName) => string
