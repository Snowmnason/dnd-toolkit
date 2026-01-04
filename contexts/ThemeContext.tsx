/**
 * Theme Context - React context for theme management
 */

import { ThemeFamilyName, classicTheme } from '@/theme';
import { createContext, useContext } from 'react';

// Type for theme context
export interface ThemeContextType {
  theme: any;
  themeName: ThemeFamilyName;
  setTheme: (name: ThemeFamilyName) => void;
  isDark: boolean;
}

// Create context with default values
export const ThemeContext = createContext<ThemeContextType>({
  theme: classicTheme,
  themeName: 'classic',
  setTheme: () => {},
  isDark: true,
});

// Hook to use theme context
export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  
  return context;
}

// Export for convenience
export default ThemeContext;
