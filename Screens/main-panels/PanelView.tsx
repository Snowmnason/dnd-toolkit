import { AppPage, Button, Heading } from "@/components/ui";
import { getShadowStyle } from "@/components/ui/Resuables/shadows";
import { buildNavigationTarget } from "@/lib/navigation/uri-helpers";
import { useAppParamsVolatile } from "@/providers/AppParamsVolatileProvider";
import { usePlatform } from "@/providers/PlatformProvider";
import { $, useScale } from "@/theme";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { PanelConfig } from "./PanelData";

interface PanelViewProps {
  config: PanelConfig;
  worldId?: string;
  userRole?: string;
  style?: any;
  image?: string;
  /** Show right-hand divider border (desktop only). Useful to hide on last panel. */
  showRightBorder?: boolean;
}

export function PanelView({
  config,
  worldId,
  userRole,
  style,
  image,
  showRightBorder = true,
}: PanelViewProps) {
  const router = useRouter();
  const S = useScale();
  const { updateVolatileParams } = useAppParamsVolatile();
  // Centralized platform detection
  const { isDesktop } = usePlatform();

  const navigateToFeature = (featurePath: string) => {
    updateVolatileParams({ worldId, userRole });

    const target = buildNavigationTarget(
      `/main/${featurePath}`,
      { worldId, userRole },
      ["worldId", "userRole"],
    );
    router.push(target as any);
  };

  const backgroundImage = image ? { uri: image } : undefined;

  return (
    <AppPage
      backgroundImage={backgroundImage}
      style={[
        {
          minWidth: 260,
          backgroundColor: image ? "rgba(0,0,0,0.3)" : $("background"),
        },
        style,
      ]}
      contentContainerStyle={{
        justifyContent: "space-between",
        alignItems: "center",
        borderRightWidth: isDesktop && showRightBorder ? 2 : 0,
        borderRightColor: $("borderSubtle" as any),
      }}
    >
      {/* ─────────────── Panel Header ─────────────── */}
      <View
        style={{
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: S.space.md * 5,
        }}
      >
        <Heading
          align="center"
          style={{
            marginBottom: S.space.md,
            marginTop: S.space.md,
            marginHorizontal: S.space.sm,
          }}
        >
          {config.title}
        </Heading>
      </View>

      {/* ─────────────── Feature Buttons ─────────────── */}
      <View
        style={{
          width: "100%",
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          gap: S.space.sm,
        }}
      >
        {config.items.map((item, index) => (
          <Button
            key={index}
            text={item.name}
            variant="primary"
            onPress={() => navigateToFeature(item.route)}
            style={{
              width: "85%",
              marginVertical: S.space.xs,
              ...getShadowStyle("softer"),
            }}
          />
        ))}
      </View>
    </AppPage>
  );
}
