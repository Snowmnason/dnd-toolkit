import { UseTheme } from '@/theme';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import SettingsMenu from './settings/SettingsMenu';

interface TopBarProps {
  title?: string;
  showBackButton?: boolean;
  showHamburger?: boolean;
  onBackPress?: () => void;
  userId?: string;
  worldId?: string;
  userRole?: string;
}
const { theme } = UseTheme()

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

  return (
    <>
      <View style={[
        styles.container,
        isMobile ? styles.containerMobile : styles.containerDesktop,
      ]}>
        {/* Left: Back Button */}
        <View style={styles.sideSlot}>
          {showBackButton && (
            <TouchableOpacity 
              onPress={handleBackPress}
              style={styles.iconButton}
            >
              <Text style={styles.iconText}>
                ←
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Center: Title */}
        <Text style={styles.title}>
          {title}
        </Text>

        {/* Right: Hamburger Menu */}
        <View style={styles.sideSlot}>
          {showHamburger && (
            <TouchableOpacity 
              onPress={handleHamburgerPress}
              style={styles.iconButton}
            >
              <Text style={styles.iconText}>
                ☰
              </Text>
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

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1f262eff',
    borderBottomWidth: 1,
    borderBottomColor: '#969696ff',
  },
  containerMobile: {
    paddingTop: 50,
  },
  containerDesktop: {
    paddingTop: 8,
  },
  sideSlot: {
    width: 40,
  },
  iconButton: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(139, 69, 19, 0.2)',
    alignItems: 'center',
  },
  iconText: {
    color: '#F5E6D3',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontFamily: theme.fontFamily,
    color: '#F5E6D3',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    flex: 1,
  },
});