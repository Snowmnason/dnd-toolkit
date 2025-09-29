import { NavigationContainer } from '@react-navigation/native';
import { AppRegistry } from 'react-native';
import { name as appName } from '../app.json';
import AppLoader from './AppLoader';
import DesktopNavigator from './navigators/DesktopNavigator';

function App() {
  return (
    <AppLoader
      onReady={async () => {
        // ⚡️ Web-only initialization (Skia, CanvasKit, etc.)
      }}
    >
      <NavigationContainer>
        <DesktopNavigator />
      </NavigationContainer>
    </AppLoader>
  );
}

AppRegistry.registerComponent(appName, () => App);

// ✅ Only run in a browser environment
if (typeof document !== 'undefined') {
  AppRegistry.runApplication(appName, {
    rootTag: document.getElementById('root'),
  });
}
