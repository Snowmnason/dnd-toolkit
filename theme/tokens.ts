// ─────────────────────────────────────────────
// 🎨 Global Design Tokens
// These define the *keys* every theme family must provide.
// Each theme (Classic, Cyberpunk, etc.) supplies values
// for all these tokens in both light and dark mode.
// ─────────────────────────────────────────────

/**
 * 🔑 Design token names shared by all themes.
 * These represent the "vocabulary" of your UI.
 */
export const TOKENS = {
    primary: 'primary',            // Primary brand color
    /* ───────────────────────────────
        🎨 Background Layers
    ─────────────────────────────── */
    background: 'background',        // Main background
    surface: 'surface',              // Cards, modals, containers
    elevated: 'elevated',            // Headers, navbars, elevated surfaces

    /* ───────────────────────────────
        ✍️ Text Colors
    ─────────────────────────────── */
    textPrimary: 'textPrimary',      // Main readable text
    textSecondary: 'textSecondary',  // Muted or secondary text
    textInverse: 'textInverse',      // Text on light or accent backgrounds

    /* ───────────────────────────────
        🔲 Borders
    ─────────────────────────────── */
    border: 'border',                // Default border
    borderSubtle: 'borderSubtle',    // Faint or inner dividers

    /* ───────────────────────────────
        🌟 Accents / Highlights
    ─────────────────────────────── */
    accent: 'accent',                // Brand highlight color
    accentHover: 'accentHover',      // Accent hover / focus
    accentText: 'accentText',        // Text on accent background

    /* ───────────────────────────────
        ⚠️ Feedback & System States
    ─────────────────────────────── */
    success: 'success',              // Positive / confirmed
    warning: 'warning',              // Attention / caution
    danger: 'danger',                // Error / destructive

    /* ───────────────────────────────
        🌫️ Overlays
    ─────────────────────────────── */
    overlayLight: 'overlayLight',    // Light overlay on dark surfaces
    overlayDark: 'overlayDark',      // Dark overlay on light surfaces

    shadow: 'shadow',                // Standard shadow color

    /* ───────────────────────────────
        🔘 Buttons
    ─────────────────────────────── */
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

    /* ───────────────────────────────
        🔤 Typography
    ─────────────────────────────── */
    fontFamilyTitle: 'fontFamilyTitle', // Used for headings or titles
    fontFamily: 'fontFamily',           // Primary body text
    fontFamilyPara: 'fontFamilyPara',   // Long-form or paragraph text
    } as const

    /**
     * TokenName is the union of all token keys.
     * (e.g. "background" | "surface" | "accent" | ...)
     */
    export type TokenName = keyof typeof TOKENS

    /**
     * Defines the expected structure of a theme mode (light or dark).
     * Each theme mode must supply a string value for every token.
     */
    export type ThemeTokens = Record<TokenName, string>

    /**
     * Utility function type — returns a token name’s value
     * from the currently active theme.
     * Example: $('background') → "#2f353d"
     */
    export type ThemeResolver = (token: TokenName) => string
