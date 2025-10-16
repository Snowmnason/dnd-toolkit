/**
 * D&D Toolkit Theme System
 * Centralized colors, spacing, and design tokens for consistent styling
 */

import { Platform } from 'react-native';
//import { CoreColors } from './corecolors';

/**
 * Cross-platform shadow utility
 * Automatically provides the correct shadow properties for React Native vs Web
 */
export const createShadow = (
  color: string = '#000',
  offset: { width: number; height: number } = { width: 0, height: 2 },
  opacity: number = 0.1,
  radius: number = 2,
  elevation: number = 2
) => {
  if (Platform.OS === 'web') {
    // Web uses boxShadow
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '0, 0, 0';
    };
    return {
      boxShadow: `${offset.width}px ${offset.height}px ${radius}px rgba(${hexToRgb(color)}, ${opacity})`,
    };
  } else {
    // React Native uses individual shadow properties
    return {
      shadowColor: color,
      shadowOffset: offset,
      shadowOpacity: opacity,
      shadowRadius: radius,
      elevation: elevation,
    };
  }
};

/**
 * Cross-platform text shadow utility
 * Automatically provides the correct textShadow properties for React Native vs Web
 */
export const createTextShadow = (
  color: string = '#000',
  offset: { width: number; height: number } = { width: 1, height: 1 },
  radius: number = 2
) => {
  if (Platform.OS === 'web') {
    // Web uses CSS textShadow string
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '0, 0, 0';
    };
    return {
      textShadow: `${offset.width}px ${offset.height}px ${radius}px ${color.startsWith('#') ? `rgb(${hexToRgb(color)})` : color}`,
    };
  } else {
    // React Native uses individual textShadow properties
    return {
      textShadowColor: color,
      textShadowOffset: offset,
      textShadowRadius: radius,
    };
  }
};

/**
 * D&D Toolkit Theme System
 * Centralized colors, spacing, and design tokens for consistent styling
 */

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
    ...createShadow('#000', { width: 0, height: 2 }, 0.1, 2, 2),
  },
  md: {
    ...createShadow('#000', { width: 0, height: 4 }, 0.15, 4, 4),
  },
  lg: {
    ...createShadow('#000', { width: 0, height: 6 }, 0.2, 6, 6),
  },
  gold: {
    //...createShadow(CoreColors.secondary, { width: 0, height: 2 }, 0.3, 4, 4),
  },
  buttonShadow: {
    //...createShadow(CoreColors.secondary, { width: 0, height: 2 }, 0.18, 4, 4),
  },
  panelShadow: {
    //...createShadow(CoreColors.primaryDark, { width: 0, height: 4 }, 0.22, 8, 8),
  },
};

// Typography system
export const Typography = {
  // Text shadows for better readability
  textShadow: {
    //...createTextShadow(CoreColors.secondary, { width: 1, height: 1 }, 2),
  },
  textShadowDark: {
    //...createTextShadow('#000', { width: 2, height: 2 }, 4),
  },
  buttonTextShadow: {
    //...createTextShadow(CoreColors.primaryDark, { width: 1, height: 1 }, 2),
  },
};

// Component styles for consistency
export const ComponentStyles = {
  button: {
    primary: {
     // backgroundColor: CoreColors.primary,
      borderRadius: BorderRadius.md,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      ...Shadows.md,
      borderWidth: 2,
      //borderColor: CoreColors.secondary,
    },
    secondary: {
      //backgroundColor: CoreColors.backgroundLight,
      borderRadius: BorderRadius.md,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      borderWidth: 2,
      //borderColor: CoreColors.primary,
    }
  },
  card: {
    container: {
      //backgroundColor: CoreColors.primaryTransparent,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      borderRadius: BorderRadius.lg,
      marginBottom: Spacing.md,
      borderWidth: 2,
      //borderColor: CoreColors.secondary,
      ...Shadows.lg,
    },
    base: {
      padding: Spacing.sm,
      marginBottom: Spacing.xs,
      borderRadius: BorderRadius.sm,
      //backgroundColor: CoreColors.buttonBackgroundLight,
      alignItems: 'center' as const,
      borderWidth: 2,
      //borderColor: CoreColors.secondary,
      ...Shadows.sm,
    },
    selected: {
      //backgroundColor: CoreColors.buttonBackgroundSelected,
      borderWidth: 3,
      //borderColor: CoreColors.secondary,
      ...Shadows.md,
    },
    default: {
      //...createShadow(CoreColors.backgroundDark, { width: 0, height: 2 }, 0.3, 4, 4),
      //backgroundColor: CoreColors.backgroundLight,
      borderRadius: BorderRadius.sm,
      padding: Spacing.sm,
      borderWidth: 1,
      //borderColor: CoreColors.secondary,
    },
    world: {
      //backgroundColor: CoreColors.backgroundLight,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
      borderWidth: 2,
      //borderColor: CoreColors.secondary,
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
      //backgroundColor: CoreColors.TopBarDark,
      borderBottomWidth: 1,
      //borderBottomColor: CoreColors.borderPrimary,
    },
    button: {
      padding: Spacing.xs,
      borderRadius: BorderRadius.sm,
      //backgroundColor: CoreColors.primaryTransparent,
      alignItems: 'center' as const,
    }
  },
  bottomTabBar: {
    container: {
      flexDirection: 'row' as const,
      height: 60,
      //backgroundColor: CoreColors.TopBarDark,
      borderTopWidth: 1,
      //borderTopColor: CoreColors.borderPrimary,
      paddingBottom: 5,
      ...Shadows.panelShadow,
    },
    tab: {
      flex: 1,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      paddingVertical: 5,
    },
    activeTab: {
      //backgroundColor: CoreColors.activeTabBackground,
    },
    icon: {
      fontSize: 24,
      marginBottom: 2,
    },
    activeIcon: {
      // Can add different styling for active icon
    },
    label: {
      fontSize: 10,
      //color: CoreColors.textSecondary,
    },
    activeLabel: {
      //color: CoreColors.secondary,
      fontWeight: 'bold' as const,
    },
  },
  panelView: {
    panel: {
      flex: 1,
      borderWidth: 1,
      //borderColor: CoreColors.primaryDark,
      alignItems: 'center' as const,
      justifyContent: 'flex-start' as const,
      padding: Spacing.md,
      ...Shadows.panelShadow,
    },
    panelTitle: {
      marginBottom: 20,
      textAlign: 'center' as const,
      ...Typography.textShadow,
    },
    featureButton: {
      marginBottom: Spacing.sm,
      width: '90%' as any,
      borderRadius: BorderRadius.md,
      //borderColor: CoreColors.secondary,
      borderWidth: 2,
      ...Shadows.buttonShadow,
    },
    featureText: {
      textAlign: 'center' as const,
    },
  }
};

// Legacy Colors object for backward compatibility
export const Colors = {
  light: {
    //text: CoreColors.textSecondary,
    //background: CoreColors.backgroundAccent,
    //tint: CoreColors.backgroundLight,
    //icon: '#687076',
    tabIconDefault: '#687076',
    //tabIconSelected: CoreColors.primaryTransparent,
    //textColor: CoreColors.primary,
    //border: CoreColors.secondary,
  },
  dark: {
    //text: CoreColors.textSecondary,
    //background: CoreColors.backgroundAccent,
    //tint: CoreColors.backgroundLight,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    //tabIconSelected: CoreColors.backgroundLight,
    //textColor: CoreColors.primary,
    //border: CoreColors.secondary,
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
