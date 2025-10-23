/**
 * Theme Types - Type definitions for theming system
 */

export type ThemeName = 'classic' | 'dark' | 'light' | 'forest' | 'ocean';

export interface ThemeColors {
  // Core colors
  primary: string;
  secondary: string;
  backgroundDark: string;
  backgroundLight: string;
  backgroundAccent: string;
  
  // Text colors
  textPrimary: string;
  textSecondary: string;
  textOnLight: string;
  textOnDark: string;
  
  // UI colors
  success: string;
  warning: string;
  error: string;
  info: string;
  
  // Transparent variants
  primaryTransparent: string;
  secondaryTransparent: string;
}

export interface Theme {
  name: ThemeName;
  displayName: string;
  colors: ThemeColors;
  isDark: boolean;
}

export interface ThemeContextType {
  theme: Theme;
  themeName: ThemeName;
  setTheme: (themeName: ThemeName) => void;
  isDark: boolean;
}
