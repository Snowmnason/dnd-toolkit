import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, TouchableOpacity, View } from 'react-native';
import { ComponentStyles, CoreColors } from '../constants/theme';
import SettingsMenu from './SettingsMenu';
import { ThemedText } from './themed-text';

interface TopBarProps {
  title?: string;
  showBackButton?: boolean;
  showHamburger?: boolean;
  onBackPress?: () => void;
}

export default function TopBar({ 
  title = 'D&D Toolkit', 
  showBackButton = true, 
  showHamburger = true,
  onBackPress 
}: TopBarProps) {
  const router = useRouter();
  const isMobile = Platform.OS !== 'web';
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      router.back();
    }
  };

  const handleHamburgerPress = () => {
    if (Platform.OS === 'web') {
      // Use custom modal for web
      setShowSettingsMenu(true);
    } else {
      // Use native Alert for mobile
      Alert.alert(
        'Menu',
        'Choose an option',
        [
          {
            text: 'Account Settings',
            onPress: () => router.push('/settings')
          },
          {
            text: 'Return to World Selection',
            onPress: () => router.replace('/select/world-selection')
          },
          {
            text: 'Cancel',
            style: 'cancel'
          }
        ]
      );
    }
  };

  // Show on all platforms now (not just mobile)
  return (
    <>
      <View style={{ ...ComponentStyles.topBar.container, paddingTop: isMobile ? 50 : 8 }}>
        {/* Left: Back Button */}
        <View style={{ width: 40 }}>
          {showBackButton && (
            <TouchableOpacity 
              onPress={handleBackPress}
              style={ComponentStyles.topBar.button}
            >
              <ThemedText style={{ color: CoreColors.primary, fontSize: 16, fontWeight: '600' }}>
                ←
              </ThemedText>
            </TouchableOpacity>
          )}
        </View>

        {/* Center: Title */}
        <ThemedText 
          style={{ 
            color: CoreColors.textPrimary, 
            fontSize: 18, 
            fontWeight: '700',
            textAlign: 'center',
            flex: 1
          }}
        >
          {title}
        </ThemedText>

        {/* Right: Hamburger Menu */}
        <View style={{ width: 40 }}>
          {showHamburger && (
            <TouchableOpacity 
              onPress={handleHamburgerPress}
              style={ComponentStyles.topBar.button}
            >
              <ThemedText style={{ color: CoreColors.primary, fontSize: 16, fontWeight: '600' }}>
                ☰
              </ThemedText>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Cross-platform Settings Menu */}
      <SettingsMenu
        visible={showSettingsMenu}
        onClose={() => setShowSettingsMenu(false)}
        onAccountSettings={() => {
          setShowSettingsMenu(false);
          router.push('/settings');
        }}
        onReturnToWorldSelection={() => {
          setShowSettingsMenu(false);
          router.replace('/select/world-selection');
        }}
      />
    </>
  );
}