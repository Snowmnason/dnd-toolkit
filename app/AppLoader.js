import { Asset } from 'expo-asset';
import * as Font from 'expo-font';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import CustomLoad from '../components/custom_components/CustomLoad';

// Put all shared fonts here
const customFonts = {
  GrenzeGotisch: require('../assets/fonts/GrenzeGotisch.ttf'),
  GrenzeGotischBlack: require('../assets/fonts/GrenzeGotisch-Black.ttf'),
  GrenzeGotischExtraBold: require('../assets/fonts/GrenzeGotisch-ExtraBold.ttf'),
};

// Put all shared images here
const preloadImages = [
  require('../assets/images/Miku.png'),
  require('../assets/images/load.gif'),
];

export default function AppLoader({ children, onReady }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadAssets() {
      try {
        console.log('🔄 Loading app assets...');
        
        // Load fonts with error handling
        try {
          await Font.loadAsync(customFonts);
          console.log('✅ Fonts loaded successfully');
        } catch (fontError) {
          console.warn('⚠️  Font loading error (non-critical):', fontError);
          // Continue anyway - fonts are not critical
        }

        // Load images with error handling
        try {
          await Asset.loadAsync(preloadImages);
          console.log('✅ Images loaded successfully');
        } catch (imageError) {
          console.warn('⚠️  Image loading error (non-critical):', imageError);
          // Continue anyway - these images are not critical
        }

        // Platform-specific initialization callback
        if (onReady) {
          try {
            await onReady();
            console.log('✅ Platform initialization completed');
          } catch (readyError) {
            console.warn('⚠️  Platform initialization error:', readyError);
            // Continue anyway - app can still function
          }
        }

        // For web, add a small additional delay to ensure everything is stable
        if (Platform.OS === 'web') {
          await new Promise(resolve => setTimeout(resolve, 200));
        }

        console.log('🎉 App loading completed successfully');
        setLoaded(true);
      } catch (e) {
        console.error('❌ Critical error loading assets:', e);
        setError(e);
        
        // Even with errors, try to load the app after a delay
        setTimeout(() => {
          console.log('⚠️  Loading app despite errors...');
          setLoaded(true);
        }, 1000);
      }
    }

    loadAssets();
  }, [onReady]);

  if (!loaded) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center',
        backgroundColor: '#2f353d'
      }}>
        <CustomLoad size="large" />
        {error && Platform.OS === 'web' && (
          <View style={{ marginTop: 20, padding: 20 }}>
            <p style={{ color: '#F5E6D3', textAlign: 'center', fontSize: 14 }}>
              Loading assets... This may take a moment.
            </p>
          </View>
        )}
      </View>
    );
  }

  return children;
}
