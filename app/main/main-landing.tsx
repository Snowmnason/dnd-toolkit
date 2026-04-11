import { panelConfigs } from "@/AppScreens/main-panels/PanelData";
import { PanelView } from "@/AppScreens/main-panels/PanelView";
import { AppPage } from "@/components/ui";
import type { AccessRole } from "@/hooks/storage";
import { usePlatform } from "@/providers";
import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";

export default function MainLanding() {
  const params = useLocalSearchParams();
  const worldId =
    typeof params.worldId === "string" ? params.worldId : undefined;
  const userRole =
    typeof params.userRole === "string" ? (params.userRole as AccessRole) : undefined;
  const tab = typeof params.tab === "string" ? params.tab : "characters";

  // Centralized platform detection
  const { isDesktop } = usePlatform();

  // Desktop Layout - Show all panels in a grid
  if (isDesktop) {
    return (
      <View
        style={{
          flexDirection: "row",
          flex: 1,
        }}
      >
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

  // Mobile Layout - Show single active panel based on tab param
  const activePanel =
    panelConfigs.find((p) => p.key === tab) || panelConfigs[0];

  return (
    <AppPage style={{ flex: 1 }}>
      <PanelView
        config={activePanel}
        worldId={worldId}
        userRole={userRole}
        image={activePanel.image ?? undefined}
      />
    </AppPage>
  );
}
