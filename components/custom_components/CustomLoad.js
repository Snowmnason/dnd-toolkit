import React, { useState } from 'react';
import { ActivityIndicator, Image } from 'react-native';
import { CoreColors } from '../../constants/theme';

export default function CustomLoad({
    size = 'large',
    resizeMode = 'contain',
    color = CoreColors.primary, // Fallback color for ActivityIndicator
  ...props
}) {
  const [imageError, setImageError] = useState(false);

  // Define size mappings
  const getSizeValue = () => {
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
  const getActivityIndicatorSize = () => {
    if (sizeValue <= 30) return 'small';
    return 'large';
  };

  // If image failed to load, show ActivityIndicator fallback
  if (imageError) {
    return (
      <ActivityIndicator 
        size={getActivityIndicatorSize()} 
        color={color}
        {...props}
      />
    );
  }

  return (
    <Image
      source={require('../../assets/images/load.gif')}
      style={{ 
        width: sizeValue, 
        height: sizeValue 
      }}
      resizeMode={resizeMode}
      onError={() => setImageError(true)}
      onLoadStart={() => setImageError(false)}
      {...props}
    />
  );
}