import { ReactNode } from "react";
import {
  Platform,
  ScrollView,
  StyleProp,
  View,
  ViewProps,
  ViewStyle,
} from "react-native";
import { GradientView } from "../Resuables/gradients";

/* ───────────────────────────────
   🪶 ViewCust Props
──────────────────────────────── */

export interface ViewCustProps extends ViewProps {
  /** Full: backgroundColor */
  backgroundColor?: string;
  /** Shorthand: flexDirection */

  /** Enable scrolling (default: false) */
  scroll?: boolean;
  /** Show scroll indicator when scrolling (default: false) */
  showScrollIndicator?: boolean;
  /** Content container style for ScrollView */
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Gradient support - enable gradient background (default: false) */
  gradient?: boolean;
  /** Gradient primary color */
  gradientColor?: string;
  /** Gradient secondary color - auto-generated if not provided */
  gradientColor2?: string;
  /** Gradient direction in degrees (0=bottom-to-top, 90=left-to-right, 180=top-to-bottom, 270=right-to-left) */
  gradientDirection?: number;
  /** Position where gradient transitions (0-100, default: 30) */
  gradientTransitionPoint?: number;
  /** Gradient intensity - how much to adjust color2 (default: 30) */
  gradientIntensity?: number;
  /** Gradient opacity (0-1) */
  gradientOpacity?: number;

  /** Opacity (0-1) */
  opacity?: number;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/* ───────────────────────────────────────────────
   🧱 ViewCust — Simple, flexible base component with shorthand props
   
   Examples:
   <ViewCust p="md" bg="#fff" fd="row" jc="center" ai="center">...</ViewCust>
   <ViewCust scroll padding="lg" gap="md">...</ViewCust>
   <ViewCust flex={2} px="md" py="sm" flexDirection="column">...</ViewCust>
──────────────────────────────────────────────── */
export function ViewCust({
  backgroundColor,
  scroll = false,
  showScrollIndicator = false,
  contentContainerStyle,
  gradient = false,
  gradientColor,
  gradientColor2,
  gradientDirection = 180,
  gradientTransitionPoint = 50,
  gradientIntensity = 30,
  gradientOpacity,
  opacity,
  style,
  children,
  ...rest
}: ViewCustProps) {
  // Gradient wrapper - OUTSIDE ScrollView so it's static and doesn't scroll
  // This allows the gradient background to remain fixed while content scrolls
  if (gradient && gradientColor) {
    // Split style into wrapper styles (border, radius, shadow, dimensions) and inner styles (padding, margin, flex layout)
    const flatStyle = Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : (style || {});
    
    const wrapperStyle: any = {};
    const innerStyle: any = {};
    
    // Distribute styles appropriately
    Object.entries(flatStyle).forEach(([key, value]) => {
      // Wrapper gets: border, radius, shadows, dimensions, opacity, MARGIN (external spacing)
      if (
        key.startsWith('border') ||
        key.includes('Radius') ||
        key.startsWith('shadow') ||
        key === 'boxShadow' ||
        key === 'width' ||
        key === 'height' ||
        key === 'opacity' ||
        key === 'elevation' ||
        key.startsWith('margin')  // Margin controls spacing BETWEEN components
      ) {
        wrapperStyle[key] = value;
      }
      // Inner gets: padding (internal spacing), flex layout, positioning
      else if (
        key.startsWith('padding') ||
        key.startsWith('flex') ||
        key.startsWith('align') ||
        key.startsWith('justify') ||
        key === 'gap'
      ) {
        innerStyle[key] = value;
      }
      // Background goes nowhere (gradient provides it)
      else if (key === 'backgroundColor') {
        // skip
      }
      // Everything else to inner
      else {
        innerStyle[key] = value;
      }
    });
    
    return (
      <GradientView
        enabled={true}
        color={gradientColor}
        color2={gradientColor2}
        direction={gradientDirection}
        transitionPoint={gradientTransitionPoint}
        intensity={gradientIntensity}
        opacity={gradientOpacity}
        style={wrapperStyle}
      >
        {scroll ? (
          <ScrollView
            style={{ flex: 1, ...innerStyle }}
            contentContainerStyle={contentContainerStyle}
            showsVerticalScrollIndicator={showScrollIndicator}
            {...rest}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={{ backgroundColor: 'transparent', border: 'none', ...innerStyle }} {...rest}>
            {children}
          </View>
        )}
      </GradientView>
    );
  }

  // If scroll is enabled (without gradient), wrap in ScrollView
  if (scroll) {
    return (
      <ScrollView
        style={[
          style,
          // On web, allow horizontal overflow so shadows aren't clipped
          Platform.OS === 'web' ? { overflowX: 'visible' as any } : undefined
        ]}
        contentContainerStyle={contentContainerStyle}
        showsVerticalScrollIndicator={showScrollIndicator}
        {...rest}
      >
        {children}
      </ScrollView>
    );
  }

  // Otherwise, just a View (without gradient, without scroll)
  return (
    <View style={style} {...rest}>
      {children}
    </View>
  );
}
