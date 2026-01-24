import {
  Button,
  Dropdown,
  FormDescInput,
  FormTextInput,
  Heading,
} from "@/components/ui";
import { buildNavigationTarget } from "@/lib/navigation/uri-helpers";
import type { WorldFormData } from "@/lib/schemas";
import { usePlatform } from "@/providers/PlatformProvider";
import { useScale } from "@/theme";
import { useRouter } from "expo-router";
import { Controller, type Control } from "react-hook-form";
import { ScrollView, View } from "react-native";

interface CreateLeftPanelProps {
  control: Control<WorldFormData, any>;
  systemItems: { label: string; value: string }[];
  isCreating: boolean;
  handleCreateWorld: () => void;
  isFormValid: boolean;
}

export function CreateLeftPanel({
  control,
  systemItems,
  isCreating,
  handleCreateWorld,
  isFormValid,
}: CreateLeftPanelProps) {
  const S = useScale();
  const router = useRouter();

  // Centralized platform detection
  const { isDesktop } = usePlatform();

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        paddingBottom: S.space.xxl * 2, // make room for bottom button
      }}
      showsVerticalScrollIndicator={false}
    >
      <Heading align="center" style={{ marginBottom: S.space.lg }}>
        Create New World
      </Heading>

      {/* World Name */}
      <View style={{ marginBottom: S.space.md }}>
        <FormTextInput
          control={control}
          name="name"
          heading="Name of World"
          placeholder="World Name"
        />
      </View>

      {/* Tabletop System */}
      <Controller
        control={control}
        name="system"
        render={({ field }) => (
          <Dropdown
            heading="Tabletop System"
            value={field.value}
            items={systemItems}
            onChange={(value) => {
              if (value !== null) field.onChange(value);
            }}
            placeholder="Select a tabletop system"
            style={{ marginBottom: S.space.md }}
          />
        )}
      />

      {/* Description */}
      <FormDescInput
        control={control}
        name="description"
        heading="Description"
        placeholder="Description"
        multiline
        style={{
          height: 300,
          textAlignVertical: "top",
        }}
      />

      {/* Import Image (mobile only) */}
      {!isDesktop && (
        <Button
          text="Import Image"
          variant="secondary"
          onPress={() => {}}
          style={{ marginBottom: S.space.lg }}
        />
      )}

      {/* Action Buttons */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginTop: S.space.md,
        }}
      >
        <Button
          text="Cancel"
          variant="outlined"
          onPress={() => {
            const target = buildNavigationTarget(
              "/select/world-selection",
              {},
              [],
            );
            router.replace(target as any);
          }}
          style={{ flex: 1, marginRight: S.space.sm }}
        />
        <Button
          text={isCreating ? "Creating..." : "Create"}
          variant="primary"
          onPress={handleCreateWorld}
          disabled={!isFormValid || isCreating}
          style={{ flex: 1, marginLeft: S.space.sm }}
        />
      </View>
    </ScrollView>
  );
}
