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
    [TOKENS.elevated]: '#15003d',
    [TOKENS.bgInverse]: '#e3f2fd',

    // Text
    [TOKENS.textPrimary]: '#e3f2fd',
    [TOKENS.textSecondary]: '#89aaff',
    [TOKENS.textInverse]: '#060014',
    [TOKENS.textOnAccent]: '#000000',

    // Borders
    [TOKENS.border]: '#2a0072',
    [TOKENS.borderSubtle]: '#190042',

    // Accent
    [TOKENS.accent]: '#00ffff',
    [TOKENS.accentHover]: '#66ffff',
    [TOKENS.accentText]: '#0a0a0a',
    [TOKENS.accentLight]: '#80ffff',
    [TOKENS.accentDark]: '#00a3a3',

    // Feedback
    [TOKENS.success]: '#00ffa3',
    [TOKENS.warning]: '#ffd400',
    [TOKENS.danger]: '#ff4081',

    // Overlays & effects
    [TOKENS.overlayLight]: 'rgba(255,255,255,0.05)',
    [TOKENS.overlayDark]: 'rgba(0,0,0,0.5)',
    [TOKENS.shadow]: 'rgba(0,255,255,0.25)',
    [TOKENS.glow]: 'rgba(0,255,255,0.6)',     // cyan glow

    // Buttons — primary
    [TOKENS.primaryButtonBg]: '#00ffff',
    [TOKENS.primaryButtonBorder]: '#00a3a3',
    [TOKENS.primaryButtonText]: '#000000',
    [TOKENS.primaryButtonHover]: '#66ffff',

    // Buttons — secondary
    [TOKENS.secondaryButtonBg]: '#15003d',
    [TOKENS.secondaryButtonBorder]: '#00ffff',
    [TOKENS.secondaryButtonText]: '#80ffff',
    [TOKENS.secondaryButtonHover]: '#1a0072',

    // Buttons — destructive/cancel/outlined/ghost
    [TOKENS.destructiveButton]: '#ff1744',
    [TOKENS.destructiveButtonText]: '#fff',
    [TOKENS.cancelButton]: '#33334d',
    [TOKENS.cancelButtonText]: '#80ffff',
    [TOKENS.solidOutButton]: '#00ffff',

    // Typography
    [TOKENS.fontFamilyTitle]: 'Orbitron, sans-serif',
    [TOKENS.fontFamily]: 'Rajdhani, sans-serif',
    [TOKENS.fontFamilyPara]: 'Roboto, sans-serif',
  },

  light: {
    [TOKENS.primary]: '#ff0088',             // magenta brand

    // Backgrounds
    [TOKENS.background]: '#f2f7ff',
    [TOKENS.surface]: '#ffffff',
    [TOKENS.elevated]: '#e6ecff',
    [TOKENS.bgInverse]: '#120033',

    // Text
    [TOKENS.textPrimary]: '#120033',
    [TOKENS.textSecondary]: '#4d0099',
    [TOKENS.textInverse]: '#ffffff',
    [TOKENS.textOnAccent]: '#ffffff',

    // Borders
    [TOKENS.border]: '#ccd6ff',
    [TOKENS.borderSubtle]: '#e0e6ff',

    // Accent
    [TOKENS.accent]: '#ff0088',
    [TOKENS.accentHover]: '#ff4db4',
    [TOKENS.accentText]: '#ffffff',
    [TOKENS.accentLight]: '#ff99cc',
    [TOKENS.accentDark]: '#cc006a',

    // Feedback
    [TOKENS.success]: '#00b894',
    [TOKENS.warning]: '#ffb700',
    [TOKENS.danger]: '#ff1744',

    // Overlays & effects
    [TOKENS.overlayLight]: 'rgba(255,255,255,0.05)',
    [TOKENS.overlayDark]: 'rgba(0,0,0,0.15)',
    [TOKENS.shadow]: 'rgba(0,0,0,0.15)',
    [TOKENS.glow]: 'rgba(255,0,136,0.4)',     // pink glow

    // Buttons — primary
    [TOKENS.primaryButtonBg]: '#ff0088',
    [TOKENS.primaryButtonBorder]: '#cc006a',
    [TOKENS.primaryButtonText]: '#fff',
    [TOKENS.primaryButtonHover]: '#ff4db4',

    // Buttons — secondary
    [TOKENS.secondaryButtonBg]: '#ffffff',
    [TOKENS.secondaryButtonBorder]: '#ff0088',
    [TOKENS.secondaryButtonText]: '#ff0088',
    [TOKENS.secondaryButtonHover]: '#fff0f7',

    // Buttons — destructive/cancel/outlined/ghost
    [TOKENS.destructiveButton]: '#ff1744',
    [TOKENS.destructiveButtonText]: '#fff',
    [TOKENS.cancelButton]: '#cccccc',
    [TOKENS.cancelButtonText]: '#333333',
    [TOKENS.solidOutButton]: '#ff0088',

    // Typography
    [TOKENS.fontFamilyTitle]: 'Orbitron, sans-serif',
    [TOKENS.fontFamily]: 'Rajdhani, sans-serif',
    [TOKENS.fontFamilyPara]: 'Roboto, sans-serif',
  },
}
