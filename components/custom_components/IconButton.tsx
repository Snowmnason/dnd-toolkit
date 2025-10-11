import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import React from 'react';
import { TextStyle, TouchableOpacity, View, ViewStyle } from 'react-native';

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
    <TouchableOpacity style={style} onPress={onPress}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {/* Icon */}
        <ThemedText style={textStyle}>{icon}</ThemedText>

        {/* Label (if present) */}
        {label && (
          <ThemedText style={[{ marginLeft: Spacing.xs }, textStyle]}>
            {label}
          </ThemedText>
        )}
      </View>
    </TouchableOpacity>
  );
}