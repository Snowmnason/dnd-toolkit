import { $, UseTheme } from '@/theme';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import SettingsMenu from './settings/SettingsMenu';
import { IconButton } from './ui/IconButton';

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
  const { theme } = UseTheme();

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
            <IconButton
              icon="←"
              onPress={handleBackPress}
              color={$('accent')}
              iconColor={$('surface')}
              size={32}
            />
          )}
        </View>

        {/* Center: Title */}
        <Text style={[styles.title, { fontFamily: theme.fontFamilyTitle }]}>
          {title}
        </Text>

        {/* Right: Hamburger Menu */}
        <View style={styles.sideSlot}>
          {showHamburger && (
            <IconButton
              icon="☰"
              onPress={handleHamburgerPress}
              color={$('accent')}//"rgba(139, 69, 19, 0.2)"
              iconColor={$('surface')}//"#F5E6D3"
              size={32}
            />
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
    backgroundColor: '#1f262e',
    borderBottomWidth: 1,
    borderBottomColor: '#969696',
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
  title: {
    color: '#F5E6D3',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    flex: 1,
  },
});