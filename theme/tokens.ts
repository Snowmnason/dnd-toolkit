/**
 * 🔑 Design token names shared by all themes.
 * These represent the "vocabulary" of your UI.
 */
export const TOKENS = {
  primary: 'primary',                 // Primary brand color

  /* 🎨 Background Layers */
  background: 'background',           // Main background
  surface: 'surface',                 // Cards, modals, containers
  bgInverse: 'bgInverse',             // Great for interactive elements

  /* ✍️ Text Colors */
  textPrimary: 'textPrimary',         // Main readable text
  textSecondary: 'textSecondary',     // Muted or secondary text
  textInverse: 'textInverse',         // Text on light or accent backgrounds

  /* 🔲 Borders */
  border: 'border',                   // Default border
  borderSubtle: 'borderSubtle',       // Faint or inner dividers

  /* 🌟 Accents / Highlights */
  accent: 'accent',                   // Brand highlight color

  /* ⚠️ Feedback & System States */
  success: 'success',                 // Positive / confirmed
  warning: 'warning',                 // Attention / caution
  danger: 'danger',                   // Error / destructive
  info: 'info',                       // Informational / neutral

  /* 🌫️ Effects */
  shadow: 'shadow',                   // Standard shadow color

  /* 🔘 Buttons */
  primaryButtonText: 'primaryButtonText',

  // Destructive Button
  destructiveButton: 'destructiveButton',
  destructiveButtonText: 'destructiveButtonText', //Always Light Text

  /*Cancel Button */
  cancelButton: 'cancelButton',
  cancelButtonText: 'cancelButtonText', //Always Dark Text

  /* 🔤 Typography */
  fontFamilyTitle: 'fontFamilyTitle', // Used for headings or titles
  fontFamily: 'fontFamily',           // Primary body text
  fontFamilyPara: 'fontFamilyPara',   // Long-form or paragraph text

  /*Chrome Bar*/
  ChromeBackground: 'ChromeBackground',
  ChromeText: 'ChromeText',
  ChromeBorder: 'ChromeBorder',

  /*Job Status*/
  JobUpload: 'JobUpload',
  JobDownload: 'JobDownload',
  JobBackground: 'JobBackground',
  

} as const

export type TokenName = keyof typeof TOKENS
export type ThemeTokens = Record<TokenName, string>
export type ThemeResolver = (token: TokenName) => string
