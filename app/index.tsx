import { Redirect, useRouter } from "expo-router";
import React from "react";
import { Platform } from "react-native";
import LoadingOverlay from "../components/LoadingOverlay";
import { useAppBootstrap } from "../hooks/use-app-bootstrap";
import { AuthStateManager } from "../lib/auth-state";
import { logger } from "../lib/utils/logger";

export default function HomePage() {
  const router = useRouter();
  const [isRouting, setIsRouting] = React.useState(true);
  
  // Wait for bootstrap to complete before routing
  const bootstrap = useAppBootstrap();

  // For mobile platforms, do the full routing logic
 React.useEffect(() => {
  // Don't proceed until bootstrap is complete
  if (!bootstrap.isReady) {
    return;
  }

  const handleRouting = async () => {
    try {
      setIsRouting(true);

      logger.debug('routing', 'Starting routing decision...');
      const {routingDecision, profileId} = await AuthStateManager.getRoutingDecision();
      logger.info('routing', 'Routing decision:', routingDecision);

      // ⏳ Add a small delay so RootLayout has time to mount
      setTimeout(() => {
        try {
          switch (routingDecision) {
            case 'welcome':
              logger.debug('routing', 'Navigating to welcome');
              router.replace('/login/welcome');
              break;
            case 'login':
              logger.debug('routing', 'Navigating to sign-in');
              router.replace('/login/sign-in');
              break;
            case 'complete-profile':
              logger.debug('routing', 'Navigating to complete-profile');
               router.replace({
                pathname: "/login/complete-profile",
                params: { userId: profileId }
              });
              break;
            case 'main':
              logger.debug('routing', 'Navigating to world-selection (main)');
              router.replace({
                pathname: "/select/world-selection",
                params: { userId: profileId }
              });
              break;
            default:
              logger.debug('routing', 'Fallback to welcome');
              router.replace('/login/welcome');
          }
        } catch (navError) {
          logger.error('routing', 'Navigation error:', navError);
          router.replace('/login/welcome');
        }
      }, 400); // 👈 delay to let RootLayout mount
    } catch (error) {
      logger.error('routing', 'Routing error:', error);
      setTimeout(() => {
        try {
          router.replace('/login/welcome');
        } catch (navError) {
          logger.error('routing', 'Emergency navigation failed:', navError);
        }
      }, 1000);
    } finally {
      setTimeout(() => {
        setIsRouting(false);
      }, 300);
    }
  };

  handleRouting();
}, [router, bootstrap.isReady]);


  // For web, also provide a declarative redirect as backup (only if routing failed)
  if (Platform.OS === 'web' && !isRouting && bootstrap.isReady) {
    return <Redirect href="/login/welcome" />;
  }

  // Show loading spinner while bootstrap is happening or determining route
  const loadingMessage = !bootstrap.isReady 
    ? (bootstrap.assetsLoaded ? 'Restoring session...' : 'Loading assets...')
    : 'Loading D&D Toolkit...';

  return (
    <LoadingOverlay 
      message={loadingMessage}
      error={bootstrap.error}
      assetsLoaded={bootstrap.assetsLoaded}
    />
  );
}
