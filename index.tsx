import "@expo/metro-runtime";
import { App } from "expo-router/build/qualified-entry";
import { renderRootComponent } from "expo-router/build/renderRootComponent";
import React from "react";
import { Platform } from "react-native";
import { logger } from "./lib/utils/logger";

// Global flag to track Skia readiness
if (Platform.OS === 'web') {
  (window as any).SkiaReady = false;
}

// For web, we need to load Skia BEFORE React renders anything
async function initializeWebApp() {
  if (Platform.OS === 'web') {
    try {
      logger.debug('bootstrap', 'Loading Skia for web before app render...');
      
      const { LoadSkiaWeb } = await import("@shopify/react-native-skia/lib/module/web");
      await LoadSkiaWeb({
        locateFile: (file) => {
          logger.debug('bootstrap', 'Locating file:', file);
          // Always use absolute path from domain root to avoid any path resolution issues
          if (file === 'canvaskit.wasm') {
            return `${window.location.origin}/canvaskit.wasm`;
          }
          // For any other files, use absolute path from root
          return `${window.location.origin}/${file}`;
        },
      });
      
      // Mark Skia as ready
      (window as any).SkiaReady = true;
      logger.info('bootstrap', 'Skia (CanvasKit) loaded successfully');
    } catch (error) {
      logger.error('bootstrap', 'Failed to load Skia:', error);
      logger.warn('bootstrap', 'App will continue without Skia canvas features');
      // Mark as "ready" but with an error flag
      (window as any).SkiaReady = 'error';
    }
  }
}

// Create wrapper that ensures Skia loads first on web
function AppWithSkiaInit() {
  const [skiaReady, setSkiaReady] = React.useState(Platform.OS !== 'web');

  React.useEffect(() => {
    if (Platform.OS === 'web') {
      initializeWebApp().finally(() => {
        setSkiaReady(true);
      });
    }
  }, []);

  // On web, show a minimal loading screen while Skia loads
  if (!skiaReady) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#2f353d',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        color: '#F5E6D3',
        fontFamily: 'system-ui, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '16px' }}>⚡</div>
          <div>Loading D&D Toolkit...</div>
        </div>
      </div>
    );
  }

  return <App />;
}

renderRootComponent(AppWithSkiaInit);