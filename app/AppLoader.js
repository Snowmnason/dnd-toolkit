import { Asset } from 'expo-asset';
import * as Font from 'expo-font';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

// Put all shared fonts here
const customFonts = {
  GrenzeGotisch: require('../assets/fonts/GrenzeGotisch.ttf'),
  GrenzeGotischBlack: require('../assets/fonts/GrenzeGotisch-Black.ttf'),
  GrenzeGotischExtraBold: require('../assets/fonts/GrenzeGotisch-ExtraBold.ttf'),
};

// Put all shared images here
const preloadImages = [
  require('../assets/images/Miku.png'),
];

export default function AppLoader({ children, onReady }) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function loadAssets() {
      try {
        // Fonts
        await Font.loadAsync(customFonts);

        // Images
        await Asset.loadAsync(preloadImages);

        // Any callback for platform-specific init
        if (onReady) await onReady();

        setLoaded(true);
      } catch (e) {
        console.warn('Error loading assets:', e);
      }
    }

    loadAssets();
  }, [onReady]);

  if (!loaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return children;
}
