import React from 'react';
import { Platform, View } from 'react-native';
import { Text } from 'tamagui';
import CustomLoad from './ui/CustomLoad';

interface LoadingOverlayProps {
  message?: string;
  error?: Error | null;
  assetsLoaded?: boolean;
}

export default function LoadingOverlay({ 
  message = 'Loading...', 
  error,
  assetsLoaded = false 
}: LoadingOverlayProps) {
  // Use React.useEffect to manage focus when this overlay mounts
  React.useEffect(() => {
    if (Platform.OS === 'web') {
      // Store the currently focused element
      const activeElement = document.activeElement as HTMLElement;
      
      // Remove focus from any focused element to prevent aria-hidden conflicts
      if (activeElement && activeElement.blur) {
        activeElement.blur();
      }
      
      // Return a cleanup function to restore focus if needed
      return () => {
        // Focus management cleanup if needed
      };
    }
  }, []);

  const displayMessage = assetsLoaded ? 'Checking authentication...' : message;

  return (
    <View 
      style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: '#2f353d', // Dark semi-transparent background
        // Ensure this overlay is on top
        zIndex: 9999,
      }}
      accessible={true}
      accessibilityRole="progressbar"
      accessibilityLabel={displayMessage}
      // Prevent touch events from propagating to elements behind
      pointerEvents="box-none"
    >
      <CustomLoad />
      
      <Text style={{ 
        marginTop: 20, 
        color: '#F5E6D3', 
        textAlign: 'center',
        fontSize: 16
      }}>
        {displayMessage}
      </Text>

      {error && (
        <Text style={{ 
          marginTop: 10, 
          color: '#ffa500', 
          textAlign: 'center',
          fontSize: 12,
          opacity: 0.8,
          paddingHorizontal: 20
        }}>
          Some assets failed to load but the app will continue...
        </Text>
      )}
    </View>
  );
}