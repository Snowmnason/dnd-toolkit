import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { Button, Text, View } from 'tamagui';
// import { ComponentStyles } from '../constants/theme'; // deprecated
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
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8, paddingTop: isMobile ? 50 : 8, borderBottomWidth: 1 }}>
        {/* Left: Back Button */}
        <View style={{ width: 40 }}>
          {showBackButton && (
            <Button unstyled onPress={handleBackPress}>
              <Text style={{ color: '#F5E6D3', fontSize: 16, fontWeight: '600' }}>←</Text>
            </Button>
          )}
        </View>

        {/* Center: Title */}
        <Text
          style={{
            color: '#F5E6D3',
            fontSize: 18,
            fontWeight: '700',
            textAlign: 'center',
            flex: 1,
          }}
        >
          {title}
        </Text>

        {/* Right: Hamburger Menu */}
        <View style={{ width: 40 }}>
          {showHamburger && (
            <Button unstyled onPress={handleHamburgerPress}>
              <Text style={{ color: '#F5E6D3', fontSize: 16, fontWeight: '600' }}>☰</Text>
            </Button>
          )}
        </View>
      </View>

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