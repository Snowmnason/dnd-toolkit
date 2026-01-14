import { AuthStateManager, logger } from "@/lib";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Welcome from "../Screens/Welcome";
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
  const [showFailsafe, setShowFailsafe] = React.useState(false);
  const [isAuthChecked, setIsAuthChecked] = React.useState(false);
  const [hasAccount, setHasAccount] = React.useState(false);
  
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

  // Show failsafe button after timeout, but only if we haven't completed auth check
  React.useEffect(() => {
    const timer = setTimeout(() => {
      // Only show failsafe if we're still waiting for auth check
      if (!isAuthChecked) {
        logger.warn('bootstrap', '⏱️ Failsafe timeout reached, showing manual navigation button');
        setShowFailsafe(true);
      }
    }, FAILSAFE_TIMEOUT);

    return () => clearTimeout(timer);
  }, [isAuthChecked]);

  // Ultra-simple auth check: just look at HAS_ACCOUNT flag
  // If true, redirect. If false or error, just show welcome screen (no harm done)
  React.useEffect(() => {
    // Don't proceed until bootstrap is complete
    if (!bootstrap.isReady) {
      logger.debug('bootstrap', '⏸️ Waiting for bootstrap to complete');
      return;
    }

    logger.info('bootstrap', '🚀 Bootstrap ready! Checking for quick redirect...');

    const quickAuthCheck = async () => {
      try {
        const authState = await AuthStateManager.getAuthState();
        
        // Simple check: if HAS_ACCOUNT is true, redirect (saves a click)
        if (authState.hasAccount) {
          logger.debug('bootstrap', '✅ Quick check passed: user has account, redirecting');
          setIsAuthChecked(true);
          setHasAccount(true);
          // Don't redirect here - let the effect below run, or just proceed
          // Actually, we'll return early so the render below shows loading briefly, then select guard takes over
          return;
        }
        
        logger.debug('bootstrap', '⏭️ Quick check: no account flag, showing welcome');
        setIsAuthChecked(true);
        setHasAccount(false);
      } catch (error) {
        // If check fails, just show welcome - no harm done
        logger.debug('bootstrap', '⚠️ Quick check failed, showing welcome:', error);
        setIsAuthChecked(true);
        setHasAccount(false);
      }
    };

    quickAuthCheck();
  }, [bootstrap.isReady]);

  // Show loading spinner while bootstrap is happening
  if (!bootstrap.isReady) {
    const loadingMessage = bootstrap.assetsLoaded ? 'Restoring session...' : 'Loading assets...';
    logger.debug('bootstrap', '⏳ Rendering index loading overlay:', loadingMessage);
    
    return (
      <View style={styles.container}>
        <LoadingOverlay 
          message={loadingMessage}
          error={bootstrap.error}
          assetsLoaded={bootstrap.assetsLoaded}
        />
      </View>
    );
  }

  // Show welcome screen once auth check is complete
  // For authenticated users: they'll see the welcome screen momentarily, 
  // but the select route guard will pull them to /select/world-selection
  if (isAuthChecked) {
    logger.debug('bootstrap', `📋 Rendering welcome screen (hasAccount: ${hasAccount})`);
    
    return (
      <View style={styles.container}>
        <Welcome />
        
        {showFailsafe && (
          <View style={styles.failsafeContainer}>
            <TouchableOpacity 
              style={styles.failsafeButton}
              onPress={() => {
                logger.info('bootstrap', '🚪 User clicked failsafe button, navigating to welcome');
                // Welcome screen is already showing, so this is a manual refresh
              }}
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

  // Show loading while determining auth status
  logger.debug('bootstrap', '⏳ Checking auth status...');
  return (
    <View style={styles.container}>
      <LoadingOverlay 
        message="Checking authentication..."
        error={bootstrap.error}
        assetsLoaded={bootstrap.assetsLoaded}
      />
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
