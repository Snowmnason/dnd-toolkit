import { Redirect, useRouter } from "expo-router";
import React from "react";
import { Platform, View } from "react-native";
import CustomLoad from "../components/custom_components/CustomLoad";
import { ThemedText } from "../components/themed-text";
import { AuthStateManager } from "../lib/auth-state";

export default function HomePage() {
  const router = useRouter();
  const [isRouting, setIsRouting] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // For mobile platforms, do the full routing logic
  React.useEffect(() => {
    const handleRouting = async () => {
      // Helper: attempt a router.replace safely, blurring active element on web
      const safeReplace = (path: '/login/welcome' | '/login/complete-profile' | '/select/world-selection', attempts = 6, delay = 80) => {
        const tryReplace = (remaining: number) => {
          try {
            // On web, blur the active element so it won't be hidden by aria-hidden overlays
            if (Platform.OS === 'web' && typeof document !== 'undefined') {
              try {
                const active = document.activeElement as HTMLElement | null;
                if (active && typeof active.blur === 'function') active.blur();
              } catch {
                // ignore
              }
            }

            router.replace(path as any);
          } catch {
            if (remaining > 0) {
              setTimeout(() => tryReplace(remaining - 1), delay);
            } else {
              try {
                router.replace(path as any);
              } catch (err) {
                console.warn('safeReplace: failed to navigate to', path, err);
              }
            }
          }
        };

        tryReplace(attempts - 1);
      };

      try {
        setIsRouting(true);
        setError(null);

        
        // For web, use simple redirect to welcome to avoid GitHub Pages issues
        if (Platform.OS === 'web') {
          console.log('🌐 Web platform detected - redirecting to welcome');
          safeReplace('/login/welcome');
          return;
        }

        // For mobile, do full routing logic
        const routingDecision = await AuthStateManager.getRoutingDecision();
        
        setTimeout(() => {
          try {
            switch (routingDecision) {
              case 'welcome':
                safeReplace('/login/welcome');
                break;
              case 'complete-profile':
                safeReplace('/login/complete-profile');
                break;
              case 'login':
              case 'main':
                safeReplace('/select/world-selection');
                break;
              default:
                safeReplace('/login/welcome');
            }
            } catch {
              console.error('Navigation error: (see above)');
              // Fallback navigation
              safeReplace('/login/welcome');
            }
        }, 100);
      } catch (error) {
        console.error('Routing error:', error);
        setError('Failed to load app. Please refresh the page.');
        
            // Emergency fallback to welcome screen
        setTimeout(() => {
          safeReplace('/login/welcome');
        }, 1000);
      } finally {
        // Remove loading state after a short delay
        setTimeout(() => {
          setIsRouting(false);
        }, 300);
      }
    };

    handleRouting();
  }, [router]);

  // For web, also provide a declarative redirect as backup
  if (Platform.OS === 'web' && !isRouting) {
    return <Redirect href="/login/welcome" />;
  }

  // Show loading spinner while determining route
  return (
    <View style={{ 
      flex: 1, 
      justifyContent: 'center', 
      alignItems: 'center', 
      backgroundColor: '#2f353d',
      padding: 20
    }}>
      <CustomLoad height={100} width={100} />
      
      {isRouting && (
        <ThemedText style={{ 
          marginTop: 20, 
          color: '#F5E6D3', 
          textAlign: 'center',
          fontSize: 16
        }}>
          Loading D&D Toolkit...
        </ThemedText>
      )}

      {error && (
        <View style={{ marginTop: 20, alignItems: 'center' }}>
          <ThemedText style={{ 
            color: '#ff6b6b', 
            textAlign: 'center',
            fontSize: 14,
            marginBottom: 10
          }}>
            {error}
          </ThemedText>
          <ThemedText style={{ 
            color: '#F5E6D3', 
            textAlign: 'center',
            fontSize: 12,
            opacity: 0.7
          }}>
            Redirecting to welcome screen...
          </ThemedText>
        </View>
      )}
    </View>
  );
}
