import { UseTheme } from '@/theme';
import { View } from 'react-native';
import { CustomLoad } from '../ui';
import { SubTitle, Title } from '../ui/AppText';

/**
 * Custom Splash Screen
 * 
 * Displayed on app startup (controlled by feature flag 'splashScreen')
 * Shows for 1 second after bootstrap completes
 * 
 * Easy to customize - add images, animations, or additional text here
 */
export function SplashScreen() {
  const { theme } = UseTheme();

  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.background,
      }}
    >
      {/* Main Title */}
      <Title
        style={{
          color: theme.accent,
          marginBottom: 16,
          textAlign: 'center',
        }}
      >
        D&D Toolkit
      </Title>

      {/* Tagline */}
      <SubTitle
        style={{
          color: theme.textSecondary,
          textAlign: 'center',
          fontStyle: 'italic',
          marginBottom: 32,
        }}
      >
        The adventure awaits
      </SubTitle>

      {/* Loading Indicator */}
      <CustomLoad size="large" />
    </View>
  );
}
