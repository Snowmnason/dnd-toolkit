import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { ComponentStyles, CoreColors } from '../constants/theme';
import SettingsMenu from './SettingsMenu';
import { ThemedText } from './themed-text';

interface TopBarProps {
  title?: string;
  showBackButton?: boolean;
  showHamburger?: boolean;
  onBackPress?: () => void;
  userId?: string;
  worldId?: string;
  userRole?: string;
}

export default function TopBar({ 
  title = 'D&D Toolkit', 
  showBackButton = true, 
  showHamburger = true,
  onBackPress,
  userId,
  worldId,
  userRole
}: TopBarProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = Platform.OS !== 'web' || width < 900;
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      router.back();
    }
  };

  const handleHamburgerPress = () => {
    // Always use the beautiful custom modal instead of system alerts
    setShowSettingsMenu(true);
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

      {/* Beautiful Custom Settings Menu for All Platforms */}
      <SettingsMenu
        visible={showSettingsMenu}
        onClose={() => setShowSettingsMenu(false)}
        onAccountSettings={() => {
          setShowSettingsMenu(false);
          
          const routeParams: any = {};
          if (userId) routeParams.userId = userId;
          if (worldId) routeParams.worldId = worldId;
          if (userRole) routeParams.userRole = userRole;
          
          router.push({
            pathname: '/settings',
            params: routeParams,
          });
        }}
        onReturnToWorldSelection={() => {
          setShowSettingsMenu(false);
          
          const routeParams: any = {};
          if (userId) routeParams.userId = userId;
          
          router.replace({
            pathname: '/select/world-selection',
            params: routeParams,
          });
        }}
      />
    </>
  );
}