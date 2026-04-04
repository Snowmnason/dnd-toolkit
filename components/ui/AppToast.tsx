import type { ToastType } from "@/contexts/app-toast-context";
import { useScale, UseTheme } from "@/theme";
import { useWindowDimensions, View } from "react-native";
import { Body, Paragraph } from "./AppText";
import { ViewCust } from "./base/ViewCust";
import { ComponentView } from "./Resuables/ComponentViews";

export interface AppToastProps {
  title: string;
  message: string;
  type?: ToastType;
}

/** Map toast type → theme color key */
function useToneColor(type: ToastType) {
  const { theme } = UseTheme();
  switch (type) {
    case "success": return theme.success;
    case "error":   return theme.danger;
    case "warning": return theme.warning;
    default:        return theme.info;
  }
}

/**
 * 🪶 AppToast — Pure Visual
 * Title (gradient fade) + message box.
 * Positioning, animation, and queue are handled by AppToastLayer.
 */
export function AppToast({ title, message, type = "info" }: AppToastProps) {
  const { theme } = UseTheme();
  const S = useScale();
  const { width: screenWidth } = useWindowDimensions();
  const toneColor = useToneColor(type);

  const borderTone =
    type === "success" ? "success"
    : type === "error" ? "danger"
    : type === "warning" ? "warning"
    : "info";

  return (
    <View style={{ maxWidth: screenWidth * 0.25 }}>
    <ComponentView
      borderTone={borderTone}
      shadow="softer"
      gradient
      gradientIntensity={35}
      gradientTransitionPoint={65}
      gradientDirection={-35}
      style={{ padding: 0, alignItems: "flex-start" }}
    >
      {/* Title — tone color fading to transparent */}
      <ViewCust
        gradient
        gradientColor={toneColor}
        gradientColor2="transparent"
        gradientDirection={0}
        gradientTransitionPoint={80}
        style={{
          borderWidth: 0,
          paddingVertical: S.space.xxs,
          paddingHorizontal: S.radius.md,
          borderRadius: S.radius.md,
          marginLeft: S.space.sm,
          marginTop: -S.space.md,
          marginBottom: -S.space.xxs,
        }}
      >
        <Body fontSize="$body1" style={{ color: theme.background }}>
          {title}
        </Body>
      </ViewCust>

        {/* Message section - ViewCust for generic background color, indented */}
        <ViewCust
          gradientColor={theme.background}
          gradient
          gradientIntensity={35}
          gradientTransitionPoint={65}
          gradientDirection={-35}
          style={{ borderWidth: 0, padding: S.space.sm, borderRadius: S.radius.md, margin: S.space.xs }}
        >
          <Paragraph fontSize="$subtitle">{message}</Paragraph>
        </ViewCust>
      </ComponentView>
    </View>
  );
}
