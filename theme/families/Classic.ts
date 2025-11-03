import { TOKENS, ThemeTokens } from '@/theme/tokens'

export type ClassicTheme = {
  dark: ThemeTokens
  light: ThemeTokens
}

export const classicTheme: ClassicTheme = {
  dark: {
    [TOKENS.primary]: '#8B4513',               // gold brand

    // Backgrounds
    [TOKENS.background]: '#2f353d',
    [TOKENS.surface]: '#161B22',
    [TOKENS.elevated]: '#1d222a',
    [TOKENS.bgInverse]: '#F5E6D3',

    // Text
    [TOKENS.textPrimary]: '#F5E6D3',
    [TOKENS.textSecondary]: '#8B7355',
    [TOKENS.textInverse]: '#2f353d',
    [TOKENS.textOnAccent]: '#2f1b00',          // legible on gold

    // Borders
    [TOKENS.border]: '#654321',
    [TOKENS.borderSubtle]: '#3b3b3b',

    // Accent
    [TOKENS.accent]: '#D4AF37',                // gold
    [TOKENS.accentHover]: '#FFD700',           // brighter gold
    [TOKENS.accentText]: '#2f353d',            // text on gold
    [TOKENS.accentLight]: '#E8C85A',           // lighter gold
    [TOKENS.accentDark]: '#B38F1E',            // darker bronze

    // Feedback
    [TOKENS.success]: '#82cc7e',
    [TOKENS.warning]: '#E9B949',
    [TOKENS.danger]: '#dc3545',
    [TOKENS.info]: '#339af0',

    // Overlays & effects
    [TOKENS.overlayLight]: 'rgba(255,255,255,0.05)',
    [TOKENS.overlayDark]: 'rgba(0,0,0,0.25)',
    [TOKENS.shadow]: 'rgba(66, 66, 66, 0.25)',
    [TOKENS.glow]: 'rgba(212,175,55,0.28)',    // warm gold aura

    // Buttons — primary
    [TOKENS.primaryButtonText]: '#8B4513',

    // Buttons — destructive/cancel/outlined/ghost
    [TOKENS.destructiveButton]: '#dc3545',
    [TOKENS.destructiveButtonText]: '#F5E6D3',
    [TOKENS.cancelButton]: 'rgba(113,126,137,1)',
    [TOKENS.cancelButtonText]: '#0f1b27ff',

    // Typography
    [TOKENS.fontFamilyTitle]: 'GrenzeGotisch',
    [TOKENS.fontFamily]: 'GrenzeGotisch',
    [TOKENS.fontFamilyPara]: 'HelveticaNeue',
  },

  light: {
    [TOKENS.primary]: 'rgba(139, 69, 19, 1)',               // deep brown brand

    // Backgrounds
    [TOKENS.background]: '#F5E6D3',
    [TOKENS.surface]: '#e5d7c0',
    [TOKENS.elevated]: '#dcc7a7',
    [TOKENS.bgInverse]: '#2f353d',

    // Text
    [TOKENS.textPrimary]: '#2f353d',
    [TOKENS.textSecondary]: '#654321',
    [TOKENS.textInverse]: '#F5E6D3',
    [TOKENS.textOnAccent]: '#fffaf0',          // readable on gold

    // Borders
    [TOKENS.border]: '#8B4513',
    [TOKENS.borderSubtle]: '#c9b59c',

    // Accent
    [TOKENS.accent]: '#D4AF37',
    [TOKENS.accentHover]: '#C2A039',
    [TOKENS.accentText]: '#2f353d',
    [TOKENS.accentLight]: '#E8C85A',
    [TOKENS.accentDark]: '#B38F1E',

    // Feedback
    [TOKENS.success]: '#4CAF50',
    [TOKENS.warning]: '#E9B949',
    [TOKENS.danger]: '#dc3545',
    [TOKENS.info]: '#339af0',

    // Overlays & effects
    [TOKENS.overlayLight]: 'rgba(255,255,255,0.05)',
    [TOKENS.overlayDark]: 'rgba(0,0,0,0.15)',
    [TOKENS.shadow]: 'rgba(0,0,0,0.18)',
    [TOKENS.glow]: 'rgba(212,175,55,0.35)',    // brighter gold aura

    // Buttons — primary
    [TOKENS.primaryButtonText]: '#F5E6D3',

    // Buttons — destructive/cancel/outlined/ghost
    [TOKENS.destructiveButton]: '#dc3545',
    [TOKENS.destructiveButtonText]: '#F5E6D3',
    [TOKENS.cancelButton]: 'rgba(113,126,137,1)',
    [TOKENS.cancelButtonText]: '#0f1b27ff',

    // Typography
    [TOKENS.fontFamilyTitle]: 'GrenzeGotisch',
    [TOKENS.fontFamily]: 'GrenzeGotisch',
    [TOKENS.fontFamilyPara]: 'HelveticaNeue',
  },
}
