import { CoreColors } from '@/constants/theme';
import React from 'react';
import { ActivityIndicator, TextStyle, TouchableOpacity, ViewStyle } from 'react-native';
import { ThemedText } from '../themed-text';

export interface BaseButtonProps {
  onPress: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  style?: ViewStyle | ViewStyle[];
  textStyle?: TextStyle | TextStyle[];
  loadingColor?: string;
}

/**
 * BaseButton - Foundation button component with automatic disabled state handling
 * 
 * Features:
 * - Automatic opacity and background color for disabled state
 * - Built-in loading state with spinner
 * - Multiple variants (primary, secondary, destructive, ghost)
 * - Size variations (small, medium, large)
 * - Theme-ready architecture
 */
export default function BaseButton({
  onPress,
  children,
  disabled = false,
  loading = false,
  variant = 'primary',
  size = 'medium',
  style,
  textStyle,
  loadingColor,
}: BaseButtonProps) {
  const isDisabled = disabled || loading;

  // Variant styles
  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: isDisabled ? CoreColors.textSecondary : CoreColors.buttonBackgroundLight,
          borderColor: CoreColors.secondary,
          borderWidth: 2,
        };
      case 'secondary':
        return {
          backgroundColor: isDisabled 
            ? 'rgba(139, 69, 19, 0.1)' 
            : 'rgba(139, 69, 19, 0.15)',
          borderColor: '#8B4513',
          borderWidth: 1,
        };
      case 'destructive':
        return {
          backgroundColor: isDisabled ? '#6c757d' : '#dc3545',
          borderColor: isDisabled ? '#6c757d' : '#c82333',
          borderWidth: 1,
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          borderColor: 'transparent',
          borderWidth: 0,
        };
      default:
        return {
          backgroundColor: isDisabled ? CoreColors.textSecondary : CoreColors.backgroundLight,
          borderColor: CoreColors.secondary,
          borderWidth: 2,
        };
    }
  };

  // Size styles
  const getSizeStyle = (): ViewStyle => {
    switch (size) {
      case 'small':
        return {
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 6,
        };
      case 'large':
        return {
          paddingVertical: 16,
          paddingHorizontal: 24,
          borderRadius: 10,
        };
      case 'medium':
      default:
        return {
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderRadius: 8,
        };
    }
  };

  // Text styles
  const getTextStyle = (): TextStyle => {
    const baseColor = variant === 'primary' || variant === 'secondary'
      ? CoreColors.primary
      : variant === 'destructive'
      ? CoreColors.textPrimary
      : CoreColors.textOnLight;

    const fontSize = size === 'small' ? 14 : size === 'large' ? 18 : 16;

    return {
      color: baseColor,
      fontSize,
      fontWeight: '600',
    };
  };

  // Get loading spinner color based on variant
  const getLoadingColor = (): string => {
    if (loadingColor) return loadingColor;
    
    switch (variant) {
      case 'primary':
      case 'secondary':
        return CoreColors.primary;
      case 'destructive':
        return CoreColors.textPrimary;
      default:
        return CoreColors.textOnLight;
    }
  };

  return (
    <TouchableOpacity
      style={[
        {
          alignItems: 'center',
          justifyContent: 'center',
          opacity: isDisabled ? 0.6 : 1,
        },
        getVariantStyle(),
        getSizeStyle(),
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator size="small" color={getLoadingColor()} />
      ) : (
        <ThemedText
          style={[
            getTextStyle(),
            textStyle,
          ]}
        >
          {children}
        </ThemedText>
      )}
    </TouchableOpacity>
  );
}
