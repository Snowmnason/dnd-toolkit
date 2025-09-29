import { Asset } from 'expo-asset';
import * as Font from 'expo-font';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import AppNavigator from './AppNavigator';

// List all your fonts here
const customFonts = {
  GrenzeGotisch: require('../assets/fonts/GrenzeGotisch.ttf'),
  GrenzeGotischBlack: require('../assets/fonts/GrenzeGotisch-Black.ttf'),
  GrenzeGotischExtraBold: require('../assets/fonts/GrenzeGotisch-ExtraBold.ttf'),
};

export default function App() {
  const [assetsLoaded, setAssetsLoaded] = useState(false);

  useEffect(() => {
    async function loadAssets() {
      try {
        // Load fonts
        await Font.loadAsync(customFonts);

        // Load images
        await Promise.all([
          Asset.loadAsync(require('../assets/images/Miku.png')),
        ]);

        // TODO:Load other stuff Folders, Jsons, etc.

        setAssetsLoaded(true); // everything loaded
      } catch (e) {
        console.warn('Error loading assets:', e);
      }
    }

    loadAssets();
  }, []);

  if (!assetsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <AppNavigator />;
}
