import { AuthStateManager, logger } from "@/lib";
import { Redirect, useRouter } from "expo-router";
import React from "react";
import { Platform } from "react-native";
import LoadingOverlay from "../components/LoadingOverlay";
import { useAppBootstrap } from "../hooks/use-app-bootstrap";

export default function HomePage() {
  const router = useRouter();
  const [routingDecision, setRoutingDecision] = React.useState<string | null>(null);
  
  // Wait for bootstrap to complete before routing
  const bootstrap = useAppBootstrap();

  // Determine routing decision ASAP once bootstrap is ready
  React.useEffect(() => {
    // Don't proceed until bootstrap is complete
    if (!bootstrap.isReady) {
      return;
    }

    const determineRoute = async () => {
      try {
        logger.debug('routing', 'Starting routing decision...');
        const { routingDecision: decision } = await AuthStateManager.getRoutingDecision();
        logger.info('routing', 'Routing decision:', decision);
        setRoutingDecision(decision);
      } catch (error) {
        logger.error('routing', 'Routing error:', error);
        setRoutingDecision('welcome'); // Default to welcome on error
      }
    };

    determineRoute();
  }, [bootstrap.isReady]);

  // Route immediately when decision is made (no delays)
  React.useEffect(() => {
    if (!routingDecision) {
      return;
    }

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
          router.replace('/login/complete-profile');
          break;
        case 'main':
          logger.debug('routing', 'Navigating to world-selection (main)');
          router.replace('/select/world-selection');
          break;
        default:
          logger.debug('routing', 'Fallback to welcome');
          router.replace('/login/welcome');
      }
    } catch (navError) {
      logger.error('routing', 'Navigation error:', navError);
      router.replace('/login/welcome');
    }
  }, [routingDecision, router]);


  // For web, also provide a declarative redirect as backup (only if routing hasn't happened yet)
  if (Platform.OS === 'web' && !routingDecision && bootstrap.isReady) {
    return <Redirect href="/login/welcome" />;
  }

  // Show loading spinner while bootstrap is happening or determining route
  const loadingMessage = !bootstrap.isReady 
    ? (bootstrap.assetsLoaded ? 'Restoring session...' : 'Loading assets...')
    : 'Determining route...';

  return (
    <LoadingOverlay 
      message={loadingMessage}
      error={bootstrap.error}
      assetsLoaded={bootstrap.assetsLoaded}
    />
  );
}
