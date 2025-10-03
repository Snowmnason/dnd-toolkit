import { useRouter } from "expo-router";
import React from "react";
import { Platform, View } from "react-native";
import CustomLoad from "../components/custom_components/CustomLoad";
import { ThemedText } from "../components/themed-text";
import { AuthStateManager } from "../lib/auth-state";

export default function HomePage() {
  const router = useRouter();
  const [isRouting, setIsRouting] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Check auth state and route accordingly - simplified for web reliability
  React.useEffect(() => {
    const handleRouting = async () => {
      try {
        setIsRouting(true);
        setError(null);

        // For web deployment, add a longer delay to ensure everything is loaded
        const delay = Platform.OS === 'web' ? 500 : 100;

        // Simplified routing - always start at welcome for new users on web
        // This avoids Supabase client initialization issues on GitHub Pages
        let routingDecision: string;
        
        if (Platform.OS === 'web') {
          // On web, be more conservative - just check if user has account flag
          try {
            const authState = await AuthStateManager.getAuthState();
            routingDecision = authState.hasAccount ? 'main' : 'welcome';
          } catch {
            // If auth state check fails, default to welcome
            routingDecision = 'welcome';
          }
        } else {
          // On mobile, use full routing decision
          routingDecision = await AuthStateManager.getRoutingDecision();
        }
        
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
        }, delay);
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
        }, 2000);
      } finally {
        // Remove loading state after delay
        setTimeout(() => {
          setIsRouting(false);
        }, Platform.OS === 'web' ? 1000 : 500);
      }
    };

    handleRouting();
  }, [router]);

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
