import { TOKENS, ThemeTokens } from "@/theme/tokens";

export type ClassicTheme = {
  dark: ThemeTokens;
  light: ThemeTokens;
};

export const classicTheme: ClassicTheme = {
  dark: {
    [TOKENS.primary]: "#8b4513ff", // gold brand

    // Backgrounds
    [TOKENS.background]: "#2f353d",
    [TOKENS.surface]: "#161B22",
    [TOKENS.bgInverse]: "#F5E6D3",

    // Text
    [TOKENS.textPrimary]: "#F5E6D3",
    [TOKENS.textSecondary]: "#8B7355",
    [TOKENS.textInverse]: "#2f353d",

    // Borders
    [TOKENS.border]: "#654321",
    [TOKENS.borderSubtle]: "#3b3b3b",

    // Accent
    [TOKENS.accent]: "#D4AF37", // gold

    // Feedback
    [TOKENS.success]: "#82cc7e",
    [TOKENS.warning]: "#E9B949",
    [TOKENS.danger]: "#dc3545",
    [TOKENS.info]: "#339af0",

    // Effects
    [TOKENS.shadow]: "rgba(66, 66, 66, 0.25)",

    // Buttons — primary
    [TOKENS.primaryButtonText]: "#8B4513",

    // Buttons — destructive/cancel/outlined/ghost
    [TOKENS.destructiveButton]: "#dc3545",
    [TOKENS.destructiveButtonText]: "#F5E6D3",
    [TOKENS.cancelButton]: "rgba(113,126,137,1)",
    [TOKENS.cancelButtonText]: "#0f1b27ff",

    // Typography
    [TOKENS.fontFamilyTitle]: "GrenzeGotisch",
    [TOKENS.fontFamily]: "GrenzeGotisch",
    [TOKENS.fontFamilyPara]: "HelveticaNeue",
  },

  light: {
    [TOKENS.primary]: "#8b4513ff", // deep brown brand

    // Backgrounds
    [TOKENS.background]: "#F5E6D3",
    [TOKENS.surface]: "#e5d7c0",
    [TOKENS.bgInverse]: "#2f353d",

    // Text
    [TOKENS.textPrimary]: "#2f353d",
    [TOKENS.textSecondary]: "#654321",
    [TOKENS.textInverse]: "#F5E6D3",

    // Borders
    [TOKENS.border]: "#8B4513",
    [TOKENS.borderSubtle]: "#c9b59c",

    // Accent
    [TOKENS.accent]: "#D4AF37",

    // Feedback
    [TOKENS.success]: "#429a45ff",
    [TOKENS.warning]: "#c89f40ff",
    [TOKENS.danger]: "#c4303fff",
    [TOKENS.info]: "#2c84cdff",

    // Effects
    [TOKENS.shadow]: "rgba(0,0,0,0.18)",

    // Buttons — primary
    [TOKENS.primaryButtonText]: "#F5E6D3",

    // Buttons — destructive/cancel/outlined/ghost
    [TOKENS.destructiveButton]: "#dc3545",
    [TOKENS.destructiveButtonText]: "#F5E6D3",
    [TOKENS.cancelButton]: "rgba(113,126,137,1)",
    [TOKENS.cancelButtonText]: "#0f1b27ff",

    // Typography
    [TOKENS.fontFamilyTitle]: "GrenzeGotisch",
    [TOKENS.fontFamily]: "GrenzeGotisch",
    [TOKENS.fontFamilyPara]: "HelveticaNeue",
  },
};