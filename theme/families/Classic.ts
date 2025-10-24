import { TOKENS, ThemeTokens } from '@/theme/tokens'

export type ClassicTheme = {
  dark: ThemeTokens
  light: ThemeTokens
}
  /* ───────────────────────────────
     🌙 DARK MODE (Default)
  ─────────────────────────────── */
export const classicTheme: ClassicTheme = {
  dark: {
    [TOKENS.primary]: '#8B4513',
    /* backgrounds */
    [TOKENS.background]: '#2f353d',          // Main app background
    [TOKENS.surface]: '#161B22',             // Panels, cards, modals
    [TOKENS.elevated]: '#1d222a',            // Elevated containers / headers

    /* text */
    [TOKENS.textPrimary]: '#F5E6D3',         // Main readable text
    [TOKENS.textSecondary]: '#8B4513',       // Secondary or accent text
    [TOKENS.textInverse]: '#2f353d',         // Text for light surfaces

    /* borders */
    [TOKENS.border]: '#654321',              // Strong border color
    [TOKENS.borderSubtle]: '#3b3b3b',        // Subtle dividers

    /* accent / brand */
    [TOKENS.accent]: '#D4AF37',              // Accent / gold
    [TOKENS.accentHover]: '#FFD700',         // Hovered accent
    [TOKENS.accentText]: '#2f353d',          // Text on accent backgrounds

    /* feedback */
    [TOKENS.success]: '#82cc7e',             // Success / positive
    [TOKENS.warning]: '#E9B949',             // Warning / attention
    [TOKENS.danger]: '#dc3545',              // Error / destructive

    /* overlays & transparency */
    [TOKENS.overlayLight]: 'rgba(255, 255, 255, 0.05)',
    [TOKENS.overlayDark]: 'rgba(0, 0, 0, 0.25)',

    [TOKENS.shadow]: 'rgba(255, 255, 255, 0.1)',    // Standard shadow color

    /* buttons */
    // Primary Button
    [TOKENS.primaryButtonBg]: '#F5E6D3',
    [TOKENS.primaryButtonBorder]: '#D4AF37',
    [TOKENS.primaryButtonText]: '#8B4513',
    [TOKENS.primaryButtonHover]: 'rgba(139, 69, 19, 0.25)',

    // Secondary Button
    [TOKENS.secondaryButtonBg]: 'rgba(139, 69, 19, 0.15)',
    [TOKENS.secondaryButtonBorder]: '#8B4513',
    [TOKENS.secondaryButtonText]: '#F5E6D3',
    [TOKENS.secondaryButtonHover]: 'rgba(139, 69, 19, 0.25)',

    // Destructive Button
    [TOKENS.destructiveButton]: '#dc3545',
    [TOKENS.destructiveButtonText]: '#F5E6D3',

    // Cancel Button
    [TOKENS.cancelButton]: 'rgba(113, 126, 137, 1)',
    [TOKENS.cancelButtonText]: '#0f1b27ff',

    // Solid / Outlined Buttons
    [TOKENS.solidOutButton]: '#D4AF37', // Accent color
    [TOKENS.solidOutButtonText]: '#2f353d',

    // Ghost Button
    [TOKENS.ghostButtonText]: '#383945ff',

    /* typography */
    [TOKENS.fontFamilyTitle]: 'GrenzeGotisch',
    [TOKENS.fontFamily]: 'GrenzeGotisch',
    [TOKENS.fontFamilyPara]: 'HelveticaNeue',
  },

  /* ───────────────────────────────
     ☀️ LIGHT MODE
  ─────────────────────────────── */
  light: {
    [TOKENS.primary]: '#8B4513',
    /* backgrounds */
    [TOKENS.background]: '#F5E6D3',          // Light cream background
    [TOKENS.surface]: '#e5d7c0',             // Panels, modals
    [TOKENS.elevated]: '#dcc7a7',            // Elevated / header

    /* text */
    [TOKENS.textPrimary]: '#2f353d',         // Main readable text
    [TOKENS.textSecondary]: '#654321',       // Secondary / accent text
    [TOKENS.textInverse]: '#F5E6D3',         // Text on dark surfaces

    /* borders */
    [TOKENS.border]: '#8B4513',              // Primary border tone
    [TOKENS.borderSubtle]: '#c9b59c',        // Soft dividers

    /* accent / brand */
    [TOKENS.accent]: '#D4AF37',              // Gold accent
    [TOKENS.accentHover]: '#C2A039',         // Hover state
    [TOKENS.accentText]: '#2f353d',          // Text on gold surfaces

    /* feedback */
    [TOKENS.success]: '#4CAF50',             // Success / positive
    [TOKENS.warning]: '#E9B949',             // Warning / attention
    [TOKENS.danger]: '#dc3545',              // Error / destructive

    /* overlays & transparency */
    [TOKENS.overlayLight]: 'rgba(255, 255, 255, 0.05)',
    [TOKENS.overlayDark]: 'rgba(0, 0, 0, 0.25)',

    [TOKENS.shadow]: 'rgba(0, 0, 0, 0.18)',    // Standard shadow color

    /* buttons */
    [TOKENS.primaryButtonBg]: '#2f353d',
    [TOKENS.primaryButtonBorder]: '#D4AF37',
    [TOKENS.primaryButtonText]: '#F5E6D3',
    [TOKENS.primaryButtonHover]: 'rgba(47, 53, 61, 0.25)',

    [TOKENS.secondaryButtonBg]: 'rgba(47, 53, 61, 0.15)',
    [TOKENS.secondaryButtonBorder]: '#2f353d',
    [TOKENS.secondaryButtonText]: '#2f353d',
    [TOKENS.secondaryButtonHover]: 'rgba(47, 53, 61, 0.25)',

    [TOKENS.destructiveButton]: '#dc3545',
    [TOKENS.destructiveButtonText]: '#F5E6D3',

    [TOKENS.cancelButton]: 'rgba(113, 126, 137, 1)',
    [TOKENS.cancelButtonText]: '#0f1b27ff',

    [TOKENS.solidOutButton]: '#D4AF37',
    [TOKENS.solidOutButtonText]: '#2f353d',

    [TOKENS.ghostButtonText]: '#383945ff',

    /* typography */
    [TOKENS.fontFamilyTitle]: 'GrenzeGotisch',
    [TOKENS.fontFamily]: 'GrenzeGotisch',
    [TOKENS.fontFamilyPara]: 'HelveticaNeue',
  },
} as const

