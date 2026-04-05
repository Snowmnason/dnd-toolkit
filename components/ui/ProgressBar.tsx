import { useScale } from '@/providers/ScaleProvider';
import { UseTheme } from '@/theme';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Animated, Platform, View } from 'react-native';
import { Caption } from './AppText';

export interface ProgressBarProps {
  /** Display variant: 'linear' (default bar) or 'circular' (ring) */
  variant?: 'linear' | 'circular';
  /** Optional label displayed above the indicator */
  label?: string;
  /** Smooth animate between values (default: true) */
  animated?: boolean;
  /** Height in theme-relative units (default: uses S.space.sm) — linear only */
  height?: number;
  /** Diameter of the circular ring (default: 64) — circular only */
  size?: number;
  /** Highlight/fill color (default: theme.accent) */
  highlightColor?: string;
  /** Track background color (default: theme.border) */
  trackColor?: string;
  /** Initial progress value 0-100 (default: 0) */
  initialProgress?: number;
}

export interface ProgressBarRef {
  /** Get current progress value */
  getProgress: () => number;
  /** Set progress to exact value (0-100, will be clamped) */
  setProgress: (value: number) => void;
  /** Increment progress by amount */
  increment: (amount: number) => void;
  /** Decrement progress by amount */
  decrement: (amount: number) => void;
  /** Reset progress to 0 */
  reset: () => void;
}

/**
 * ProgressBar — displays real progress (0-100%) with optional label.
 * 
 * Holds its own internal state and exposes methods via ref for controlling progress.
 * Uses scale provider for responsive sizing and supports smooth animation.
 *
 * @example
 * const progressRef = useRef<ProgressBarRef>(null);
 * <ProgressBar ref={progressRef} label="Loading..." animated />
 * <Button onPress={() => progressRef.current?.increment(10)} />
 */
export const ProgressBar = forwardRef<ProgressBarRef, ProgressBarProps>(
  (
    {
      variant = 'linear',
      label,
      animated = true,
      height,
      size,
      highlightColor,
      trackColor,
      initialProgress = 0,
    }: ProgressBarProps,
    ref,
  ) => {
    const { theme } = UseTheme();
    const S = useScale();

    // Internal state for progress value
    const [progress, setProgress] = useState(Math.max(0, Math.min(100, initialProgress)));
    
    // For web circular animation: track animated degrees for smooth conic-gradient
    const [animatedDegrees, setAnimatedDegrees] = useState((initialProgress / 100) * 360);
    const listenerRef = useRef<string | null>(null);

    // Default height to S.space.sm (responsive)
    const barHeight = height ?? S.space.sm;

    // Theme-based colors
    const fillColor = highlightColor ?? theme.accent;
    const bgColor = trackColor ?? theme.borderSubtle;

    // Animated value for smooth progress transitions
    const animatedValue = useRef(new Animated.Value(progress)).current;

    useEffect(() => {
      if (animated) {
        Animated.spring(animatedValue, {
          toValue: progress,
          tension: 40,
          friction: 5,
          useNativeDriver: false,
        }).start();
      } else {
        animatedValue.setValue(progress);
      }

      // Also set up listener for web circular animation
      if (listenerRef.current) {
        animatedValue.removeListener(listenerRef.current);
      }
      
      listenerRef.current = animatedValue.addListener(({ value }) => {
        setAnimatedDegrees((value / 100) * 360);
      });

      return () => {
        if (listenerRef.current) {
          animatedValue.removeListener(listenerRef.current);
        }
      };
    }, [progress, animated, animatedValue]);

    // Expose control methods via ref
    useImperativeHandle(ref, () => ({
      getProgress: () => progress,
      setProgress: (value: number) => {
        const clamped = Math.max(0, Math.min(100, value));
        setProgress(clamped);
      },
      increment: (amount: number) => {
        setProgress((prev) => Math.min(100, prev + amount));
      },
      decrement: (amount: number) => {
        setProgress((prev) => Math.max(0, prev - amount));
      },
      reset: () => {
        setProgress(0);
      },
    }), [progress]);

    // Interpolate width from progress percentage
    const fillWidth = animatedValue.interpolate({
      inputRange: [0, 100],
      outputRange: ['0%', '100%'],
    });

    // ─── Circular variant ───
    if (variant === 'circular') {
      const circularSize = size ?? 64;
      const strokeWidth = Math.max(circularSize * 0.1, 3);
      const innerRadius = (circularSize / 2) - strokeWidth;

      const webRingStyle = Platform.OS === 'web' ? {
        background: `conic-gradient(${fillColor} ${animatedDegrees}deg, ${bgColor} ${animatedDegrees}deg)`,
        mask: `radial-gradient(farthest-side, transparent ${innerRadius}px, #000 ${innerRadius}px)`,
        WebkitMask: `radial-gradient(farthest-side, transparent ${innerRadius}px, #000 ${innerRadius}px)`,
      } : {};

      return (
        <View style={{ alignItems: 'center', gap: label ? S.space.xs : 0 }}>
          {label && (
            <Caption textType="secondary" opacity={0.8}>
              {label}
            </Caption>
          )}
          <View
            style={[
              {
                width: circularSize,
                height: circularSize,
                borderRadius: circularSize / 2,
              },
              Platform.OS !== 'web' && {
                borderWidth: strokeWidth,
                borderColor: bgColor,
              },
              webRingStyle as any,
            ]}
          />
        </View>
      );
    }

    // ─── Linear variant (default) ───
  return (
    <View style={{ gap: label ? S.space.xs : 0 }}>
      {label && (
        <Caption
          textType="secondary"
          opacity={0.8}
        >
          {label}
        </Caption>
      )}
      <View
        style={{
          width: '100%',
          height: barHeight,
          backgroundColor: bgColor,
          borderRadius: barHeight / 2,
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={{
            height: '100%',
            width: fillWidth,
            backgroundColor: fillColor,
            borderRadius: barHeight / 2,
          }}
        />
      </View>
    </View>
    );
  },
);

ProgressBar.displayName = 'ProgressBar';
