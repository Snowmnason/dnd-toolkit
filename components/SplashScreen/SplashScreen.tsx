import { UseTheme } from '@/theme';
import React from 'react';
import { View } from 'react-native';
import { CustomLoad } from '../ui';
import { Body, SubTitle, Title } from '../ui/AppText';

/**
 * Custom Splash Screen / Loading Overlay
 *
 * Discord-style loading screen with clean layout:
 * - Optional title + subtitle at top (for bootstrap context)
 * - Centered decorative element (spinner/CustomLoad)
 * - Optional progress bar (can be hidden)
 * - Subtle fun message at bottom
 *
 * Used for:
 * 1. Initial app splash (feature flag controlled)
 * 2. LoadingBlocker overlay when any system calls setLoading()
 */

interface SplashScreenProps {
  // Top section: context / branding
  title?: string;
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
  title,
  subtitle,
  decorativeElement,
  showProgress = true,
  progress,
  message,
}: SplashScreenProps = {}) {
  const { theme } = UseTheme();

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
      {/* TOP: Optional Title + Subtitle (bootstrap context) */}
      <View style={{ alignItems: 'center', marginBottom: 48, minHeight: 60 }}>
        {title && (
          <Title
            style={{
              color: theme.accent,
              marginBottom: subtitle ? 8 : 0,
              textAlign: 'center',
            }}
          >
            {title}
          </Title>
        )}
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

      {/* PROGRESS BAR: Optional, can be hidden */}
      {showProgress && (
        <View
          style={{
            width: '80%',
            height: 4,
            backgroundColor: theme.border,
            borderRadius: 2,
            marginBottom: 32,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              width: progress !== undefined ? `${Math.min(Math.max(progress, 0), 100)}%` : '30%',
              height: '100%',
              backgroundColor: theme.accent,
              borderRadius: 2,
            }}
          />
        </View>
      )}

      {/* BOTTOM: Subtle fun message */}
      {message && (
        <Body
          style={{
            color: theme.textSecondary,
            textAlign: 'center',
            fontSize: 13,
            fontStyle: 'italic',
          }}
        >
          {message}
        </Body>
      )}
    </View>
  );
}
