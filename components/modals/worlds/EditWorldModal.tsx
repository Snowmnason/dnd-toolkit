import { AppModal, Body, Button, FormTextInput } from "@/components/ui";
import { registerModal } from "@/contexts";
import { logger } from "@/lib/utils/logger";
import { $, useScale, UseTheme } from "@/theme";
import { editWorldNameSchema, type EditWorldNameFormData } from "@/validation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Platform, View } from "react-native";

interface EditWorldModalProps {
  visible: boolean;
  onClose: () => void;
  worldName: string;
  originalWorldName?: string;
  onWorldNameChange: (name: string) => void;
  onConfirmWorldName: () => void;
  onGenerateInviteLink: () => Promise<void>;
  onDeleteWorld: () => Promise<void>;
  generatingLink: boolean;
}

/**
 * 🌍 EditWorldModal
 * Fully featured world editor with validation, invite links, and safe deletion.
 */
export function EditWorldModal({
  visible,
  onClose,
  worldName,
  originalWorldName,
  onWorldNameChange,
  onConfirmWorldName,
  onGenerateInviteLink,
  onDeleteWorld,
  generatingLink,
}: EditWorldModalProps) {
  const S = useScale();
  const { theme } = UseTheme();
  const [deleting, setDeleting] = useState(false);
  const [deleteDisabled, setDeleteDisabled] = useState(false);

  // RHF for name editing
  const {
    control,
    handleSubmit,
    formState: { isValid },
    reset,
  } = useForm<EditWorldNameFormData>({
    resolver: zodResolver(editWorldNameSchema),
    mode: "onChange",
    defaultValues: {
      name: worldName || "",
      originalName: originalWorldName || "",
    },
  });

  const isDesktop =
    Platform.OS === "web" ||
    Platform.OS === "windows" ||
    Platform.OS === "macos";

  const handleGenerateInviteLinkClick = async () => {
    if (generatingLink) return;
    try {
      await onGenerateInviteLink();
    } catch (error) {
      logger.category("ui").error("Failed to generate invite link:", error);
    }
  };

  const handleDeleteClick = async () => {
    if (deleteDisabled) return;

    if (!deleting) {
      // 🕓 First click: trigger shake + disable briefly
      setDeleting(true);
      setDeleteDisabled(true);
      setTimeout(() => setDeleteDisabled(false), 1500);
    } else {
      // 🗑️ Second click: confirm delete
      try {
        setDeleteDisabled(true);
        await onDeleteWorld();
        onClose();
      } catch (error) {
        logger.category("ui").error("Failed to delete world:", error);
        setDeleteDisabled(false);
      }
    }
  };

  // Reset transient state whenever modal closes to avoid stale flags affecting next open
  useEffect(() => {
    if (!visible) {
      setDeleting(false);
      setDeleteDisabled(false);
      reset({
        name: worldName || "",
        originalName: originalWorldName || "",
      });
    }
  }, [visible, reset, worldName, originalWorldName]);

  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      heading={worldName ? `Edit ${worldName}` : "Edit This World"}
      body="Rename your world, share it with others, or delete it permanently."
      borderTone="accent"
      animateOnDestruction={deleting} // 💥 modal shakes on delete confirmation
    >
      {/* 🏷️ Edit Name Section */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginBottom: S.space.md,
          gap: S.space.sm,
        }}
      >
        <FormTextInput
          control={control}
          name="name"
          heading="Edit World Name"
          placeholder="Enter world name..."
          onChangeText={onWorldNameChange}
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: $("border"),
            borderRadius: S.radius.md,
            fontSize: isDesktop ? S.s(18) : S.s(16),
          }}
        />
        <Button
          text="Confirm"
          variant="primary"
          onPress={handleSubmit(() => onConfirmWorldName())}
          disabled={!isValid}
          style={{
            marginBottom: S.space.xl * -1.5,
          }}
        />
      </View>
      {/* Field-level errors are displayed inline via TextInput error prop */}

      {/* 🔗 Invite Section */}
      <Body style={{ marginBottom: S.space.xs, fontWeight: "600" }}>
        Share {worldName || "this world"} with others
      </Body>

      <Button
        text={
          generatingLink
            ? "📋 Link Saved to Clipboard"
            : "🔗 Generate Invite Link"
        }
        variant="secondary"
        onPress={handleGenerateInviteLinkClick}
        disabled={generatingLink}
        style={{
          marginBottom: S.space.sm,
        }}
      />

      <Body
        style={{
          fontSize: S.s(14),
          color: $("textSecondary", theme),
          textAlign: "center",
          marginBottom: S.space.md,
        }}
      >
        Creates a shareable link that’s copied to your clipboard.
      </Body>

      {/* 💀 Delete Button */}
      <Button
        text={deleting ? "Confirm Delete" : "Delete"}
        variant="destructive"
        onPress={handleDeleteClick}
        disabled={deleteDisabled}
        style={{
          opacity: deleteDisabled ? 0.7 : 1,
          marginTop: S.space.sm,
        }}
      />

      {/* Close Button 
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-end',
          marginTop: S.space.md,
        }}
      >
        <Button text="Close" variant="secondary" onPress={onClose} />
      </View>*/}
    </AppModal>
  );
}

// Register modal for centralized management
registerModal('edit-world', EditWorldModal)
