import { panelConfigs } from "@/AppScreens/main-panels/PanelData";
import { PanelView } from "@/AppScreens/main-panels/PanelView";
import type { AccessRole } from "@/hooks/storage";
import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";

/**
 * Desktop-only composition surface — renders all 5 panels in a horizontal grid.
 * Mobile users are served by the per-panel routes (/main/characters, etc.).
 * Platform enforcement is handled at the route config level (platform: 'desktop').
 */
export default function MainLanding() {
  const params = useLocalSearchParams();
  const worldId =
    typeof params.worldId === "string" ? params.worldId : undefined;
  const userRole =
    typeof params.userRole === "string" ? (params.userRole as AccessRole) : undefined;

  return (
    <View style={{ flexDirection: "row", flex: 1 }}>
      {panelConfigs.map((panel, i) => (
        <PanelView
          key={panel.key}
          config={panel}
          worldId={worldId}
          userRole={userRole}
          image={panel.image ?? undefined}
          showRightBorder={i !== panelConfigs.length - 1}
        />
      ))}
    </View>
  );
}
