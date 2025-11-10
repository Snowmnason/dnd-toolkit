import { $, useScale } from "@/theme";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo } from "react";
import { Platform, Pressable, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Body } from "./AppText";

interface RadioButtonProps {
  checked?: boolean;
  onChange?: (value: boolean) => void;
  label?: string;
  disabled?: boolean;
  color?: string; // accent override
  size?: number; // circle diameter
}

/**
 * 🔘 RadioButton
 * Animated, theme-aware radio circle with inner accent dot.
 */
export function RadioButton({
  checked = false,
  onChange,
  label,
  disabled = false,
  color,
  size = 24,
}: RadioButtonProps) {
  const S = useScale();
  
  // Apply scaling to size
  const scaledSize = size * S.scale;
  
  // Use provided color or fall back to accent - with theme dependency
  const buttonColor = useMemo(() => color || $("accent"), [color]);
  const surfaceBg = useMemo(() => $("surface"), []);
  const borderColor = useMemo(() => $("borderSubtle" as any), []);
  //const textColor = useMemo(() => $("textPrimary"), []);

  // Reanimated shared values
  const innerScale = useSharedValue(checked ? 1 : 0);

  useEffect(() => {
    innerScale.value = withTiming(checked ? 1 : 0, { duration: 180 });
  }, [checked, innerScale]);

  const innerAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: innerScale.value }],
  }));

  const handlePress = () => {
    if (disabled) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onChange?.(!checked);
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      style={{
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: S.space.xs }}>
        <View
          style={{
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: surfaceBg,
            borderWidth: 2,
            borderColor: checked ? buttonColor : borderColor,
            width: scaledSize,
            height: scaledSize,
            borderRadius: scaledSize / 2,
          }}
        >
          <Animated.View
            style={[
              {
                width: scaledSize / 2.4,
                height: scaledSize / 2.4,
                borderRadius: scaledSize / 4.8,
                backgroundColor: buttonColor,
              },
              innerAnimStyle,
            ]}
          />
        </View>

        {label && (
          <Body
            style={{
              fontSize: scaledSize * 0.68,
            }}
          >
            {label}
          </Body>
        )}
      </View>
    </Pressable>
  );
}
