import React, { useState } from 'react';
import { ActivityIndicator, ActivityIndicatorProps, Image, ImageProps } from 'react-native';
import { CoreColors } from '../../constants/theme';

interface CustomLoadProps extends Omit<ImageProps, 'source' | 'style'> {
  size?: 'small' | 'medium' | 'large' | 'xlarge' | number;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
  color?: string;
  style?: ImageProps['style'];
}

export default function CustomLoad({
  size = 'large',
  resizeMode = 'contain',
  color = CoreColors.primary,
  style,
  ...props
}: CustomLoadProps) {
  const [imageError, setImageError] = useState(false);

  // Define size mappings
  const getSizeValue = (): number => {
    switch (size) {
      case 'small':
        return 30;
      case 'medium':
        return 50;
      case 'large':
        return 100;
      case 'xlarge':
        return 150;
      default:
        // If it's a number, use it directly
        return typeof size === 'number' ? size : 60;
    }
  };

  const sizeValue = getSizeValue();

  // Convert size to ActivityIndicator size
  const getActivityIndicatorSize = (): ActivityIndicatorProps['size'] => {
    if (sizeValue <= 30) return 'small';
    return 'large';
  };

  // If image failed to load, show ActivityIndicator fallback
  if (imageError) {
    return (
      <ActivityIndicator 
        size={getActivityIndicatorSize()} 
        color={color}
        style={style}
        {...(props as ActivityIndicatorProps)}
      />
    );
  }

  return (
    <Image
      source={require('../../assets/images/load.gif')}
      style={[
        { 
          width: sizeValue, 
          height: sizeValue 
        },
        style
      ]}
      resizeMode={resizeMode}
      onError={() => setImageError(true)}
      onLoadStart={() => setImageError(false)}
      {...props}
    />
  );
}