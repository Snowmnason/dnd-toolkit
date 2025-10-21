/**
 * Theme Context - React context for theme management
 */

import { classicTheme } from '@/constants/themes';
import { ThemeContextType } from '@/theme/theme.types';
import { createContext, useContext } from 'react';

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
