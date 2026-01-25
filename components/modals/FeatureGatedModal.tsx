/**
 * Feature Gated Modal
 *
 * Modal shown when user taps a disabled/gated feature during safe mode.
 * Explains why the feature is unavailable and suggests recovery actions.
 *
 * Usage:
 * ```tsx
 * const [featureGatedVisible, setFeatureGatedVisible] = useState(false);
 * const [gatedFeature, setGatedFeature] = useState<AffectedFeature | null>(null);
 *
 * // When user taps disabled button
 * const handleDisabledFeatureTap = (feature: AffectedFeature) => {
 *   setGatedFeature(feature);
 *   setFeatureGatedVisible(true);
 * };
 *
 * return (
 *   <>
 *     <FeatureGatedModal
 *       visible={featureGatedVisible}
 *       feature={gatedFeature}
 *       onClose={() => setFeatureGatedVisible(false)}
 *     />
 *   </>
 * );
 * ```
 */

import { AppModal, Body, Button } from "@/components/ui";
import { useFeatureGatingStatus } from "@/hooks/utils/use-feature-gating";
import { AffectedFeature } from "@/lib/error/safe-mode";
import { useScale } from "@/theme";
import { View } from "react-native";

interface FeatureGatedModalProps {
  visible: boolean;
  feature: AffectedFeature | null;
  onClose: () => void;
}

/**
 * Modal shown when user tries to use a gated feature
 * Displays reason and suggests going to safe mode screen for recovery
 */
export function FeatureGatedModal({
  visible,
  feature,
  onClose,
}: FeatureGatedModalProps) {
  const S = useScale();

  // Call hook unconditionally (React Rules of Hooks requirement)
  // The hook handles null features safely by returning not-gated status
  const gatingStatus = useFeatureGatingStatus(feature);

  // Only show modal if feature is actually gated
  if (!gatingStatus.isGated) {
    return null;
  }

  return (
    <AppModal visible={visible} onClose={onClose} heading="Feature Unavailable">
      <View style={{ padding: S.space.lg, gap: S.space.md }}>
        <Body style={{ lineHeight: 1.6 }}>{gatingStatus.reason}</Body>

        <Body style={{ fontSize: 13, opacity: 0.7, lineHeight: 1.5 }}>
          Your app is in safe mode because of a critical issue. Please check the
          app status screen for recovery options.
        </Body>

        <View style={{ gap: S.space.sm }}>
          <Button text="Close" variant="secondary" onPress={onClose} />
        </View>
      </View>
    </AppModal>
  );
}
