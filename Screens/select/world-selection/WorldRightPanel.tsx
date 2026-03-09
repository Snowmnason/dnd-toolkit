import { Button, Card, Heading, LazyImage } from "@/components/ui";
import { WorldWithAccess } from "@/hooks/storage";
import { useNavigate } from "@/hooks/navigation";
import { logger } from "@/hooks/utils";
import { useAppParamsStable, useAppParamsVolatile, usePlatform, useUserId } from "@/providers";
import { $, useScale, UseTheme } from "@/theme";
import { View } from "react-native";

interface WorldRightPanelProps {
  selectedWorld: WorldWithAccess | null;
  mapImage: string | null;
  noImageSelected: any;
  onEditOrLeave: () => void;
}

export function WorldRightPanel({
  selectedWorld,
  mapImage,
  noImageSelected,
  onEditOrLeave,
}: WorldRightPanelProps) {
  const S = useScale();
  const { theme } = UseTheme();
  const { push: navigatePush } = useNavigate();
  const userId = useUserId();
  const { updateVolatileParams } = useAppParamsVolatile();
  const { addConnectedWorld } = useAppParamsStable();
  const { isDesktop } = usePlatform();
  // Optional flag to disable the large backdrop image if it's causing perf issues
  const DISABLE_BACKDROP =
    process.env.EXPO_PUBLIC_DISABLE_WORLD_MAP_IMAGE === "1";

  return (
    <View style={{ flex: 1, position: "relative" }}>
      {/* Map Preview - fills entire container with lazy loading */}
      {!DISABLE_BACKDROP && (
        <LazyImage
          src={mapImage || noImageSelected}
          fallbackSrc={noImageSelected}
          width="100%"
          height="100%"
          contentFit={isDesktop ? "cover" : "contain"}
          optimizeSupabase={!!mapImage}
          optimizeWidth={1200}
          optimizeQuality={85}
          showSkeleton={!!mapImage}
          cacheStrategy="memory-disk"
          transition={300}
          containerStyle={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
        />
      )}

      {/* Title overlay in a semi-transparent Card (does not block image) */}
      {selectedWorld && (
        <>
          <Card
            shadow
            bordered
            toneVariant="base"
            style={{
              position: "absolute",
              top: S.space.lg,
              left: S.space.lg,
              right: S.space.lg,
              padding: S.space.sm,
              borderColor: $("borderSubtle" as any),
            }}
          >
            <Heading
              align="center"
              style={{ color: $("textPrimary", theme), marginBottom: 0 }}
            >
              {selectedWorld.name}
            </Heading>
          </Card>

          {/* Bottom action buttons */}
          <View
            style={{
              position: "absolute",
              left: "1%",
              right: "1%",
              bottom: S.space.xl,
              flexDirection: "row",
              justifyContent: "space-between",
              backgroundColor: "transparent",
            }}
          >
            <Button
              text={selectedWorld.user_role === "dm" || selectedWorld.owner_id === userId ? "Edit" : "Leave"}
              variant="secondary"
              onPress={onEditOrLeave}
              style={{ width: 160 }}
            />
            <Button
              text="Open"
              variant="primary"
              onPress={() => {
                if (!selectedWorld) return;

                logger.category('ui').info("[WorldRightPanel] Open button pressed", {
                  worldId: selectedWorld.world_id,
                  userRole: selectedWorld.user_role,
                });

                // Immediately add to connected worlds so auth guard can verify access
                addConnectedWorld(selectedWorld.world_id);

                // Update context first
                updateVolatileParams({
                  worldId: selectedWorld.world_id,
                  userRole: selectedWorld.user_role,
                });

                // Navigate using centralized navigation helper
                navigatePush(
                  "/main/main-landing",
                  {
                    worldId: selectedWorld.world_id,
                    userRole: selectedWorld.user_role,
                  },
                  ["worldId", "userRole"],
                );
              }}
              style={{ width: 160 }}
            />
          </View>
        </>
      )}
    </View>
  );
}
