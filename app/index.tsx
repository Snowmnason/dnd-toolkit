import { AuthStateManager, logger } from "@/lib";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import LoadingOverlay from "../components/LoadingOverlay";
import { useAppBootstrap } from "../hooks/use-app-bootstrap";

const FAILSAFE_TIMEOUT = 8000; // Show failsafe button after 8 seconds

const TAVERN_LOCATIONS = [
  { text: 'Enter the Tavern', icon: '🍺' },
  { text: 'Enter the Dungeon', icon: '🗝️' },
  { text: 'Enter the Castle', icon: '🏰' },
  { text: 'Enter the Camp', icon: '⛺' },
  { text: 'Enter the Plane', icon: '✨' },
  { text: 'Enter the Guild Hall', icon: '🛡️' },
  { text: 'Enter the Temple', icon: '⛪' },
  { text: 'Enter the Dragon\'s Lair', icon: '🐉' },
];

export default function HomePage() {
  const router = useRouter();
  const [showFailsafe, setShowFailsafe] = React.useState(false);
  
  // Pick a random location on mount
  const randomLocation = React.useMemo(() => {
    const randomIndex = Math.floor(Math.random() * TAVERN_LOCATIONS.length);
    // Use .at() to safely access array element
    const location = TAVERN_LOCATIONS.at(randomIndex);
    if (!location) {
      // Fallback to first location if random index fails
      const fallback = TAVERN_LOCATIONS.at(0);
      return fallback || { text: 'Enter the Tavern', icon: '🍺' };
    }
    return location;
  }, []);
  
  // Wait for bootstrap to complete before routing
  const bootstrap = useAppBootstrap();

  // Show failsafe button after timeout
  React.useEffect(() => {
    const timer = setTimeout(() => {
      logger.warn('bootstrap', '⏱️ Failsafe timeout reached, showing manual navigation button');
      setShowFailsafe(true);
    }, FAILSAFE_TIMEOUT);

    return () => clearTimeout(timer);
  }, []);

  // Determine routing decision ASAP once bootstrap is ready
  React.useEffect(() => {
    // Don't proceed until bootstrap is complete
    if (!bootstrap.isReady) {
      logger.debug('bootstrap', '⏸️ Waiting for bootstrap to complete', {
        assetsLoaded: bootstrap.assetsLoaded,
        sessionRestored: bootstrap.sessionRestored,
        isReady: bootstrap.isReady,
        error: bootstrap.error?.message
      });
      return;
    }

    logger.info('bootstrap', '🚀 Bootstrap ready! Starting routing decision...');

    const determineRoute = async () => {
      try {
        logger.info('bootstrap', '🔍 Calling AuthStateManager.getRoutingDecision()...');
        const startTime = Date.now();
        const { routingDecision: decision } = await AuthStateManager.getRoutingDecision();
        const elapsed = Date.now() - startTime;
        logger.info('bootstrap', `✅ Routing decision received in ${elapsed}ms:`, decision);
        
        // Navigate immediately without state update to avoid render
        switch (decision) {
          case 'welcome':
            logger.info('bootstrap', '🏠 Navigating to: /login/welcome');
            router.replace('/login/welcome');
            break;
          case 'login':
            logger.info('bootstrap', '🔑 Navigating to: /login/sign-in');
            router.replace('/login/sign-in');
            break;
          case 'complete-profile':
            logger.info('bootstrap', '👤 Navigating to: /login/complete-profile');
            router.replace('/login/complete-profile');
            break;
          case 'main':
            logger.info('bootstrap', '🌍 Navigating to: /select/world-selection');
            router.replace('/select/world-selection');
            break;
          default:
            logger.warn('bootstrap', `⚠️ Unknown decision "${decision}", using fallback: /login/welcome`);
            router.replace('/login/welcome');
        }
        
        logger.info('bootstrap', '✅ router.replace() called successfully');
      } catch (error) {
        logger.error('bootstrap', '❌ Routing error:', error);
        logger.error('bootstrap', '📍 Attempting fallback to /login/welcome');
        try {
          router.replace('/login/welcome');
          logger.info('bootstrap', '✅ Fallback navigation successful');
        } catch (fallbackError) {
          logger.error('bootstrap', '❌ Fallback navigation also failed:', fallbackError);
        }
      }
    };

    determineRoute();
  }, [bootstrap.isReady, bootstrap.assetsLoaded, bootstrap.sessionRestored, bootstrap.error?.message, router]);

  // Show loading spinner while bootstrap is happening or determining route
  const loadingMessage = !bootstrap.isReady 
    ? (bootstrap.assetsLoaded ? 'Restoring session...' : 'Loading assets...')
    : 'Determining route...';

  logger.debug('bootstrap', '⏳ Rendering index loading overlay:', loadingMessage);

  const handleManualNavigation = () => {
    logger.info('bootstrap', '🚪 User clicked failsafe button, navigating to welcome');
    router.replace('/login/welcome');
  };

  return (
    <View style={styles.container}>
      <LoadingOverlay 
        message={loadingMessage}
        error={bootstrap.error}
        assetsLoaded={bootstrap.assetsLoaded}
      />
      
      {showFailsafe && (
        <View style={styles.failsafeContainer}>
          <TouchableOpacity 
            style={styles.failsafeButton}
            onPress={handleManualNavigation}
            activeOpacity={0.8}
          >
            <Text style={styles.failsafeIcon}>{randomLocation.icon}</Text>
            <Text style={styles.failsafeText}>{randomLocation.text}</Text>
            <Text style={styles.failsafeSubtext}>Manual Navigation</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
// Using StyleSheet since this is a fail safe with a very specific style
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2f353d',
  },
  failsafeContainer: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10000,
  },
  failsafeButton: {
    backgroundColor: 'rgba(212, 175, 55, 0.95)', // Gold
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#8B4513', // Saddle brown
    boxShadow: '#000, 0 4px 8px',
    elevation: 8,
    alignItems: 'center',
    minWidth: 200,
  },
  failsafeIcon: {
    fontSize: 32,
    marginBottom: 4,
  },
  failsafeText: {
    color: '#2f353d',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 2,
  },
  failsafeSubtext: {
    color: 'rgba(47, 53, 61, 0.7)',
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
