import { TOKENS, ThemeTokens } from '@/theme/tokens'

export type CyberpunkTheme = {
  dark: ThemeTokens
  light: ThemeTokens
  preload?: () => Promise<void> | void
}

export const cyberpunkTheme: CyberpunkTheme = {
  dark: {
    [TOKENS.primary]: '#00ffff',             // neon cyan brand

    // Backgrounds
    [TOKENS.background]: '#060014',
    [TOKENS.surface]: '#0d0024',
    [TOKENS.bgInverse]: '#e3f2fd',

    // Text
    [TOKENS.textPrimary]: '#e3f2fd',
    [TOKENS.textSecondary]: '#89aaff',
    [TOKENS.textInverse]: '#060014',

    // Borders
    [TOKENS.border]: '#2a0072',
    [TOKENS.borderSubtle]: '#190042',

    // Accent
    [TOKENS.accent]: '#00ffff',

    // Feedback
    [TOKENS.success]: '#00ffa3',
    [TOKENS.warning]: '#ffd400',
    [TOKENS.danger]: '#ff4081',
    [TOKENS.info]: '#339af0',

    // Effects
    [TOKENS.shadow]: 'rgba(0,255,255,0.25)',

    // Buttons — primary
    [TOKENS.primaryButtonText]: '#000000',

    // Buttons — destructive/cancel/outlined/ghost
    [TOKENS.destructiveButton]: '#ff1744',
    [TOKENS.destructiveButtonText]: '#fff',
    [TOKENS.cancelButton]: '#33334d',
    [TOKENS.cancelButtonText]: '#80ffff',

    // Typography
    [TOKENS.fontFamilyTitle]: 'Cyberpunk',
    [TOKENS.fontFamily]: 'Eurostile',
    [TOKENS.fontFamilyPara]: 'Roboto, sans-serif',

    // Chrome (Top Bar + Bottom Bar)
    [TOKENS.ChromeBackground]: "#1f262e",
    [TOKENS.ChromeText]: "#F5E6D3",
    [TOKENS.ChromeBorder]: "#969696",
  },

  light: {
    [TOKENS.primary]: '#ff0088',             // magenta brand

    // Backgrounds
    [TOKENS.background]: '#f2f7ff',
    [TOKENS.surface]: '#ffffff',
    [TOKENS.bgInverse]: '#120033',

    // Text
    [TOKENS.textPrimary]: '#120033',
    [TOKENS.textSecondary]: '#4d0099',
    [TOKENS.textInverse]: '#ffffff',

    // Borders
    [TOKENS.border]: '#ccd6ff',
    [TOKENS.borderSubtle]: '#e0e6ff',

    // Accent
    [TOKENS.accent]: '#ff0088',

    // Feedback
    [TOKENS.success]: '#00b894',
    [TOKENS.warning]: '#ffb700',
    [TOKENS.danger]: '#ff1744',
    [TOKENS.info]: '#339af0',

    // Effects
    [TOKENS.shadow]: 'rgba(0,0,0,0.15)',

    // Buttons — primary
    [TOKENS.primaryButtonText]: '#fff',

    // Buttons — destructive/cancel/outlined/ghost
    [TOKENS.destructiveButton]: '#ff1744',
    [TOKENS.destructiveButtonText]: '#fff',
    [TOKENS.cancelButton]: '#cccccc',
    [TOKENS.cancelButtonText]: '#333333',

    // Typography
    [TOKENS.fontFamilyTitle]: 'Cyberpunk',
    [TOKENS.fontFamily]: 'Eurostile',
    [TOKENS.fontFamilyPara]: 'Roboto, sans-serif',

    // Chrome (Top Bar + Bottom Bar)
    [TOKENS.ChromeBackground]: "#1f262e",
    [TOKENS.ChromeText]: "#F5E6D3",
    [TOKENS.ChromeBorder]: "#969696",
  },
}
