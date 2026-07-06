import Welcome from "@/AppScreens/Welcome";
import { SplashScreen } from "@/components/SplashScreen";
import { useAppKernel } from "@/hooks/kernel";
import { StyleSheet, View } from "react-native";

export default function HomePage() {
  // Wait for kernel to complete before routing
  const kernel = useAppKernel();


  // While kernel is initializing, UIBlockerLayer (in _layout.tsx) shows the splash.
  // Render a fallback SplashScreen here too in case UIBlockerLayer is not yet mounted.
  if (!kernel.phases.appReady) {
    return <SplashScreen subtitle="Loading App" message="Preparing your world..." />;
  }

  // Kernel is ready — show welcome screen.
  // For authenticated users, bootstrap route coordination in _layout.tsx may
  // redirect to /select/world-selection before this route remains visible.
  return (
    <View style={styles.container}>
      <Welcome />
    </View>
  );
}

// Styles for HomePage
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#2f353d",
  },
});
