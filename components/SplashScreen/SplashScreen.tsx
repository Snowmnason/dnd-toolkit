import { UseTheme } from '@/theme';
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { CustomLoad } from '../ui';
import { Body, SubTitle, Title } from '../ui/AppText';
import { ProgressBar, type ProgressBarRef } from '../ui/ProgressBar';

/**
 * Custom Splash Screen / Loading Overlay
 *
 * Discord-style loading screen with clean layout:
 * - Static title ("D&D Toolkit") + optional subtitle
 * - Centered decorative element (spinner/CustomLoad)
 * - Animated progress bar (uses ProgressBar component)
 * - Subtle message at bottom
 * - VersionDisplay footer
 *
 * Used for:
 * 1. Initial app splash (feature flag controlled)
 * 2. UIBlockerLayer overlay when any system calls setLoading()
 */

interface SplashScreenProps {
  // Top section: phase label / context
  subtitle?: string;

  // Middle section: visual loading indicator
  decorativeElement?: React.ReactNode; // Defaults to CustomLoad

  // Bottom section: progress tracking
  showProgress?: boolean; // Default: true
  progress?: number; // 0-100

  // Footer: subtle status message
  message?: string;
}

export function SplashScreen({
  subtitle,
  decorativeElement,
  showProgress = true,
  progress,
  message,
}: SplashScreenProps = {}) {
  const { theme } = UseTheme();
  const progressRef = useRef<ProgressBarRef>(null);
  const [displayMessage, setDisplayMessage] = useState(message);
  const shakeTranslate = useSharedValue(0);
  const prevMessageRef = useRef(message);

  // Sync progress prop to ProgressBar ref
  useEffect(() => {
    if (progress !== undefined) {
      progressRef.current?.setProgress(progress);
    }
  }, [progress]);

  // Trigger spin animation when message changes
  // Animation rotates and changes text mid-spin for smooth effect
  // Note: shakeTranslate is a reanimated shared value and should not be in dependency array
  useEffect(() => {
    if (message && message !== prevMessageRef.current) {
      prevMessageRef.current = message;
      shakeTranslate.value = withSequence(
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }, () => {
          // Change message mid-spin (at 100ms = midway through animation)
          setDisplayMessage(message);
        }),
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }),
        withTiming(0, { duration: 50 }),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);

  const messageAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${shakeTranslate.value}deg` }],
  }));

  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.background,
        paddingHorizontal: 20,
      }}
    >
      {/* TOP: Static Title + Optional Subtitle */}
      <View style={{ alignItems: 'center', marginBottom: 48, minHeight: 60 }}>
        <Title
          style={{
            color: theme.accent,
            marginBottom: subtitle ? 8 : 0,
            textAlign: 'center',
          }}
        >
          D&D Toolkit
        </Title>
        {subtitle && (
          <SubTitle
            style={{
              color: theme.textSecondary,
              textAlign: 'center',
            }}
          >
            {subtitle}
          </SubTitle>
        )}
      </View>

      {/* MIDDLE: Decorative Element (loading spinner) */}
      <View style={{ marginBottom: 48 }}>
        {decorativeElement ?? <CustomLoad size="large" />}
      </View>

      {/* PROGRESS BAR: Animated, uses ProgressBar component */}
      {showProgress && (
        <View style={{ width: '80%', marginBottom: 32 }}>
          <ProgressBar ref={progressRef} animated initialProgress={progress ?? 0} />
        </View>
      )}

      {/* Subtle status message with shake animation on change */}
      {displayMessage && (
        <Animated.View style={messageAnimatedStyle}>
          <Body
            style={{
              color: theme.textSecondary,
              textAlign: 'center',
              fontStyle: 'italic',
            }}
          >
            {displayMessage}
          </Body>
        </Animated.View>
      )}
    </View>
  );
}
