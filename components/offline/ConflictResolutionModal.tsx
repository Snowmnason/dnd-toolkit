/**
 * ConflictResolutionModal Component
 *
 * Displays conflict details to user and lets them choose resolution strategy.
 * Handles one conflict at a time; queue processes conflicts sequentially.
 */

import { AppModal } from "@/components/ui/AppModal";
import { Body } from "@/components/ui/AppText";
import { Button } from "@/components/ui/BaseButton";
import { QueuedMutation, SyncConflict } from "@/lib/offline/types";
import { useScale } from "@/theme";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

interface ConflictResolutionModalProps {
  visible: boolean;
  mutation?: QueuedMutation;
  conflict?: SyncConflict;
  resourceType?: string; // e.g., 'notes', 'characters'
  onClientWins: () => void; // Keep offline changes
  onServerWins: () => void; // Keep server version
  onDiscard: () => void; // Throw away offline changes
  onCancel: () => void; // Close without deciding (keeps in queue)
}

/**
 * Maps conflict type to user-friendly description
 */
function getConflictDescription(conflict: SyncConflict): string {
  switch (conflict.type) {
    case "version_mismatch":
      return "Another change was made to this item on the server while you were offline.";
    case "resource_deleted":
      return "This item was deleted on the server while you were offline.";
    case "permission_denied":
      return "Your permissions changed. You may no longer have access to this item.";
    default:
      return "A conflict was detected between your offline changes and the server.";
  }
}

/**
 * Maps operation type to action verb
 */
function getOperationVerb(operation: string): string {
  switch (operation) {
    case "create":
      return "created";
    case "update":
      return "updated";
    case "delete":
      return "deleted";
    default:
      return "modified";
  }
}

export function ConflictResolutionModal({
  visible,
  mutation,
  conflict,
  resourceType,
  onClientWins,
  onServerWins,
  onDiscard,
  onCancel,
}: ConflictResolutionModalProps) {
  const S = useScale();
  const [selectedOption, setSelectedOption] = useState<
    "client" | "server" | "discard" | null
  >(null);

  useEffect(() => {
    if (!visible) {
      setSelectedOption(null);
    }
  }, [visible]);

  if (!mutation || !conflict) return null;

  const isDestructive = mutation.operation === "delete";
  const verb = getOperationVerb(mutation.operation);
  const description = getConflictDescription(conflict);

  return (
    <AppModal visible={visible} onClose={onCancel} heading="Offline Conflict">
      <View style={styles.content}>
        {/* Conflict Description */}
        <View style={{ marginBottom: S.space.lg }}>
          <Body>{description}</Body>
        </View>

        {/* What Happened */}
        <View
          style={{
            backgroundColor: "$surface",
            borderLeftWidth: 3,
            borderLeftColor: "$warning",
            paddingLeft: S.space.md,
            paddingVertical: S.space.sm,
            marginBottom: S.space.lg,
          }}
        >
          <Body textType="secondary" fontSize="sm">
            You {verb} this {resourceType || "item"} while offline. The server
            has a different version.
          </Body>
        </View>

        {/* Resolution Options */}
        <View style={{ gap: S.space.md }}>
          {/* Option 1: Keep Your Changes */}
          <OptionButton
            label="Keep My Changes"
            description="Apply your offline changes (may overwrite server)"
            tone="info"
            selected={selectedOption === "client"}
            onPress={() => setSelectedOption("client")}
            warning={!isDestructive}
          />

          {/* Option 2: Use Server Version */}
          <OptionButton
            label="Use Server Version"
            description="Discard your changes, keep what's on the server"
            tone="warning"
            selected={selectedOption === "server"}
            onPress={() => setSelectedOption("server")}
          />

          {/* Option 3: Discard */}
          <OptionButton
            label="Discard"
            description="Don't apply your changes at all"
            tone="danger"
            selected={selectedOption === "discard"}
            onPress={() => setSelectedOption("discard")}
          />
        </View>

        {/* Action Buttons */}
        <View
          style={{
            flexDirection: "row",
            gap: S.space.md,
            marginTop: S.space.lg,
          }}
        >
          <Button variant="secondary" onPress={onCancel} style={{ flex: 1 }}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onPress={() => {
              if (selectedOption === "client") onClientWins();
              else if (selectedOption === "server") onServerWins();
              else if (selectedOption === "discard") onDiscard();
            }}
            disabled={!selectedOption}
            style={{ flex: 1 }}
          >
            Confirm
          </Button>
        </View>
      </View>
    </AppModal>
  );
}

interface OptionButtonProps {
  label: string;
  description: string;
  tone: "info" | "warning" | "danger";
  selected: boolean;
  onPress: () => void;
  warning?: boolean;
}

/**
 * Individual option button with description
 */
function OptionButton({
  label,
  description,
  tone,
  selected,
  onPress,
  warning,
}: OptionButtonProps) {
  const S = useScale();

  const borderColor =
    tone === "danger" ? "$danger" : tone === "warning" ? "$warning" : "$info";

  return (
    <Button
      variant={selected ? "primary" : "secondary"}
      onPress={onPress}
      style={{
        borderLeftWidth: 3,
        borderLeftColor: selected ? borderColor : "transparent",
        paddingLeft: S.space.md,
        alignItems: "flex-start",
      }}
    >
      <View style={{ alignItems: "flex-start", gap: S.space.xs }}>
        <Body fontSize="sm" variant="semi">
          {label}
        </Body>
        <Body fontSize="xs" textType="secondary">
          {description}
        </Body>
        {warning && (
          <Body fontSize="xs" textType="secondary">
            ⚠ May lose data
          </Body>
        )}
      </View>
    </Button>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 16,
  },
});
