import React from 'react';
import CustomLoad from '../custom_components/CustomLoad';
import PrimaryButton from '../custom_components/PrimaryButton';

interface AuthButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: object;
  textStyle?: object;
}

export default function AuthButton({
  title,
  onPress,
  disabled = false,
  loading = false,
  style,
  textStyle
}: AuthButtonProps) {
  const isDisabled = disabled || loading;
  
  return (
    <PrimaryButton
      style={{ 
        width: '100%', 
        backgroundColor: isDisabled ? '#6c757d' : '#8B4513',
        paddingVertical: 16, 
        borderRadius: 8,
        opacity: isDisabled ? 0.6 : 1,
        ...style
      }}
      textStyle={{ 
        color: '#F5E6D3', 
        fontSize: 16, 
        fontWeight: '600',
        ...textStyle
      }}
      onPress={onPress}
      disabled={isDisabled}
    >
      {loading ? <CustomLoad /> : title}
    </PrimaryButton>
  );
}