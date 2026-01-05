import { AuthStateManager, logger } from "@/lib";
import { useRouter } from "expo-router";
import React from "react";
import LoadingOverlay from "../components/LoadingOverlay";
import { useAppBootstrap } from "../hooks/use-app-bootstrap";

export default function HomePage() {
  const router = useRouter();
  
  // Wait for bootstrap to complete before routing
  const bootstrap = useAppBootstrap();

  // Determine routing decision ASAP once bootstrap is ready
  React.useEffect(() => {
    // Don't proceed until bootstrap is complete
    if (!bootstrap.isReady) {
      logger.debug('index', '⏸️ Waiting for bootstrap to complete');
      return;
    }

    const determineRoute = async () => {
      try {
        logger.info('index', '🔍 Starting routing decision...');
        const { routingDecision: decision } = await AuthStateManager.getRoutingDecision();
        logger.info('index', '✅ Routing decision:', decision);
        
        // Navigate immediately without state update to avoid render
        switch (decision) {
          case 'welcome':
            logger.info('index', '🏠 Navigating to: /login/welcome');
            router.replace('/login/welcome');
            break;
          case 'login':
            logger.info('index', '🔑 Navigating to: /login/sign-in');
            router.replace('/login/sign-in');
            break;
          case 'complete-profile':
            logger.info('index', '👤 Navigating to: /login/complete-profile');
            router.replace('/login/complete-profile');
            break;
          case 'main':
            logger.info('index', '🌍 Navigating to: /select/world-selection');
            router.replace('/select/world-selection');
            break;
          default:
            logger.info('index', '⚠️ Fallback to: /login/welcome');
            router.replace('/login/welcome');
        }
      } catch (error) {
        logger.error('routing', 'Routing error:', error);
        router.replace('/login/welcome'); // Default to welcome on error
      }
    };

    determineRoute();
  }, [bootstrap.isReady, router]);

  // Show loading spinner while bootstrap is happening or determining route
  const loadingMessage = !bootstrap.isReady 
    ? (bootstrap.assetsLoaded ? 'Restoring session...' : 'Loading assets...')
    : 'Determining route...';

  logger.debug('index', '⏳ Rendering index loading overlay:', loadingMessage);

  return (
    <LoadingOverlay 
      message={loadingMessage}
      error={bootstrap.error}
      assetsLoaded={bootstrap.assetsLoaded}
    />
  );
}
