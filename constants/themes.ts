/**
 * Theme Definitions - Predefined themes for the application
 */

import { Theme, ThemeName } from './theme.types';

// Classic D&D Theme (current default)
export const classicTheme: Theme = {
  name: 'classic',
  displayName: 'Classic D&D',
  isDark: true,
  colors: {
    primary: '#8B4513',
    secondary: '#D4AF37',
    backgroundDark: '#2f353d',
    backgroundLight: '#F5E6D3',
    backgroundAccent: '#3a4149',
    
    textPrimary: '#F5E6D3',
    textSecondary: '#D4AF37',
    textOnLight: '#2f353d',
    textOnDark: '#F5E6D3',
    
    success: '#A3D4A0',
    warning: '#ffa500',
    error: '#F5A5A5',
    info: '#87CEEB',
    
    primaryTransparent: 'rgba(139, 69, 19, 0.3)',
    secondaryTransparent: 'rgba(212, 175, 55, 0.3)',
  },
};

// Dark Theme
export const darkTheme: Theme = {
  name: 'dark',
  displayName: 'Midnight',
  isDark: true,
  colors: {
    primary: '#BB86FC',
    secondary: '#03DAC6',
    backgroundDark: '#121212',
    backgroundLight: '#1E1E1E',
    backgroundAccent: '#2C2C2C',
    
    textPrimary: '#E1E1E1',
    textSecondary: '#BB86FC',
    textOnLight: '#121212',
    textOnDark: '#E1E1E1',
    
    success: '#4CAF50',
    warning: '#FFC107',
    error: '#F44336',
    info: '#2196F3',
    
    primaryTransparent: 'rgba(187, 134, 252, 0.3)',
    secondaryTransparent: 'rgba(3, 218, 198, 0.3)',
  },
};

// Light Theme
export const lightTheme: Theme = {
  name: 'light',
  displayName: 'Daylight',
  isDark: false,
  colors: {
    primary: '#6200EA',
    secondary: '#018786',
    backgroundDark: '#F5F5F5',
    backgroundLight: '#FFFFFF',
    backgroundAccent: '#E0E0E0',
    
    textPrimary: '#212121',
    textSecondary: '#6200EA',
    textOnLight: '#212121',
    textOnDark: '#FFFFFF',
    
    success: '#4CAF50',
    warning: '#FFC107',
    error: '#F44336',
    info: '#2196F3',
    
    primaryTransparent: 'rgba(98, 0, 234, 0.1)',
    secondaryTransparent: 'rgba(1, 135, 134, 0.1)',
  },
};

// Forest Theme
export const forestTheme: Theme = {
  name: 'forest',
  displayName: 'Enchanted Forest',
  isDark: true,
  colors: {
    primary: '#2E7D32',
    secondary: '#8BC34A',
    backgroundDark: '#1B5E20',
    backgroundLight: '#E8F5E9',
    backgroundAccent: '#2E7D32',
    
    textPrimary: '#E8F5E9',
    textSecondary: '#8BC34A',
    textOnLight: '#1B5E20',
    textOnDark: '#E8F5E9',
    
    success: '#66BB6A',
    warning: '#FFA726',
    error: '#EF5350',
    info: '#42A5F5',
    
    primaryTransparent: 'rgba(46, 125, 50, 0.3)',
    secondaryTransparent: 'rgba(139, 195, 74, 0.3)',
  },
};

// Ocean Theme
export const oceanTheme: Theme = {
  name: 'ocean',
  displayName: 'Deep Ocean',
  isDark: true,
  colors: {
    primary: '#0277BD',
    secondary: '#00ACC1',
    backgroundDark: '#01579B',
    backgroundLight: '#E1F5FE',
    backgroundAccent: '#0288D1',
    
    textPrimary: '#E1F5FE',
    textSecondary: '#00ACC1',
    textOnLight: '#01579B',
    textOnDark: '#E1F5FE',
    
    success: '#26A69A',
    warning: '#FFB74D',
    error: '#EF5350',
    info: '#42A5F5',
    
    primaryTransparent: 'rgba(2, 119, 189, 0.3)',
    secondaryTransparent: 'rgba(0, 172, 193, 0.3)',
  },
};

// Theme registry
export const themes: Record<ThemeName, Theme> = {
  classic: classicTheme,
  dark: darkTheme,
  light: lightTheme,
  forest: forestTheme,
  ocean: oceanTheme,
};

// Get theme by name
export function getTheme(themeName: ThemeName): Theme {
  return themes[themeName] || classicTheme;
}

// Get all available themes
export function getAllThemes(): Theme[] {
  return Object.values(themes);
}
