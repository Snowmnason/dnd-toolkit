/**
 * D&D Toolkit Theme System
 * Centralized colors, spacing, and design tokens for consistent styling
 */

import { Platform } from 'react-native';

// Core D&D Theme Colors
export const CoreColors = {
  // Primary colors - Browns for D&D fantasy theme
  primary: '#8B4513', // Saddle brown
  primaryLight: '#CD853F', // Peru
  primaryDark: '#654321', // Dark brown
  
  // Secondary colors - Gold for accents
  secondary: '#D4AF37', // Gold
  secondaryLight: '#FFD700', // Bright gold
  secondaryDark: '#B8860B', // Dark goldenrod
  
  // Background colors
  backgroundDark: '#2f353d', // Dark slate
  backgroundLight: '#F5E6D3', // Parchment/cream color
  backgroundAccent: '#a77e44', // Medium brown for parchment texture
  
  // Border colors
  borderPrimary: '#ddd', // Light gray for subtle borders
  borderSecondary: '#B8860B', // Dark goldenrod for prominent borders
  
  // Text colors
  textPrimary: '#F5E6D3', // Light cream for primary text
  textSecondary: '#a77e44', // Medium brown for secondary text
  textOnLight: '#2f353d', // Dark slate for text on light backgrounds
  
  // Utility colors with transparency
  primaryTransparent: 'rgba(139, 69, 19, 0.2)',
  secondaryTransparent: 'rgba(212, 175, 55, 0.3)',
};

// Spacing system (8pt grid)
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// Border radius system
export const BorderRadius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
};

// Shadow system
export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  gold: {
    shadowColor: CoreColors.secondary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
};

// Typography system
export const Typography = {
  // Text shadows for better readability
  textShadow: {
    textShadowColor: CoreColors.secondary,
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  textShadowDark: {
    textShadowColor: '#000',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
};

// Component styles for consistency
export const ComponentStyles = {
  button: {
    primary: {
      backgroundColor: CoreColors.primary,
      borderRadius: BorderRadius.md,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      ...Shadows.md,
      borderWidth: 2,
      borderColor: CoreColors.secondary,
    },
    secondary: {
      backgroundColor: CoreColors.backgroundLight,
      borderRadius: BorderRadius.md,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      borderWidth: 2,
      borderColor: CoreColors.primary,
    }
  },
  card: {
    container: {
      backgroundColor: CoreColors.primaryTransparent,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      borderRadius: BorderRadius.lg,
      marginBottom: Spacing.md,
      borderWidth: 2,
      borderColor: CoreColors.secondary,
      ...Shadows.lg,
    },
    base: {
      padding: Spacing.sm,
      marginBottom: Spacing.xs,
      borderRadius: BorderRadius.sm,
      backgroundColor: CoreColors.backgroundLight,
      alignItems: 'center' as const,
      borderWidth: 2,
      borderColor: CoreColors.secondary,
      ...Shadows.sm,
    },
    selected: {
      backgroundColor: CoreColors.primaryDark,
      borderWidth: 3,
      borderColor: CoreColors.secondary,
      ...Shadows.md,
    },
    default: {
      shadowColor: CoreColors.backgroundDark,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 4,
      backgroundColor: CoreColors.backgroundLight,
      borderRadius: BorderRadius.sm,
      padding: Spacing.sm,
      borderWidth: 1,
      borderColor: CoreColors.secondary,
    },
    world: {
      backgroundColor: CoreColors.backgroundLight,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
      borderWidth: 2,
      borderColor: CoreColors.secondary,
      ...Shadows.sm,
    }
  },
  topBar: {
    container: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      paddingTop: 50, // Account for status bar
      backgroundColor: CoreColors.backgroundDark,
      borderBottomWidth: 1,
      borderBottomColor: CoreColors.primaryTransparent,
    },
    button: {
      padding: Spacing.xs,
      borderRadius: BorderRadius.sm,
      backgroundColor: CoreColors.primaryTransparent,
      alignItems: 'center' as const,
    }
  }
};

// Legacy Colors object for backward compatibility
export const Colors = {
  light: {
    text: CoreColors.textSecondary,
    background: CoreColors.backgroundAccent,
    tint: CoreColors.backgroundLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: CoreColors.primaryTransparent,
    textColor: CoreColors.primary,
    border: CoreColors.secondary,
  },
  dark: {
    text: CoreColors.textSecondary,
    background: CoreColors.backgroundAccent,
    tint: CoreColors.backgroundLight,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: CoreColors.backgroundLight,
    textColor: CoreColors.primary,
    border: CoreColors.secondary,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  android: {
    regular: 'normal',
    serif: 'serif',
    rounded: 'sans-serif-rounded',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
});
