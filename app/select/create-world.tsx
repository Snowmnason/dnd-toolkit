import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { View } from "react-native";

import { CreateLeftPanel } from "@/AppScreens/select/create-world/CreateLeftPanel";
import MapCanvas from "@/AppScreens/select/create-world/MapCanvas";
import { AppSplit, Button } from "@/components/ui";
import { useCurrentSession } from "@/hooks/auth";
import { useWorldCreation } from "@/hooks/utils/use-world-creation";
import { usePlatform } from "@/providers";
import { useScale } from "@/theme";
import { worldSchema, type WorldFormData } from "@/validation";

// Constants
const tabletopSystems = ["D&D 5e", "Pathfinder", "Call of Cthulhu", "Custom"];
const systemItems = tabletopSystems.map((t) => ({ label: t, value: t }));

/**
 * Default map images
 * NOTE: External URLs require CORS headers. For production:
 * 1. Download images and store in assets/images/
 * 2. Use local paths instead of external URLs
 * 3. Or use your backend as an image proxy
 *
 * Currently empty - maps can be uploaded via the import feature
 */
const defaultMapImages: string[] = [
  "https://xxoibawslmysvfllozyb.supabase.co/storage/v1/object/public/Maps/map%20(1).jpg", 
  "https://xxoibawslmysvfllozyb.supabase.co/storage/v1/object/public/Maps/map%20(2).jpg",
  "https://xxoibawslmysvfllozyb.supabase.co/storage/v1/object/public/Maps/map%20(3).jpg",
  "https://xxoibawslmysvfllozyb.supabase.co/storage/v1/object/public/Maps/map%20(4).jpg",
];

export default function CreateWorldScreen() {
  const S = useScale();

  // Centralized platform detection
  const { isDesktop } = usePlatform();

  // RHF form
  const {
    control,
    handleSubmit,
    formState: { isValid },
  } = useForm<WorldFormData>({
    resolver: zodResolver(worldSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      description: "",
      system: tabletopSystems[0] as WorldFormData["system"],
    },
  });
  // Local state
  const [imageImported, setImageImported] = useState(false);
  const [mapIndex, setMapIndex] = useState(0);

  // Hooks
  const { session } = useCurrentSession();
  const {
    isCreating,
    //successWorldId,
    createWorld,
    showSignInModal,
    showValidationModal,
  } = useWorldCreation();

  // Logic
  const onSubmit = async (data: WorldFormData) => {
    if (!session) {
      showSignInModal();
      return;
    }

    await createWorld({
      name: data.name,
      description: data.description || "",
      system: data.system,
      // Use map image if available, otherwise empty string
      mapImageUrl:
        // eslint-disable-next-line security/detect-object-injection
        defaultMapImages.length > 0 ? defaultMapImages[mapIndex] : undefined,
    });
  };

  // Left Panel Component
  const LeftPanel = (
    <CreateLeftPanel
      control={control}
      systemItems={systemItems}
      isCreating={isCreating}
      isFormValid={isValid}
      handleCreateWorld={handleSubmit(onSubmit, () =>
        showValidationModal(),
      )}
    />
  );

  // Right Panel Component
  const RightPanel = isDesktop ? (
    <View
      style={{
        flex: 3,
      }}
    >
      <MapCanvas
        onPress={() => {
          setImageImported(false);
          if (defaultMapImages.length > 0) {
            setMapIndex(Math.floor(Math.random() * defaultMapImages.length));
          }
        }}
        imageImported={imageImported}
        // Use map image if available
        imageUrl={
          // eslint-disable-next-line security/detect-object-injection
          defaultMapImages.length > 0 ? defaultMapImages[mapIndex] : undefined
        }
      />
      <Button
        text="Import Image"
        variant="primary"
        onPress={() => setImageImported(true)}
        style={{ margin: S.space.lg }}
      />
    </View>
  ) : null;

  return <AppSplit left={LeftPanel} right={RightPanel} />;
}
