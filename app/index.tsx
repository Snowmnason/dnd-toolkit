import { useRouter } from "expo-router";
import React from "react";
import { View } from "react-native";
import CustomLoad from "../components/custom_components/CustomLoad";
import { AuthStateManager } from "../lib/auth-state";

export default function HomePage() {
  const router = useRouter();

  // Check auth state and route accordingly
  React.useEffect(() => {
    const handleRouting = async () => {
      try {
        const routingDecision = await AuthStateManager.getRoutingDecision();
        
        // Small delay to ensure router is mounted
        setTimeout(() => {
          switch (routingDecision) {
            case 'welcome':
              router.replace('/login/welcome');
              break;
            case 'login':
              // Could implement auto-login here, for now go to main
              router.replace('/select/world-selection');
              break;
            case 'profile':
              router.replace('/login/complete-profile' as any);
              break;
            case 'main':
              router.replace('/select/world-selection');
              break;
            default:
              router.replace('/login/welcome');
          }
        }, 100);
      } catch (error) {
        console.error('Routing error:', error);
        // Fallback to welcome screen
        setTimeout(() => {
          router.replace('/login/welcome');
        }, 100);
      }
    };

    handleRouting();
  }, [router]);

  // Show loading spinner while determining route
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#2f353d' }}>
      <CustomLoad height={100} width={100} />
    </View>
  );
}
