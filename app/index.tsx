import { Redirect, useRouter } from "expo-router";
import React from "react";
import { Platform } from "react-native";
import LoadingOverlay from "../components/LoadingOverlay";
import { useAppBootstrap } from "../hooks/use-app-bootstrap";
import { AuthStateManager } from "../lib/auth-state";

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

        // Use full routing logic for both web and mobile
        console.log('🔍 Starting routing decision...');
        const routingDecision = await AuthStateManager.getRoutingDecision();
        console.log('🎯 Routing decision:', routingDecision);
        
        setTimeout(() => {
          try {
            switch (routingDecision) {
              case 'welcome':
                console.log('➡️ Navigating to welcome');
                router.replace('/login/welcome');
                break;
              case 'complete-profile':
                console.log('➡️ Navigating to complete-profile');
                router.replace('/login/complete-profile');
                break;
              case 'login':
                console.log('➡️ Navigating to sign-in');
                router.replace('/login/sign-in');
                break;
              case 'main':
                console.log('➡️ Navigating to world-selection (main)');
                router.replace('/select/world-selection');
                break;
              default:
                console.log('➡️ Fallback to welcome');
                router.replace('/login/welcome');
            }
          } catch (navError) {
            console.error('Navigation error:', navError);
            // Fallback navigation
            router.replace('/login/welcome');
          }
        }, 100);
      } catch (error) {
        console.error('Routing error:', error);
        
        // Emergency fallback to welcome screen
        setTimeout(() => {
          try {
            router.replace('/login/welcome');
          } catch (navError) {
            console.error('Emergency navigation failed:', navError);
          }
        }, 1000);
      } finally {
        // Remove loading state after a short delay
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
