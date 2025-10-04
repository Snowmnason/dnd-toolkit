import { Asset } from 'expo-asset';
import * as Font from 'expo-font';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

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

export interface AppBootstrapState {
  assetsLoaded: boolean;
  sessionRestored: boolean;
  isReady: boolean;
  error: Error | null;
}

export function useAppBootstrap() {
  const [state, setState] = useState<AppBootstrapState>({
    assetsLoaded: false,
    sessionRestored: false,
    isReady: false,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      try {
        console.log('🚀 Starting app bootstrap...');

        // Step 1: Load assets in parallel
        const assetPromises = [
          loadFonts(),
          loadImages(),
          loadPlatformAssets(),
        ];

        // Step 2: Restore Supabase session in parallel with assets
        const sessionPromise = restoreSession();

        // Wait for both assets and session
        await Promise.all([
          Promise.all(assetPromises),
          sessionPromise,
        ]);

        if (isMounted) {
          setState(prev => ({
            ...prev,
            assetsLoaded: true,
            sessionRestored: true,
            isReady: true,
          }));
          console.log('✅ App bootstrap completed successfully');
        }
      } catch (error) {
        console.error('❌ Bootstrap error:', error);
        if (isMounted) {
          setState(prev => ({
            ...prev,
            error: error as Error,
            // Still mark as ready to allow app to continue
            assetsLoaded: true,
            sessionRestored: true,
            isReady: true,
          }));
        }
      }
    }

    bootstrap();

    return () => {
      isMounted = false;
    };
  }, []);

  return state;
}

async function loadFonts() {
  try {
    await Font.loadAsync(customFonts);
    console.log('✅ Fonts loaded successfully');
  } catch (error) {
    console.warn('⚠️ Font loading error (non-critical):', error);
    // Continue anyway - fonts are not critical
  }
}

async function loadImages() {
  try {
    await Asset.loadAsync(preloadImages);
    console.log('✅ Images loaded successfully');
  } catch (error) {
    console.warn('⚠️ Image loading error (non-critical):', error);
    // Continue anyway - these images are not critical
  }
}

async function loadPlatformAssets() {
  if (Platform.OS === 'web') {
    // Skia is now loaded in index.tsx before React renders
    // Just add a small delay for web stability
    await new Promise(resolve => setTimeout(resolve, 200));
    console.log("✅ Web platform assets ready");
  } else {
    console.log("✅ Mobile platform ready");
  }
}

async function restoreSession() {
  try {
    console.log('🔄 Restoring Supabase session...');
    
    // Import supabase dynamically to avoid circular dependencies
    const { supabase, isSupabaseConfigured } = await import('../lib/supabase');
    
    if (!isSupabaseConfigured()) {
      console.warn('⚠️ Supabase not configured, skipping session restore');
      return;
    }

    // Get the current session (this will restore from storage if available)
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.warn('⚠️ Session restore error:', error);
      return;
    }

    if (session) {
      console.log('✅ Session restored successfully');
      
      // Update local auth state to match
      const { AuthStateManager } = await import('../lib/auth-state');
      await AuthStateManager.setSession(session);
    } else {
      console.log('ℹ️ No stored session found');
    }

    // Set up auth state change listener for future changes
    supabase.auth.onAuthStateChange(async (event: string, session: any) => {
      console.log('🔄 Auth state changed:', event);
      
      const { AuthStateManager } = await import('../lib/auth-state');
      
      if (session) {
        await AuthStateManager.setSession(session);
      } else {
        await AuthStateManager.clearAuthState();
      }
    });

  } catch (error) {
    console.error('❌ Session restore error:', error);
    // Don't throw - app can still function without session
  }
}