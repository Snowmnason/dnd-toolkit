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
      try {
        setIsRouting(true);
        setError(null);

        // For web, use simple redirect to welcome to avoid GitHub Pages issues
        if (Platform.OS === 'web') {
          console.log('🌐 Web platform detected - redirecting to welcome');
          router.replace('/login/welcome');
          return;
        }

        // For mobile, do full routing logic
        const routingDecision = await AuthStateManager.getRoutingDecision();
        
        setTimeout(() => {
          try {
            switch (routingDecision) {
              case 'welcome':
                router.replace('/login/welcome');
                break;
              case 'complete-profile':
                router.replace('/login/complete-profile');
                break;
              case 'login':
              case 'main':
                router.replace('/select/world-selection');
                break;
              default:
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
        setError('Failed to load app. Please refresh the page.');
        
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
