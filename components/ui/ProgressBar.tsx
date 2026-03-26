import { useScale } from '@/providers/ScaleProvider';
import { UseTheme } from '@/theme';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import { Caption } from './AppText';

export interface ProgressBarProps {
  /** Optional label displayed above the bar */
  label?: string;
  /** Smooth animate between values (default: true) */
  animated?: boolean;
  /** Height in theme-relative units (default: uses S.space.sm) */
  height?: number;
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
      label,
      animated = true,
      height,
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
