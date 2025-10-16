import { Spacing } from '@/constants/theme';
import React from 'react';
import { TextStyle, View, ViewStyle } from 'react-native';
import { Button, Text } from 'tamagui';

interface IconButtonProps {
  icon: string;
  label?: string;
  onPress: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export default function IconButton({ 
  icon, 
  label, 
  onPress, 
  style, 
  textStyle 
}: IconButtonProps) {
  return (
    <Button unstyled style={style} onPress={onPress}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
  {/* Icon */}
  <Text style={textStyle as any}>{icon}</Text>

        {/* Label (if present) */}
        {label && (
          <Text style={[{ marginLeft: Spacing.xs }, textStyle] as any}>
            {label}
          </Text>
        )}
      </View>
    </Button>
  );
}