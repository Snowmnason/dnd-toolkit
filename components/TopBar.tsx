import { useRouter } from 'expo-router';
import { Alert, Platform, TouchableOpacity, View } from 'react-native';
import { AuthStateManager } from '../lib/auth-state';
import { supabase } from '../lib/supabase';
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

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      router.back();
    }
  };

  const handleHamburgerPress = () => {
    // Show settings menu
    Alert.alert(
      'Settings',
      'Choose an option',
      [
        {
          text: 'Account Settings',
          onPress: () => router.push('/settings')
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: handleSignOut
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              // Sign out from Supabase
              await supabase.auth.signOut();
              
              // Clear auth state
              await AuthStateManager.clearAuthState();
              
              // Navigate back to welcome screen
              router.replace('/login/welcome');
            } catch (error) {
              console.error('Sign out error:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          }
        }
      ]
    );
  };

  // Only show on mobile
  if (!isMobile) {
    return null;
  }

  return (
    <View style={{ 
      flexDirection: 'row', 
      alignItems: 'center', 
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      paddingTop: 50, // Account for status bar
      backgroundColor: '#2f353d',
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(139, 69, 19, 0.3)'
    }}>
      {/* Left: Back Button */}
      <View style={{ width: 40 }}>
        {showBackButton && (
          <TouchableOpacity 
            onPress={handleBackPress}
            style={{ 
              padding: 8,
              borderRadius: 6,
              backgroundColor: 'rgba(139, 69, 19, 0.2)'
            }}
          >
            <ThemedText style={{ color: '#8B4513', fontSize: 16, fontWeight: '600' }}>
              ←
            </ThemedText>
          </TouchableOpacity>
        )}
      </View>

      {/* Center: Title */}
      <ThemedText 
        style={{ 
          color: '#F5E6D3', 
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
            style={{ 
              padding: 8,
              borderRadius: 6,
              backgroundColor: 'rgba(139, 69, 19, 0.2)',
              alignItems: 'center'
            }}
          >
            <ThemedText style={{ color: '#8B4513', fontSize: 16, fontWeight: '600' }}>
              ☰
            </ThemedText>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}